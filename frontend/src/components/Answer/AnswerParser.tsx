import { renderToStaticMarkup } from "react-dom/server";
import { getCitationFilePath } from "../../api";

type HtmlParsedAnswer = {
    answerHtml: string;
    citations: string[];
    followupQuestions: string[];
};

export function removeCitations(text: string): string {
    const newText = text.replace(/\[[^\]]*\]/g, "");
    return newText;
}

export function extractMarkdownLinks(text: string) {
    const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;

    const links = [];
    let match;
    while ((match = pattern.exec(text)) !== null) {
        const description = match[1];
        const url = match[2];
        links.push({ description, url });
    }

    return links;
}

export function replaceMarkdownLinks(text: string) {
    const pattern = /\[([^\]]+)\]\(([^)]+)\)/g;

    const result = text.replace(pattern, (_, description, url) => {
        return "[" + url + "]";
    });

    return result;
}

function replaceWrongFormattedNumbers(text: string) {
    const pattern = /\[\^(\d+)\^\]/g;

    const result = text.replace(pattern, (_, number) => {
        return `[${number}]`;
    });

    return result;
}

export function parseAnswerToHtml(
    answer: string,
    showSources: boolean,
    onCitationClicked: (citationFilePath: string, filename: string) => void
): HtmlParsedAnswer {
    const citations: string[] = [];
    const followupQuestions: string[] = [];
    var answerHtml: string = "";

    // check for any markdown links in the answer and replace them with the link text
    answer = replaceMarkdownLinks(answer);
    // Extract any wrong formatted numbers that might be in the answer
    answer = replaceWrongFormattedNumbers(answer);

    // trim any whitespace from the end of the answer after removing follow-up questions
    answer.trim();
    if (showSources) {
        const parts = answer.split(/\[\[([^\]]+)\]\]\(([^)]+)\)/gm);

        const fragments = parts.map((part, index) => {
            if (index % 3 === 0) {
                return part;
            } else if (index % 3 == 2){
                // Check if the part string contains multiple citations
                const citationParts = part.split(/,\s*/);

                const separatedCitations = citationParts.map(citationPart => {
                    let citationIndex: number;
                    if (citations.indexOf(citationPart) !== -1) {
                        citationIndex = citations.indexOf(citationPart) + 1;
                    } else {
                        citations.push(citationPart);
                        citationIndex = citations.length;
                    }

                    const path = getCitationFilePath(citationPart);
                    return {
                        index: citationIndex,
                        part: citationPart,
                        path: path
                    };
                });

                return renderToStaticMarkup(
                    <>
                        {separatedCitations.map(citation => (
                            <a
                                key={`citation-${citation.index}`}
                                className="supContainer"
                                title={citation.part}
                                onClick={() => onCitationClicked(citation.part, citation.path)}
                                tabIndex={0}
                            >
                                <sup>{citation.index}</sup>
                            </a>
                        ))}
                    </>
                );
            }
        });
        answerHtml = fragments.join("");

        for (let i = 0; i < citations.length; i++) {
            const citation = citations[i];
            answerHtml = answerHtml.replace(new RegExp(`\\[${i + 1}\\]`, "g"), renderToStaticMarkup(
                <>
                    <a
                        key={`citation-${i+1}`}
                        className="supContainer"
                        title={citation}
                        onClick={() => onCitationClicked(citation, citation)}
                        tabIndex={0}
                    >
                        <sup>{i+1}</sup>
                    </a>
                </>
            ));
        }
        answerHtml = answerHtml.split("Sources:")[0];
    } else {
        answerHtml = removeCitations(answer);
    }

    return {
        answerHtml: answerHtml,
        citations,
        followupQuestions
    };
}
