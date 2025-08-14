// src/utils/parseThoughts.ts

export interface ThoughtBlock {
  title: string;
  content: string;
  sources: string[];
}

/**
 * Normalize "thoughts" (string | string[]) into an array of { title, content, sources }.
 *
 * Behaviors:
 * - If a thought has a "Content:" block containing a Python-ish object with subqueries:
 *     { 'subquery_1': { documents: [ { title, content, source }, ... ] }, ... }
 *   → returns ONE ThoughtBlock per document (flattened across subqueries).
 * - Otherwise, returns ONE ThoughtBlock per thought (title inferred from labels/headings).
 *
 * Robustness:
 * - Tolerates single-quoted strings, escaped apostrophes (\\'), Python True/False/None.
 * - Slices a balanced {...} object even if there's trailing junk (e.g., a quote) after it.
 * - If the whole object can't be parsed, falls back to scanning every "documents": [ ... ]
 *   array, parsing each object inside individually.
 */
export function parseThoughts(thoughts: unknown): ThoughtBlock[] {
  const arr = normalizeThoughtsToArray(thoughts);
  const out: ThoughtBlock[] = [];

  for (let i = 0; i < arr.length; i++) {
    const t = arr[i];

    // Prefer subquery-docs if present
    const subDocs = extractSubqueryDocuments(t);
    if (subDocs.length) {
      out.push(...subDocs);
      continue;
    }

    // Fallback: one block per thought
    const title =
      extractLabel(t, "Rewritten Query") ||
      extractLabel(t, "Original Query") ||
      extractFirstHeading(t) ||
      `Thought ${out.length + 1}`;

    const content = extractContentSection(t).trim();

    // Format Markdown to plain text
    const processedContent = formatMarkdownToPlainText(content);

    const sources = dedupe([...extractSources(processedContent), ...extractSources(t)]);
    out.push({ title, content: processedContent, sources });
  }

  return out;
}

/* ------------------------------- helpers -------------------------------- */

function normalizeThoughtsToArray(v: unknown): string[] {
  if (typeof v === "string") return [v];
  if (Array.isArray(v)) return v.filter((x): x is string => typeof x === "string");
  return [];
}

/** Pull text after "Content:" (case-insensitive). If absent, return input unchanged. */
function extractContentSection(s: string): string {
  const idx = s.search(/\bContent\s*:/i);
  if (idx === -1) return s;
  const sliced = s.slice(idx);
  // remove up to and including the "Content:" label at line start
  return sliced.replace(/^[^\n\r]*?\bContent\s*:\s*/i, "");
}

function extractLabel(s: string, label: string): string | null {
  // e.g. "Rewritten Query: something" (until slash or newline)
  const re = new RegExp(`${label}\\s*:\\s*([^/\\r\\n]+)`);
  const m = s.match(re);
  return m ? m[1].trim() : null;
}

function extractFirstHeading(s: string): string | null {
  const m = s.match(/^\s*#{1,6}\s+(.+)$/m);
  return m ? m[1].trim() : null;
}

function dedupe<T>(xs: T[]): T[] {
  return Array.from(new Set(xs));
}

function extractSources(s: string): string[] {
  const out: string[] = [];
  // [[1]](url)
  for (const m of s.matchAll(/\[\[\d+\]\]\((https?:\/\/[^)\s]+)\)/g)) out.push(cleanUrl(m[1]));
  // [text](url)  (includes images; fine here)
  for (const m of s.matchAll(/\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g)) out.push(cleanUrl(m[2]));
  // bare URLs not immediately following '(' or ']('
  for (const m of s.matchAll(/(?<!\()(?<!\]\()(?<!["'])\bhttps?:\/\/[^\s)]+/g)) out.push(cleanUrl(m[0]));
  return dedupe(out);
}

function cleanUrl(u: string): string {
  return u.replace(/[),.;:!?]+$/g, "");
}

/* ----------------- subquery documents extractor (hardened) ---------------- */

function extractSubqueryDocuments(raw: string): ThoughtBlock[] {
  const content = extractContentSection(raw).trim();

  // 1) Try: single balanced object that contains all subqueries
  const firstBrace = content.indexOf("{");
  if (firstBrace !== -1) {
    const objSlice = sliceBalancedObject(content, firstBrace);
    if (objSlice) {
      const obj = looseJsonObjectParse(objSlice);
      if (obj && typeof obj === "object") {
        const blocks = docsFromSubqueryObject(obj);
        if (blocks.length) return blocks;
      }
    }
  }

  // 2) Fallback: scan for every "documents": [ ... ] array and parse each object inside
  return fallbackExtractFromDocumentsArrays(content);
}

function docsFromSubqueryObject(obj: any): ThoughtBlock[] {
  const out: ThoughtBlock[] = [];
  for (const k of Object.keys(obj as Record<string, any>)) {
    const v = (obj as any)[k];
    const docs = v && Array.isArray(v.documents) ? v.documents : [];
    for (const d of docs) {
      if (!d) continue;
      const title = (d.title ?? "").toString() || "Untitled";
      const content = (d.content ?? "").toString();
      const src = (d.source ?? "").toString();
      out.push({ title, content, sources: src ? [src] : [] });
    }
  }
  return out;
}

/** Scan the string for every quoted/unquoted "documents" key and parse its array value. */
function fallbackExtractFromDocumentsArrays(s: string): ThoughtBlock[] {
  const out: ThoughtBlock[] = [];
  const docKeyRe = /(["'])?documents\1?\s*:/gi;

  for (const m of s.matchAll(docKeyRe)) {
    let i = (m.index ?? 0) + m[0].length;
    // skip whitespace until '['
    while (i < s.length && /\s/.test(s[i])) i++;
    if (s[i] !== "[") continue;

    const arrSlice = sliceBalancedArray(s, i);
    if (!arrSlice) continue;

    // Walk the array and collect each balanced object inside
    let j = 0;
    while (j < arrSlice.length) {
      const brace = arrSlice.indexOf("{", j);
      if (brace === -1) break;
      const objSlice = sliceBalancedObject(arrSlice, brace);
      if (!objSlice) break;
      const obj = looseJsonObjectParse(objSlice);
      if (obj && typeof obj === "object") {
        const title = (obj.title ?? "").toString() || "Untitled";
        const content = (obj.content ?? "").toString();
        const src = (obj.source ?? "").toString();
        out.push({ title, content, sources: src ? [src] : [] });
      }
      j = brace + objSlice.length;
    }
  }

  return out;
}

/** Returns a substring containing one balanced {...} object starting at `start`, or null. */
function sliceBalancedObject(s: string, start: number): string | null {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let esc = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }

    if (!inDouble && ch === "'") { inSingle = !inSingle; continue; }
    if (!inSingle && ch === '"') { inDouble = !inDouble; continue; }

    if (inSingle || inDouble) continue;

    if (ch === "{") {
      depth++;
    } else if (ch === "}") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/** Returns a substring containing one balanced [...] array starting at `start`, or null. */
function sliceBalancedArray(s: string, start: number): string | null {
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let esc = false;

  for (let i = start; i < s.length; i++) {
    const ch = s[i];

    if (esc) { esc = false; continue; }
    if (ch === "\\") { esc = true; continue; }

    if (!inDouble && ch === "'") { inSingle = !inSingle; continue; }
    if (!inSingle && ch === '"') { inDouble = !inDouble; continue; }

    if (inSingle || inDouble) continue;

    if (ch === "[") {
      depth++;
    } else if (ch === "]") {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

/**
 * Parse Python-ish / JSON-ish object text into a JS object:
 *  - single quotes → double quotes
 *  - fix invalid JSON escape \\' → ' inside those strings
 *  - Python True/False/None → JS true/false/null (outside strings)
 */
function looseJsonObjectParse(text: string): any | null {
  if (!/^\s*[{]/.test(text)) return null;

  // 1) Convert single-quoted strings to JSON double-quoted strings.
  // eslint-disable-next-line no-control-regex
  const singleQuotedString = /'([^'\\]*(?:\\.[^'\\]*)*)'/g;

  let converted = text.replace(singleQuotedString, (_m, inner) => {
    // Fix invalid JSON escape \' by removing the backslash
    const unescapedApostrophes = inner.replace(/\\'/g, "'");
    // Keep backslashes; only escape inner double quotes for JSON
    const safe = unescapedApostrophes.replace(/"/g, '\\"');
    return `"${safe}"`;
  });

  // 2) Python literals to JS (only outside strings)
  converted = replacePythonLiteralsOutsideStrings(converted);

  try {
    return JSON.parse(converted);
  } catch {
    return null;
  }
}

function replacePythonLiteralsOutsideStrings(s: string): string {
  let out = "";
  let inSingle = false;
  let inDouble = false;
  let esc = false;

  const tryReplace = (i: number, literal: string, replacement: string): number | null => {
    if (s.startsWith(literal, i)) {
      const before = s[i - 1];
      const after = s[i + literal.length];
      const isWord = (ch?: string) => !!ch && /\w/.test(ch);
      if (!isWord(before) && !isWord(after)) {
        out += replacement;
        return i + literal.length;
      }
    }
    return null;
  };

  for (let i = 0; i < s.length; i++) {
    const ch = s[i];

    if (esc) { out += ch; esc = false; continue; }
    if (ch === "\\") { out += ch; esc = true; continue; }

    if (!inDouble && ch === "'") { inSingle = !inSingle; out += ch; continue; }
    if (!inSingle && ch === '"') { inDouble = !inDouble; out += ch; continue; }

    if (!inSingle && !inDouble) {
      const t1 = tryReplace(i, "True", "true");  if (t1 !== null) { i = t1 - 1; continue; }
      const t2 = tryReplace(i, "False", "false"); if (t2 !== null) { i = t2 - 1; continue; }
      const t3 = tryReplace(i, "None", "null");   if (t3 !== null) { i = t3 - 1; continue; }
    }

    out += ch;
  }
  return out;
}

function formatMarkdownToPlainText(content: string): string {
  if (!content) return '';
  return content
    .replace(/^\s*[=-]{3,}\s*$/gm, '')
    .trim();
}