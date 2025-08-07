import { parseStream, makeStream, ParsedEvent } from "./streamParser";

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
