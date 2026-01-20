import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import DOMPurify from "dompurify";
import { Spinner, SpinnerSize, PrimaryButton, MessageBar, MessageBarType } from "@fluentui/react";

interface MarkdownViewerProps {
    file: Blob;
}

const MAX_PREVIEW_SIZE = 100 * 1024;

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ file }) => {
    const [content, setContent] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [showFull, setShowFull] = useState<boolean>(false);
    const [isTruncated, setIsTruncated] = useState<boolean>(false);
    const [lastLoadedFile, setLastLoadedFile] = useState<Blob | null>(null);

    useEffect(() => {
        setShowFull(false);
    }, [file]);

    useEffect(() => {
        const loadContent = async () => {
            setIsLoading(true);
            setContent("");

            try {
                await new Promise(resolve => setTimeout(resolve, 100));

                const shouldUseFull = showFull || file.size <= MAX_PREVIEW_SIZE;
                const blobToRead = shouldUseFull ? file : file.slice(0, MAX_PREVIEW_SIZE);

                setIsTruncated(!shouldUseFull);

                let text = "";
                if (blobToRead.text) {
                    text = await blobToRead.text();
                } else {
                    text = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsText(blobToRead);
                    });
                }

                DOMPurify.setConfig({
                    ADD_ATTR: ["target"],
                    FORBID_TAGS: ["base", "meta"],
                    FORBID_ATTR: ["target", "onclick", "onmouseover"]
                });

                const sanitized = DOMPurify.sanitize(text);
                setContent(sanitized);
                setLastLoadedFile(file);
            } catch (error) {
                console.error("Error loading markdown:", error);
                setContent("**Error reading file**");
            } finally {
                setIsLoading(false);
            }
        };

        loadContent();
    }, [file, showFull]);

    if (isLoading || file !== lastLoadedFile) {
        return (
            <div
                style={{
                    padding: "2rem",
                    display: "flex",
                    justifyContent: "center",
                    alignItems: "center",
                    width: "100%",
                    flexDirection: "column",
                    gap: "10px"
                }}
            >
                <Spinner size={SpinnerSize.large} label={showFull ? "Rendering full document..." : "Loading preview..."} />
            </div>
        );
    }

    return (
        <div style={{ width: "100%", maxWidth: "100%", overflowX: "auto", overflowY: "auto", padding: "1rem" }}>
            {isTruncated && (
                <MessageBar
                    messageBarType={MessageBarType.warning}
                    isMultiline={true}
                    actions={
                        <div>
                            <PrimaryButton onClick={() => setShowFull(true)}>Load full document ({(file.size / (1024 * 1024)).toFixed(2)} MB)</PrimaryButton>
                        </div>
                    }
                    styles={{ root: { marginBottom: 15 } }}
                >
                    <b>Preview Mode:</b> Showing first 100KB to ensure performance. Full document may take longer to render.
                </MessageBar>
            )}

            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {content}
            </ReactMarkdown>

            {isTruncated && (
                <div style={{ marginTop: "20px", display: "flex", justifyContent: "center", paddingBottom: "20px" }}>
                    <PrimaryButton onClick={() => setShowFull(true)}>Load remaining content...</PrimaryButton>
                </div>
            )}
        </div>
    );
};

export default MarkdownViewer;
