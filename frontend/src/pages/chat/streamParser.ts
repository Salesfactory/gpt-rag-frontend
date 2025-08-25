/*
 * Streaming parser utilities with markdown image validation
 * ------------------------------------------------------------
 * Exports:
 *   - ParsedEvent
 *   - parseStream(reader)
 *   - parseStreamWithMarkdownValidation(reader)
 *   - makeStream(chunks)
 */

export type ParsedEvent = { type: "json"; payload: any } | { type: "text"; payload: string };

function parseLeadingJson(text: string): { json: any; rest: string } | null {
    if (!text.startsWith("{")) return null;
    let depth = 0;
    for (let i = 0; i < text.length; i++) {
        const ch = text[i];
        if (ch === "{") depth++;
        else if (ch === "}") {
            depth--;
            if (depth === 0) {
                const blob = text.slice(0, i + 1);
                try {
                    return { json: JSON.parse(blob), rest: text.slice(i + 1) };
                } catch {
                    return null; // not valid yet
                }
            }
        }
    }
    return null; // incomplete
}

export async function* parseStream(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<ParsedEvent, void, unknown> {
    const decoder = new TextDecoder("utf-8");
    let buffer = "";

    while (true) {
        const { done, value } = await reader.read();
        if (value) buffer += decoder.decode(value, { stream: true });

        while (buffer.length) {
            const brace = buffer.indexOf("{");

            if (brace === -1) {
                yield { type: "text", payload: buffer };
                buffer = "";
                break;
            }

            if (brace > 0) {
                yield { type: "text", payload: buffer.slice(0, brace) };
                buffer = buffer.slice(brace);
            }

            const parsed = parseLeadingJson(buffer);
            if (parsed) {
                yield { type: "json", payload: parsed.json };
                buffer = parsed.rest;
            } else {
                break; // need more data
            }
        }

        if (done) {
            if (buffer) yield { type: "text", payload: buffer };
            break;
        }
    }
}

/**
 * Enhanced stream parser with markdown image validation
 * Buffers incomplete markdown images until they are complete
 */
export async function* parseStreamWithMarkdownValidation(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<ParsedEvent, void, unknown> {
    const decoder = new TextDecoder("utf-8");
    let buffer = "";
    let markdownImageBuffer = ""; // Buffer for incomplete markdown images

    // Regex to detect complete markdown images: ![Alt text](image-url "Optional Title")
    const completeMarkdownImageRegex = /!\[([^\]]*)\]\(([^)]+?)(?:\s+"([^"]*)")?\)/g;
    // Regex to detect potential start of markdown image
    const incompleteMarkdownImageRegex = /!\[([^\]]*)?(\]?\([^)]*)?$/;

    while (true) {
        const { done, value } = await reader.read();
        if (value) buffer += decoder.decode(value, { stream: true });

        while (buffer.length) {
            const brace = buffer.indexOf("{");

            if (brace === -1) {
                // No JSON found, process text with markdown validation
                const textToProcess = markdownImageBuffer + buffer;
                const processedResult = processMarkdownText(textToProcess, completeMarkdownImageRegex, incompleteMarkdownImageRegex);
                
                if (processedResult.textToYield) {
                    yield { type: "text", payload: processedResult.textToYield };
                }
                markdownImageBuffer = processedResult.remainingBuffer;
                buffer = "";
                break;
            }

            if (brace > 0) {
                // Text before JSON, process with markdown validation
                const textToProcess = markdownImageBuffer + buffer.slice(0, brace);
                const processedResult = processMarkdownText(textToProcess, completeMarkdownImageRegex, incompleteMarkdownImageRegex);
                
                if (processedResult.textToYield) {
                    yield { type: "text", payload: processedResult.textToYield };
                }
                markdownImageBuffer = processedResult.remainingBuffer;
                buffer = buffer.slice(brace);
            }

            const parsed = parseLeadingJson(buffer);
            if (parsed) {
                yield { type: "json", payload: parsed.json };
                buffer = parsed.rest;
            } else {
                break; // need more data
            }
        }

        if (done) {
            // Flush any remaining buffer when stream ends
            if (markdownImageBuffer) {
                yield { type: "text", payload: markdownImageBuffer };
            }
            if (buffer) {
                yield { type: "text", payload: buffer };
            }
            break;
        }
    }
}

/**
 * Helper function to process text with markdown image validation
 */
function processMarkdownText(
    textToProcess: string, 
    completeMarkdownImageRegex: RegExp, 
    incompleteMarkdownImageRegex: RegExp
): { textToYield: string; remainingBuffer: string } {
    // Reset regex lastIndex to ensure proper matching
    completeMarkdownImageRegex.lastIndex = 0;
    
    // Check if we have complete markdown images
    const completeImages = [...textToProcess.matchAll(completeMarkdownImageRegex)];
    
    if (completeImages.length > 0) {
        // We have complete markdown images, find the last complete one
        let lastCompleteImageEnd = 0;
        
        completeImages.forEach(match => {
            const matchEnd = match.index! + match[0].length;
            lastCompleteImageEnd = Math.max(lastCompleteImageEnd, matchEnd);
        });
        
        // Get remaining text after the last complete image
        const remainingText = textToProcess.substring(lastCompleteImageEnd);
        
        // Check if remaining text starts an incomplete markdown image
        if (remainingText && incompleteMarkdownImageRegex.test(remainingText)) {
            // Buffer the incomplete part, yield text up to last complete image
            return { 
                textToYield: textToProcess.substring(0, lastCompleteImageEnd), 
                remainingBuffer: remainingText 
            };
        } else {
            // No incomplete image pattern, yield all text
            return { textToYield: textToProcess, remainingBuffer: "" };
        }
    } else {
        // No complete images found
        // Check if the text contains an incomplete markdown image pattern
        if (incompleteMarkdownImageRegex.test(textToProcess)) {
            // Check if the incomplete pattern is at the end
            const match = textToProcess.match(incompleteMarkdownImageRegex);
            if (match && match.index !== undefined) {
                const incompleteStart = match.index;
                const textBeforeIncomplete = textToProcess.substring(0, incompleteStart);
                const incompleteText = textToProcess.substring(incompleteStart);
                
                // If there's text before the incomplete pattern, yield it
                if (textBeforeIncomplete) {
                    return { textToYield: textBeforeIncomplete, remainingBuffer: incompleteText };
                } else {
                    // Everything is potentially incomplete, buffer it all
                    return { textToYield: "", remainingBuffer: textToProcess };
                }
            }
        }
        
        // No markdown image pattern detected, yield all text
        return { textToYield: textToProcess, remainingBuffer: "" };
    }
}

/* helper for tests */
export function makeStream(chunks: string[]): ReadableStream<Uint8Array> {
    return new ReadableStream({
        start(ctrl) {
            const enc = new TextEncoder();
            chunks.forEach(c => ctrl.enqueue(enc.encode(c)));
            ctrl.close();
        }
    });
}

/**
 * Progress message types from the backend
 */
export interface ProgressMessage {
    type: "progress" | "error" | "complete";
    step?: string;
    message: string;
    progress?: number;
    timestamp?: number;
    data?: any;
}

/**
 * Check if a parsed JSON payload is a progress message
 */
export function isProgressMessage(payload: any): payload is ProgressMessage {
    return payload && 
           typeof payload === 'object' && 
           ['progress', 'error', 'complete'].includes(payload.type) &&
           typeof payload.message === 'string';
}

/**
 * Check if a parsed JSON payload is a thoughts/metadata message
 */
export function isThoughtsMessage(payload: any): boolean {
    return payload && 
           typeof payload === 'object' && 
           (payload.conversation_id || payload.thoughts || payload.images_blob_urls);
}

/**
 * Extract progress state from a progress message for the Answer component
 */
export function extractProgressState(progressMessage: ProgressMessage): {
    step: string;
    message: string;
    progress?: number;
    timestamp?: number;
} {
    return {
        step: progressMessage.step || 'processing',
        message: progressMessage.message,
        progress: progressMessage.progress,
        timestamp: progressMessage.timestamp
    };
}
