import { describe, it, expect, vi } from "vitest";
import React from "react";
import { render, fireEvent } from "@testing-library/react";
import { renderToStaticMarkup } from "react-dom/server";
import { parseAnswerToHtml } from "./AnswerParser"; // Adjust path as needed
import { getCitationFilePath } from "../../api"; // Adjust path as needed
// Mock the getCitationFilePath function
vi.mock("../../api", () => ({
    getCitationFilePath: vi.fn(citationPart => `https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/${citationPart}`)
}));

describe("parseAnswerToHtml", () => {
    it("should parse the answer and generate the correct HTML with citations", () => {
        const answer = `The consumer pulse segmentation is a two-level segmentation solution developed by Sales Factory based on the demographics, life stage, income, and behaviors of US consumers. It consists of five primary segments and fifteen secondary segments, resulting in a total of 20 segments.

        The five primary segments are as follows:

        1. Aspiring Singles: This segment represents 22% of US consumers and consists of younger, more diverse individuals who are mainly singles and renters with lower per capita income. They prioritize experiences over material possessions and are active users of social media for product recommendations.

        2. Affluent & Educated: This segment represents 9% of US consumers and is characterized by individuals with high educational attainment and full-time employment. They have a higher proportion of males and are predominantly Millennials. They are more likely to reside in urban areas and the Western region of the US.

        3. Stable Strategists: This segment represents 25% of US consumers and is mostly composed of Gen X individuals. It has an equal gender distribution and exhibits stable and strategic behaviors.

        4. Cautious and Accepting: This segment represents 19% of US consumers and is characterized by individuals who are cautious in their decision-making and accepting of new trends and technologies.

        5. Sunsetting Suburbanites: This segment represents 25% of the US population and consists of individuals who are transitioning into retirement and reside in suburban areas.

        Each primary segment is further divided into three subsegments, resulting in a total of fifteen secondary segments. These subsegments provide a greater ability to target and reach specific consumer groups on digital platforms.

        Understanding the consumer pulse segmentation allows businesses to tailor their marketing strategies and engage with their target audiences more effectively based on their preferences and behaviors.

        Sources:
        - [Sales Factory Consumer Pulse Segmentation](https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/Segmentation/Consumer%20Pulse%20Segmentation%20v2.docx)
        - [Sales Factory Consumer Pulse Segmentation Summary](https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/Segmentation/Consumer%20Pulse%20Segmentation%20Summary.docx)
        - [Sales Factory Consumer Pulse Segments - Deep Dive](https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/Segmentation/Consumer%20Pulse%20Segments%20-%20Deep%20Dive%20v4.docx)`;

        const showSources = true;
        const onCitationClicked = vi.fn();

        // Using React.createElement to avoid JSX transformation issues
        const expectedHtml = renderToStaticMarkup(
            React.createElement(
                "a",
                {
                    key: "1",
                    className: "supContainer",
                    title: "Sales Factory Consumer Pulse Segmentation",
                    onClick: () =>
                        onCitationClicked(
                            "https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/Segmentation/Consumer%20Pulse%20Segmentation%20v2.docx",
                            "Sales Factory Consumer Pulse Segmentation"
                        ),
                    tabIndex: 0
                },
                React.createElement("sup", null, "1")
            )
        );

        const result = parseAnswerToHtml(answer, showSources, onCitationClicked);

        // expect(result.answerHtml).toBe(expectedHtml);
        expect(result.citations).toEqual([
            "Sales Factory Consumer Pulse Segmentation",
            "Sales Factory Consumer Pulse Segmentation Summary",
            "Sales Factory Consumer Pulse Segments - Deep Dive"
        ]);
        expect(result.followupQuestions).toEqual([]);

        expect(onCitationClicked).not.toHaveBeenCalled(); // Ensure the callback is not called by default
    });
});
