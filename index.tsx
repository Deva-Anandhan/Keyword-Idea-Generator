
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import { GoogleGenAI } from '@google/genai';
import { marked } from 'marked';
import DOMPurify from 'dompurify';

// --- DOM Elements ---
const form = document.getElementById('keyword-form') as HTMLFormElement;
const serviceInput = document.getElementById('service') as HTMLInputElement;
const urlInput = document.getElementById('url') as HTMLInputElement;
const locationInput = document.getElementById('location') as HTMLInputElement;
const goalInput = document.getElementById('goal') as HTMLSelectElement;
const languageInput = document.getElementById('language') as HTMLInputElement;
const generateBtn = document.getElementById('generate-btn') as HTMLButtonElement;
const btnText = document.querySelector('.btn-text') as HTMLSpanElement;
const spinner = document.querySelector('.spinner') as HTMLSpanElement;
const resultsContainer = document.getElementById('results-container') as HTMLElement;
const placeholder = document.getElementById('placeholder') as HTMLElement;
const exportControls = document.getElementById('export-controls') as HTMLElement;
const exportCsvBtn = document.getElementById('export-csv-btn') as HTMLButtonElement;
const exportJsonBtn = document.getElementById('export-json-btn') as HTMLButtonElement;


// --- State ---
let isLoading = false;

// --- Gemini AI Setup ---
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

// --- Functions ---

/**
 * Toggles the loading state of the UI.
 * @param loading - Whether to show the loading state.
 */
function setLoading(loading: boolean) {
    isLoading = loading;
    generateBtn.disabled = loading;
    spinner.hidden = !loading;
    btnText.textContent = loading ? 'Generating...' : 'Generate Keywords';
}

/**
 * Displays an error message in the results container.
 * @param message - The error message to display.
 */
function displayError(message: string) {
    resultsContainer.innerHTML = `<div class="error-message">${message}</div>`;
    exportControls.hidden = true;
}

/**
 * Builds the prompt for the Gemini API call.
 * @returns The prompt string.
 */
function buildPrompt(): string {
    const service = serviceInput.value;
    const url = urlInput.value;
    const location = locationInput.value;
    const goal = goalInput.value;
    const language = languageInput.value;

    return `
You are a world-class digital marketer and keyword/SEO specialist. Your task is to generate a comprehensive Google Ads keyword analysis based on the user's inputs.

Please generate the following based on these inputs:
- Service(s): ${service}
- Website URL: ${url}
- Location(s): ${location}
- Campaign Goal: ${goal}
- Language(s): ${language}

Produce your output in markdown format. Do not include the backticks for the markdown block in your response.

Follow this structure precisely:

### Keyword Ideas

Group keywords into themed ad groups. For each keyword, provide an estimated monthly search volume for the specified location, the 12-month trend (rising/stable/declining), the competition level (Low/Medium/High), and a suggested CPC bid range.

#### Ad Group: [Theme Name 1]
| Keyword | Monthly Search Volume | Trend (12 mo) | Competition | Suggested CPC |
|---|---|---|---|---|
| keyword example 1 | ~1,200 | stable | Medium | $1.50 - $3.00 |
| keyword example 2 | ~800 | rising | Low | $0.75 - $1.50 |

#### Ad Group: [Theme Name 2]
| Keyword | Monthly Search Volume | Trend (12 mo) | Competition | Suggested CPC |
|---|---|---|---|---|
| keyword example 3 | ~2,500 | stable | High | $3.50 - $6.00 |
| keyword example 4 | ~500 | declining | Medium | $1.00 - $2.50 |


### Priority Keywords

List the top 5-10 keywords you would recommend starting with, based on a balance of volume, relevance, and competition.

| Priority Keyword | Reason for Prioritization |
|---|---|
| keyword example 1 | High purchase intent and good volume. |
| keyword example 3 | Core service term with high volume. |


### Negative Keywords

Suggest a list of negative keywords to exclude irrelevant traffic. Use a simple bulleted list.

- DIY
- free
- jobs
- course
`;
}

/**
 * Handles the form submission to generate keywords.
 * @param event - The form submission event.
 */
async function handleFormSubmit(event: SubmitEvent) {
    event.preventDefault();
    if (isLoading) return;

    setLoading(true);
    exportControls.hidden = true;
    if (placeholder) {
        placeholder.style.display = 'none';
    }
    resultsContainer.innerHTML = ''; // Clear previous results

    const prompt = buildPrompt();

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: prompt,
        });

        const markdownContent = response.text;
        if (markdownContent) {
            const unsafeHtml = await Promise.resolve(marked.parse(markdownContent));
            const safeHtml = DOMPurify.sanitize(unsafeHtml as string);
            resultsContainer.innerHTML = safeHtml;
            exportControls.hidden = false;
        } else {
            displayError('Received an empty response from the AI. Please try again.');
        }
    } catch (error) {
        console.error('Error generating keywords:', error);
        displayError('An error occurred while generating keywords. Please check the console for details and try again.');
    } finally {
        setLoading(false);
    }
}

/**
 * Triggers a file download in the browser.
 * @param content The content of the file.
 * @param fileName The name of the file to download.
 * @param mimeType The MIME type of the file.
 */
function downloadFile(content: string, fileName: string, mimeType: string) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

/**
 * Parses the Keyword Ideas tables and exports them as a CSV file.
 */
function exportKeywordsToCSV() {
    const data: string[][] = [];
    let headers: string[] = [];

    const headings = resultsContainer.querySelectorAll('h4');
    headings.forEach(heading => {
        if (heading.textContent?.startsWith('Ad Group:')) {
            const table = heading.nextElementSibling as HTMLTableElement;
            if (table && table.tagName === 'TABLE') {
                // Capture headers from the first table found
                if (headers.length === 0) {
                    headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim());
                    data.push(headers);
                }
                // Get all body rows
                const rows = table.querySelectorAll('tbody tr');
                rows.forEach(row => {
                    const rowData = Array.from(row.querySelectorAll('td')).map(td => td.innerText.trim());
                    if (rowData.length > 0) {
                        data.push(rowData);
                    }
                });
            }
        }
    });

    if (data.length <= 1) { // Only headers
        alert("No keyword data found to export.");
        return;
    }

    const csvContent = data.map(row =>
        row.map(cell => {
            let newCell = cell.replace(/"/g, '""'); // Escape double quotes
            if (newCell.search(/("|,|\n)/g) >= 0) {
                newCell = `"${newCell}"`; // Wrap in double quotes if it contains quotes, commas, or newlines
            }
            return newCell;
        }).join(',')
    ).join('\n');

    downloadFile(csvContent, 'keyword_ideas.csv', 'text/csv;charset=utf-8;');
}

/**
 * Parses the Priority Keywords table and exports it as a JSON file.
 */
function exportPriorityKeywordsToJSON() {
    const data: { [key: string]: string }[] = [];
    const priorityHeading = Array.from(resultsContainer.querySelectorAll('h3')).find(h3 => h3.textContent?.trim() === 'Priority Keywords');
    
    if (!priorityHeading) {
        alert("No priority keywords found to export.");
        return;
    }

    const table = priorityHeading.nextElementSibling as HTMLTableElement;
    if (table && table.tagName === 'TABLE') {
        const headers = Array.from(table.querySelectorAll('th')).map(th => th.innerText.trim());
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const rowData: { [key: string]: string } = {};
            const cells = row.querySelectorAll('td');
            if (cells.length === headers.length) {
                headers.forEach((header, index) => {
                    rowData[header] = cells[index].innerText.trim();
                });
                data.push(rowData);
            }
        });
    }

    if (data.length === 0) {
        alert("No priority keywords found to export.");
        return;
    }

    const jsonContent = JSON.stringify(data, null, 2); // Pretty-print JSON
    downloadFile(jsonContent, 'priority_keywords.json', 'application/json;charset=utf-8;');
}

// --- Event Listeners ---
form.addEventListener('submit', handleFormSubmit);
exportCsvBtn.addEventListener('click', exportKeywordsToCSV);
exportJsonBtn.addEventListener('click', exportPriorityKeywordsToJSON);
