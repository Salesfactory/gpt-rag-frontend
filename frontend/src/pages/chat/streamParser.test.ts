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

    it("extracts progress markers from text stream", async () => {
        const progressData = { type: "progress", step: "init", message: "Starting...", progress: 5 };
        const metadataData = { conversation_id: "abc", thoughts: "thinking..." };
        
        const reader = makeStream([
            "Hello ",
            `__PROGRESS__${JSON.stringify(progressData)}__PROGRESS__\n`,
            "text between ",
            `__METADATA__${JSON.stringify(metadataData)}__METADATA__\n`,
            "more text"
        ]).getReader();

        const events: ParsedEvent[] = [];
        for await (const e of parseStream(reader)) events.push(e);

        expect(events).toEqual([
            { type: "text", payload: "Hello " },
            { type: "json", payload: progressData },
            { type: "text", payload: "\n" },
            { type: "text", payload: "text between " },
            { type: "json", payload: metadataData },
            { type: "text", payload: "\n" },
            { type: "text", payload: "more text" }
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

    it("extracts real-world progress markers with mixed content", async () => {
        const reader = makeStream([
            '__PROGRESS__{"type": "progress", "step": "initialization", "message": "Starting conversation...", "progress": 5, "timestamp": 1756118954.465035}__PROGRESS__\n',
            '__PROGRESS__{"type": "progress", "step": "graph_setup", "message": "Setting up conversation...", "progress": 10, "timestamp": 1756118955.904331}__PROGRESS__\n',
            '__METADATA__{"conversation_id": "8276aa20-a06b-4160-8e7f-1e3afa418986", "thoughts": ["Model Used: gpt-4.1"]}__METADATA__\n',
            '#### What Is a Creative Brief?'
        ]).getReader();

        const events: ParsedEvent[] = [];
        for await (const e of parseStreamWithMarkdownValidation(reader)) events.push(e);

        const progressEvents = events.filter(e => e.type === "json");
        expect(progressEvents).toHaveLength(3);
        expect(progressEvents[0].payload.type).toBe("progress");
        expect(progressEvents[0].payload.step).toBe("initialization");
        expect(progressEvents[1].payload.step).toBe("graph_setup");
        expect(progressEvents[2].payload.conversation_id).toBe("8276aa20-a06b-4160-8e7f-1e3afa418986");
        
        const textEvents = events.filter(e => e.type === "text");
        expect(textEvents.some(e => e.payload.includes("__PROGRESS__"))).toBe(false);
        expect(textEvents.some(e => e.payload.includes("__METADATA__"))).toBe(false);
    });
});
