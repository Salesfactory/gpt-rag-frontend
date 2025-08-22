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
        expect(answerHtml).not.toMatch(/<sup>/); // no citation markup
        expect(stripTags(answerHtml)).not.toContain("[[1]]");
        expect(answerHtml).not.toMatch(/Citations:/i); // Citations block removed
        expect(answerHtml).not.toMatch(/Other.pdf/); // Citations block links removed
    });
    it("removes Citations block at the end even when showSources = true", () => {
        mockIsResizing = false;
        const md = `Intro [[1]](A.pdf), again [[2]](B.pdf)\n**Citations:**\n[[1]](A.pdf)\n[[2]](B.pdf)`;
        const { answerHtml, citations } = parseAnswerToHtml(md, true, noopClick);

        expect(citations).toEqual(["A.pdf", "B.pdf"]);
        expect(answerHtml).toMatch(/<sup>1<\/sup>/);
        expect(answerHtml).toMatch(/<sup>2<\/sup>/);
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

    it("converts citations to <sup> when showSources = true & not resizing", () => {
        mockIsResizing = false;
        const md = `Intro [[1]](A.pdf), again [[2]](B.pdf)`;
        const { answerHtml, citations } = parseAnswerToHtml(md, true, noopClick);

        expect(citations).toEqual(["A.pdf", "B.pdf"]);
        expect(answerHtml).toMatch(/<sup>1<\/sup>/);
        expect(answerHtml).toMatch(/<sup>2<\/sup>/);
    });

    it("behaves like citation-stripping mode when analysis panel is resizing", () => {
        mockIsResizing = true;
        const md = `Doc [[1]](A.pdf)`;
        const { answerHtml } = parseAnswerToHtml(md, true, noopClick);

        expect(answerHtml).not.toMatch(/<sup>/);
        expect(answerHtml).not.toContain("[[1]]");
    });

    it("handles multiple identical citations without duplicating numbers", () => {
        mockIsResizing = false;
        const md = `A [[1]](Same.pdf) then again [[1]](Same.pdf)`;
        const { answerHtml, citations } = parseAnswerToHtml(md, true, noopClick);

        expect(citations).toEqual(["Same.pdf"]); // deduped
        expect(answerHtml.match(/<sup>1<\/sup>/g)).toHaveLength(2);
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

    it("returns original text if no Citations block is present", () => {
        const md = `Text without citations`;
        const result = removeCitationsBlock(md);
        expect(result).toBe(md);
    });
});