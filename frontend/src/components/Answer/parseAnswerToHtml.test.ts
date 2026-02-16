/**
 * @file parseAnswerToHtml.spec.ts
 * Unit-tests for the pure helper — no React render, no DOMPurify.
 */

import React from "react"; // needed because parseAnswerToHtml embeds JSX strings
import { parseAnswerToHtml, removeCitationsBlock } from "./AnswerParser";

/* ------------------------------------------------------------------ */
/*  Mocks                                                              */
/* ------------------------------------------------------------------ */
jest.mock("../../providers/AppProviders", () => ({
    useAppContext: () => ({ isResizingAnalysisPanel: mockIsResizing })
}));

jest.mock("../../api", () => ({
    getCitationFilePath: (c: string) => `/docs/${c}`
}));

let mockIsResizing = false;
const noopClick = jest.fn();

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */
const imgMd = "![Sales chart](https://www.salesfactory.com/hubfs/raw_assets/public/SalesFactory-2021/images/Sales-Factory-2020-logo-white-x2.png)";

function stripTags(html: string) {
    return html.replace(/<[^>]+>/g, "");
}

/* ------------------------------------------------------------------ */
/*  Tests                                                              */
/* ------------------------------------------------------------------ */
describe("parseAnswerToHtml()", () => {
    afterEach(() => jest.clearAllMocks());


    it("strips citations, removes Citations block, but keeps image url and other links when showSources = false", () => {
        const md = `Text before\n${imgMd}\nSee [[1]](Report.pdf)\n**Citations:**\n[[1]](Report.pdf)\n[[2]](Other.pdf)`;
        const { answerHtml, citations } = parseAnswerToHtml(md, false, noopClick);

        expect(citations).toHaveLength(0);
        expect(answerHtml).toContain(imgMd); // image preserved verbatim
        expect(answerHtml).not.toMatch(/data-citation-index=/); // no citation markup
        expect(stripTags(answerHtml)).not.toContain("[[1]]");
        expect(answerHtml).not.toMatch(/Citations:/i); // Citations block removed
        expect(answerHtml).not.toMatch(/Other.pdf/); // Citations block links removed
    });
    it("removes Citations block at the end even when showSources = true", () => {
        mockIsResizing = false;
        const md = `Intro [[1]](A.pdf), again [[2]](B.pdf)\n**Citations:**\n[[1]](A.pdf)\n[[2]](B.pdf)`;
        const { answerHtml, citations } = parseAnswerToHtml(md, true, noopClick);

        expect(citations).toEqual(["A.pdf", "B.pdf"]);
        expect(answerHtml).toMatch(/data-citation-index="1"/);
        expect(answerHtml).toMatch(/data-citation-index="2"/);
        expect(answerHtml).toMatch(/\[1\]/);
        expect(answerHtml).toMatch(/\[2\]/);
        expect(answerHtml).not.toMatch(/Citations:/i);
        expect(answerHtml).not.toMatch(/\[\[1\]\]/); // no raw citation
        expect(answerHtml).not.toMatch(/A.pdf\s*$/); // no trailing citation block
    });
    it("removes Citations block at the end when resizing", () => {
        mockIsResizing = true;
        const md = `Doc [[1]](A.pdf)\n**Citations:**\n[[1]](A.pdf)`;
        const { answerHtml } = parseAnswerToHtml(md, true, noopClick);

        expect(answerHtml).not.toMatch(/Citations:/i);
        expect(answerHtml).not.toMatch(/\[\[1\]\]/);
        expect(answerHtml).not.toMatch(/A.pdf\s*$/);
    });

    it("converts citations to inline citation badges when showSources = true & not resizing", () => {
        mockIsResizing = false;
        const md = `Intro [[1]](A.pdf), again [[2]](B.pdf)`;
        const { answerHtml, citations } = parseAnswerToHtml(md, true, noopClick);

        expect(citations).toEqual(["A.pdf", "B.pdf"]);
        expect(answerHtml).toMatch(/data-citation-url="A.pdf"/);
        expect(answerHtml).toMatch(/data-citation-path="\/docs\/A.pdf"/);
        expect(answerHtml).toMatch(/data-citation-index="1"/);
        expect(answerHtml).toMatch(/\[1\]/);
        expect(answerHtml).toMatch(/data-citation-url="B.pdf"/);
        expect(answerHtml).toMatch(/data-citation-path="\/docs\/B.pdf"/);
        expect(answerHtml).toMatch(/data-citation-index="2"/);
        expect(answerHtml).toMatch(/\[2\]/);
        expect(answerHtml).not.toMatch(/citationInlineIcon/);
    });

    it("renders public document URLs as web citations with favicon metadata", () => {
        mockIsResizing = false;
        const md = `Public doc [[1]](https://example.com/report.pdf)`;
        const { answerHtml, citations } = parseAnswerToHtml(md, true, noopClick);

        expect(citations).toEqual(["https://example.com/report.pdf"]);
        expect(answerHtml).toMatch(/data-citation-url="https:\/\/example\.com\/report\.pdf"/);
        expect(answerHtml).toMatch(/data-citation-path="https:\/\/example\.com\/report\.pdf"/);
        expect(answerHtml).toMatch(/citationInlineIcon/);
    });

    it("behaves like citation-stripping mode when analysis panel is resizing", () => {
        mockIsResizing = true;
        const md = `Doc [[1]](A.pdf)`;
        const { answerHtml } = parseAnswerToHtml(md, true, noopClick);

        expect(answerHtml).not.toMatch(/data-citation-index=/);
        expect(answerHtml).not.toContain("[[1]]");
    });

    it("handles multiple identical citations without duplicating numbers", () => {
        mockIsResizing = false;
        const md = `A [[1]](Same.pdf) then again [[1]](Same.pdf)`;
        const { answerHtml, citations } = parseAnswerToHtml(md, true, noopClick);

        expect(citations).toEqual(["Same.pdf"]); // deduped
        expect(answerHtml.match(/data-citation-index="1"/g)).toHaveLength(2);
    });

    it('handles citations with parentheses in filename', () => {
        mockIsResizing = false;
        const md = 'File [[1]](megustalaarepa(1).xlsx) and [[2]](file(2).pdf)';
        const { answerHtml, citations } = parseAnswerToHtml(md, true, noopClick);

        expect(citations).toEqual(['megustalaarepa(1).xlsx', 'file(2).pdf']);
        expect(answerHtml).toMatch(/data-citation-index="1"/);
        expect(answerHtml).toMatch(/data-citation-index="2"/);
        expect(answerHtml).not.toContain('[[1]]');
        expect(answerHtml).not.toContain('[[2]]');
    });

    it("inserts a newline before attached hash markers when showSources = false", () => {
        mockIsResizing = false;
        const md = "I'll show examples to illustrate the framework together.#### Here's How Great Creative Briefs Come to Life";
        const { answerHtml } = parseAnswerToHtml(md, false, noopClick);

        expect(answerHtml).toContain("together.\n#### Here's How Great Creative Briefs Come to Life");
    });

    it("inserts a newline before attached hash markers when showSources = true", () => {
        mockIsResizing = false;
        const md = "I'll show examples to illustrate the framework together.#### Here's How Great Creative Briefs Come to Life";
        const { answerHtml } = parseAnswerToHtml(md, true, noopClick);

        expect(answerHtml).toContain("together.\n#### Here's How Great Creative Briefs Come to Life");
    });

    it("does not split hash markers inside protected URL/code/link/image regions", () => {
        mockIsResizing = false;
        const md = [
            "URL https://example.com/page#section",
            "Inline `C# and #tag` stays.",
            "```ts",
            'const lang = "C#";',
            "# inside code fence",
            "```",
            "[Docs](https://example.com/page#anchor)",
            "![Alt](https://example.com/image#frag.png)",
            "Sentence.#### Heading"
        ].join("\n\n");
        const { answerHtml } = parseAnswerToHtml(md, false, noopClick);

        expect(answerHtml).toContain("https://example.com/page#section");
        expect(answerHtml).not.toContain("https://example.com/page\n#section");
        expect(answerHtml).toContain("`C# and #tag`");
        expect(answerHtml).not.toContain("`C\n# and #tag`");
        expect(answerHtml).toContain('const lang = "C#";');
        expect(answerHtml).not.toContain('const lang = "C\n#";');
        expect(answerHtml).toContain("[https://example.com/page#anchor]");
        expect(answerHtml).not.toContain("[https://example.com/page\n#anchor]");
        expect(answerHtml).toContain("![Alt](https://example.com/image#frag.png)");
        expect(answerHtml).not.toContain("![Alt](https://example.com/image\n#frag.png)");
        expect(answerHtml).toContain("Sentence.\n#### Heading");
    });

    it("keeps hash normalization idempotent when parsing repeatedly", () => {
        mockIsResizing = false;
        const md = "Sentence.\n#### Heading";
        const firstPass = parseAnswerToHtml(md, false, noopClick).answerHtml;
        const secondPass = parseAnswerToHtml(firstPass, false, noopClick).answerHtml;

        expect(firstPass).toBe(md);
        expect(secondPass).toBe(md);
    });
});

describe("removeCitationsBlock()", () => {
    it("removes only the Citations block at the end (markdown)", () => {
        const md = `Text before\nSome content\n**Citations:**\n[[1]](A.pdf)\n[[2]](B.pdf)`;
        const result = removeCitationsBlock(md);
        expect(result).toBe(`Text before\nSome content`);
    });

    it("removes only the Citations block at the end (markdown heading)", () => {
        const md = `Text before\n#### Citations\n[[1]](A.pdf)\n[[2]](B.pdf)`;
        const result = removeCitationsBlock(md);
        expect(result).toBe(`Text before`);
    });

    it("removes only the Sources block at the end (markdown)", () => {
        const md = `Text before\nSome content\n**Sources:**\n[[1]](A.pdf)\n[[2]](B.pdf)`;
        const result = removeCitationsBlock(md);
        expect(result).toBe(`Text before\nSome content`);
    });

    it("removes only the Fuentes block at the end (markdown heading)", () => {
        const md = `Text before\n#### Fuentes\n[[1]](A.pdf)\n[[2]](B.pdf)`;
        const result = removeCitationsBlock(md);
        expect(result).toBe(`Text before`);
    });

    it("returns original text if no Citations block is present", () => {
        const md = `Text without citations`;
        const result = removeCitationsBlock(md);
        expect(result).toBe(md);
    });
});
