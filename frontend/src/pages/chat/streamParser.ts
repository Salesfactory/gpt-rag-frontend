/*
 * Streaming parser utilities (image-preview buffering removed)
 * ------------------------------------------------------------
 * Exports:
 *   - ParsedEvent
 *   - parseStream(reader)
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
