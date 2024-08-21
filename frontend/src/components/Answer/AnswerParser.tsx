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

export function parseAnswerToHtml(
    answer: string,
    showSources: boolean,
    onCitationClicked: (citationFilePath: string, filename: string) => void
): HtmlParsedAnswer {
    const citations: string[] = [];
    const followupQuestions: string[] = [];
    var answerHtml: string = "";

    // Extract any follow-up questions that might be in the answer
    let parsedAnswer = answer.replace(/<<([^>>]+)>>/g, (match, content) => {
        followupQuestions.push(content);
        return "";
    });

    // trim any whitespace from the end of the answer after removing follow-up questions
    parsedAnswer.trim();
    if (showSources) {
        parsedAnswer;
        const parts = parsedAnswer.split(/\[([^\]]+)\]/g);

        const fragments: string[] = parts.map((part, index) => {
            if (index % 2 === 0) {
                return part;
            } else {
                var reg = /^\d+$/;
                if (reg.test(part)) {
                    return `[${part}]`;
                }

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
        answerHtml = removeCitations(parsedAnswer);
    }

    return {
        answerHtml: answerHtml,
        citations,
        followupQuestions
    };
}
