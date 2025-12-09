/**
 * PDF Parsing Utilities
 *
 * Encapsulates PDF text extraction logic using pdf2json.
 * Used by analyze-invoice and analyze-receipt API routes.
 */

// @ts-ignore - pdf2json doesn't have proper TypeScript definitions
import PDFParser from 'pdf2json';

/**
 * Extracts raw text content from a PDF buffer.
 *
 * Uses pdf2json in raw text mode to parse the PDF and extract all text content.
 * The parser events are wrapped in a Promise for async/await compatibility.
 *
 * @param buffer - The PDF file as a Buffer
 * @returns Promise resolving to the extracted text content
 * @throws Error if PDF parsing fails
 *
 * @example
 * ```typescript
 * const response = await fetch(pdfUrl);
 * const arrayBuffer = await response.arrayBuffer();
 * const buffer = Buffer.from(arrayBuffer);
 * const text = await extractTextFromPdf(buffer);
 * ```
 */
export async function extractTextFromPdf(buffer: Buffer): Promise<string> {
    return new Promise<string>((resolve, reject) => {
        // Initialize parser with raw text mode (second param = true)
        const pdfParser = new PDFParser(null, true);

        // Handle parsing errors
        pdfParser.on('pdfParser_dataError', (errData: Error | { parserError: Error }) => {
            if (errData instanceof Error) {
                reject(errData);
            } else {
                reject(errData.parserError);
            }
        });

        // Handle successful parsing
        pdfParser.on('pdfParser_dataReady', () => {
            try {
                const rawText = pdfParser.getRawTextContent();
                resolve(rawText);
            } catch (error) {
                reject(error);
            }
        });

        // Start parsing the buffer
        pdfParser.parseBuffer(buffer);
    });
}

/**
 * Checks if a URL points to a PDF file based on its extension.
 *
 * @param url - The URL to check
 * @returns true if the URL ends with .pdf (case-insensitive)
 */
export function isPdfUrl(url: string): boolean {
    return url.toLowerCase().endsWith('.pdf');
}
