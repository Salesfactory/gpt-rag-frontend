import { parseStream, parseStreamWithMarkdownValidation, makeStream, ParsedEvent } from "./streamParser";

describe("parseStream", () => {
    it("emits text → json → text in order", async () => {
        const reader = makeStream(["Hello ", '{"conversation_id":"abc"}', " ![alt](https://img) more text"]).getReader();

        const events: ParsedEvent[] = [];
        for await (const e of parseStream(reader)) events.push(e);

        expect(events).toEqual([
            { type: "text", payload: "Hello " },
            { type: "json", payload: { conversation_id: "abc" } },
            { type: "text", payload: " ![alt](https://img) more text" }
        ]);
    });
});

describe("parseStreamWithMarkdownValidation", () => {
    it("emits text → json → text in order (same as regular parser for complete markdown)", async () => {
        const reader = makeStream(["Hello ", '{"conversation_id":"abc"}', " ![alt](https://img) more text"]).getReader();

        const events: ParsedEvent[] = [];
        for await (const e of parseStreamWithMarkdownValidation(reader)) events.push(e);

        expect(events).toEqual([
            { type: "text", payload: "Hello " },
            { type: "json", payload: { conversation_id: "abc" } },
            { type: "text", payload: " ![alt](https://img) more text" }
        ]);
    });

    it("buffers incomplete markdown images until complete", async () => {
        const reader = makeStream([
            "Some text ![incomplete", 
            "](https://example.com/image.png) complete image"
        ]).getReader();

        const events: ParsedEvent[] = [];
        for await (const e of parseStreamWithMarkdownValidation(reader)) events.push(e);

        expect(events).toEqual([
            { type: "text", payload: "Some text " },
            { type: "text", payload: "![incomplete](https://example.com/image.png) complete image" }
        ]);
    });

    it("handles multiple markdown images in chunks", async () => {
        const reader = makeStream([
            "Text ![img1](url1) and ![img", 
            "2](url2) more text"
        ]).getReader();

        const events: ParsedEvent[] = [];
        for await (const e of parseStreamWithMarkdownValidation(reader)) events.push(e);

        expect(events).toEqual([
            { type: "text", payload: "Text ![img1](url1)" },
            { type: "text", payload: " and ![img2](url2) more text" }
        ]);
    });

    it("handles markdown images with titles", async () => {
        const reader = makeStream([
            "Text ![alt](url ", 
            '"title") more text'
        ]).getReader();

        const events: ParsedEvent[] = [];
        for await (const e of parseStreamWithMarkdownValidation(reader)) events.push(e);

        expect(events).toEqual([
            { type: "text", payload: "Text " },
            { type: "text", payload: '![alt](url "title") more text' }
        ]);
    });

    it("handles incomplete markdown at end of stream", async () => {
        const reader = makeStream([
            "Complete text and ![incomplete"
        ]).getReader();

        const events: ParsedEvent[] = [];
        for await (const e of parseStreamWithMarkdownValidation(reader)) events.push(e);

        expect(events).toEqual([
            { type: "text", payload: "Complete text and " },
            { type: "text", payload: "![incomplete" }
        ]);
    });

    it("processes regular text without markdown normally", async () => {
        const reader = makeStream([
            "Just regular text ", 
            "with no markdown images"
        ]).getReader();

        const events: ParsedEvent[] = [];
        for await (const e of parseStreamWithMarkdownValidation(reader)) events.push(e);

        expect(events).toEqual([
            { type: "text", payload: "Just regular text " },
            { type: "text", payload: "with no markdown images" }
        ]);
    });
});
