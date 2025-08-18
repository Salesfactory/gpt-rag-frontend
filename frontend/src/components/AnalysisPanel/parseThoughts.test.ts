import { parseThoughts } from "./parseThoughts";
const sampleThought = `
                Model Used: gpt-4.1 / Tool Selected: General / Original Query : How has the POS changed from 2024 to 2025 / Rewritten Query: Changes in point-of-sale trends for marketing agencies from 2024 to 2025 / Required Retrieval: True / Number of documents retrieved: 1 / MCP Tool Used: Data Analyst / Context Retrieved using the rewritten query: /
Content:
Both 2024 and 2025 have **identical overall totals** for sales, units, and pieces:
| Year | POS $        | POS Units | POS Pieces |
|------|--------------|-----------|------------|
| 2024 | $322,841,553 | 305,241   | 42,050,803 |
| 2025 | $322,841,553 | 305,241   | 42,050,803 |
**Insights:**
- The POS data files for both years are identical in terms of total values.
- If you expected changes from year to year, this likely means the uploaded files are duplicates or one does not reflect new/expected 2025 data.
**Next Steps:**
Would you like to:
- Compare by category, retailer, or product for verification?
- Re-upload the correct 2025 data?
- Analyze the 2024 data for other marketing insights (top categories/brands/etc)?
Please specify your next objective!
`;
describe("parseThoughts (Jest)", () => {
  test("parses a single string thought with title from Rewritten Query and content from Content: section", () => {
    const res = parseThoughts(sampleThought);
    expect(res).toHaveLength(1);
    const t = res[0];
    expect(t.title).toBe(
      "Changes in point-of-sale trends for marketing agencies from 2024 to 2025"
    );
    expect(t.content).toContain("Both 2024 and 2025 have **identical overall totals**");
    expect(t.sources).toEqual([]); // no links in provided sample
  });
  test("parses an array of thoughts and preserves order", () => {
    const res = parseThoughts([
      sampleThought,
      "Content: Hello\n\n[Doc](https://example.com/doc)",
    ]);
    expect(res).toHaveLength(2);
    expect(res[0].title).toContain("Changes in point-of-sale trends");
    expect(res[1].title).toBe("Thought 2");
    expect(res[1].content).toContain("Hello");
    expect(res[1].sources).toEqual(["https://example.com/doc"]);
  });
  test("extracts citation-style sources [[1]](url) and regular markdown links", () => {
    const thought = `
Content:
- See background here [[1]](https://salesfactory.com/posdata2025).
- Also read [deck](https://example.com/deck.pdf)
`;
    const res = parseThoughts(thought);
    expect(res[0].sources).toEqual([
      "https://salesfactory.com/posdata2025",
      "https://example.com/deck.pdf",
    ]);
  });
  test("falls back to Original Query for title when Rewritten Query is absent", () => {
    const t = `
Model: x / Original Query : How has the POS changed from 2024 to 2025
Content: body
`;
    const res = parseThoughts(t);
    expect(res[0].title).toBe("How has the POS changed from 2024 to 2025");
    expect(res[0].content).toBe("body");
  });
  test("falls back to first heading when no query labels exist", () => {
    const t = `
### Key Takeaway
Content: Something useful
`;
    const res = parseThoughts(t);
    expect(res[0].title).toBe("Key Takeaway");
    expect(res[0].content).toBe("Something useful");
  });
  test("uses generic title if nothing else matches", () => {
    const res = parseThoughts("Just text without markers");
    expect(res[0].title).toBe("Thought 1");
    expect(res[0].content).toBe("Just text without markers");
  });
  test("detects bare URLs as sources", () => {
    const res = parseThoughts("Content: see https://example.org/path?a=1.");
    expect(res[0].sources).toEqual(["https://example.org/path?a=1"]);
  });
  /* --------------------- NEW: subquery documents scenario --------------------- */
  test("parses subquery documents inside Content (Python-like dict) and returns one block per document", () => {
    const thoughtWithSubqueries = `
        Rewritten Query: Most used social media platforms by young people in the United States in 2025
        Content:
        {'subquery_1': {
        'query': 'Identify top platforms',
        'documents': [
            {'title': 'Doc A', 'content': 'A content', 'source': 'https://a.example/docA'},
            {'title': 'Doc B', 'content': 'B content', 'source': 'https://b.example/docB'}
        ],
        'web_search_performed': False
        },
        'subquery_2': {
        'query': 'Usage statistics',
        'documents': [
            {'title': 'Doc C', 'content': 'C content', 'source': 'https://c.example/docC'}
        ],
        'web_search_performed': True
        }}
        `;
    const res = parseThoughts(thoughtWithSubqueries);
    // Should flatten to 3 documents across subqueries
    expect(res).toHaveLength(3);
    // Order should follow subquery_1 docs, then subquery_2 docs
    expect(res[0]).toEqual({
      title: "Doc A",
      content: "A content",
      sources: ["https://a.example/docA"],
    });
    expect(res[1]).toEqual({
      title: "Doc B",
      content: "B content",
      sources: ["https://b.example/docB"],
    });
    expect(res[2]).toEqual({
      title: "Doc C",
      content: "C content",
      sources: ["https://c.example/docC"],
    });
  });
  test("ignores subquery shape if no documents array exists and falls back to normal parsing", () => {
    const noDocs = `
Content:
{'subquery_1': {'query': 'x', 'document_count': 0}}
`;
    const res = parseThoughts(noDocs);
    expect(res).toHaveLength(1);
    expect(res[0].title).toBe("Thought 1");
    expect(res[0].content.trim().startsWith("{")).toBe(true); // falls back to raw content
  });
});
test("parses subquery docs when strings contain escaped apostrophes (\\')", () => {
  const thought = `
Content:
{'subquery_1': {
  'query': 'demo',
  'documents': [
    {
      'title': 'Doc with apostrophe',
      'content': 'Facebook\\'s share vs. TikTok\\'s rise',
      'source': 'https://example.com/a'
    }
  ],
  'web_search_performed': False
}}
"  `; // trailing junk is intentional
  const res = parseThoughts(thought);
  expect(res).toHaveLength(1);
  expect(res[0]).toEqual({
    title: "Doc with apostrophe",
    content: "Facebook's share vs. TikTok's rise",
    sources: ["https://example.com/a"],
  });
});