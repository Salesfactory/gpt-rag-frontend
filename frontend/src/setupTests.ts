import { ReadableStream } from "node:stream/web"; // ✅ only this comes from stream/web

// expose to Jest’s global scope
(globalThis as any).ReadableStream = ReadableStream;

/*
 * TextEncoder / TextDecoder
 * -------------------------
 * 1. If Node >= 18     → they already exist on globalThis, nothing to do.
 * 2. If Node 16 / 14   → pull them from 'util' and attach.
 */
if (typeof (globalThis as any).TextEncoder === "undefined") {
    const { TextEncoder, TextDecoder } = require("util");
    (globalThis as any).TextEncoder = TextEncoder;
    (globalThis as any).TextDecoder = TextDecoder;
}

/* optional – keep your Testing-Library matcher import */
import "@testing-library/jest-dom";
