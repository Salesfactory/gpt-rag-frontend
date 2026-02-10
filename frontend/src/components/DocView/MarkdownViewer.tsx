import React, { useState, useEffect, useMemo, useRef, useCallback } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import DOMPurify from "dompurify";
import { Spinner, SpinnerSize, PrimaryButton } from "@fluentui/react";

interface MarkdownViewerProps {
    file: Blob;
}

const CHARS_PER_CHUNK = 6000;
const INITIAL_CHUNK_COUNT = 4;
const CHUNKS_PER_BATCH = 3;
const SCROLL_LOAD_THRESHOLD = 200;

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ file }) => {
    const [content, setContent] = useState<string>("");
    const [visibleChunkCount, setVisibleChunkCount] = useState<number>(INITIAL_CHUNK_COUNT);
    const [loadId, setLoadId] = useState<number>(0);
    const [loadedId, setLoadedId] = useState<number>(-1);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const scrollContainerRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        // Start new load cycle
        setIsLoading(true);
        setContent("");
        setLoadId(prev => prev + 1);
    }, [file]);

    useEffect(() => {
        let isMounted = true;
        const currentId = loadId;

        const loadContent = async () => {
            try {
                await new Promise(resolve => setTimeout(resolve, 100));

                let text = "";
                if (file.text) {
                    text = await file.text();
                } else {
                    text = await new Promise<string>((resolve, reject) => {
                        const reader = new FileReader();
                        reader.onload = () => resolve(reader.result as string);
                        reader.onerror = reject;
                        reader.readAsText(file);
                    });
                }

                DOMPurify.setConfig({
                    ADD_ATTR: ["target"],
                    FORBID_TAGS: ["base", "meta"],
                    FORBID_ATTR: ["target", "onclick", "onmouseover"]
                });

                const sanitized = DOMPurify.sanitize(text);

                if (isMounted && currentId === loadId) {
                    setContent(sanitized);
                    setLoadedId(currentId);
                }
            } catch (error) {
                console.error("Error loading markdown:", error);
                if (isMounted && currentId === loadId) {
                    setContent("**Error reading file**");
                    setLoadedId(currentId);
                }
            } finally {
                if (isMounted && currentId === loadId) {
                    setIsLoading(false);
                }
            }
        };

        loadContent();

        return () => {
            isMounted = false;
        };
    }, [file, loadId]);

    const markdownChunks = useMemo(() => {
        if (!content.trim()) {
            return [];
        }

        const normalized = content.replace(/\r\n/g, "\n");
        const lines = normalized.split("\n");
        const chunks: string[] = [];
        let buffer: string[] = [];
        let bufferLength = 0;
        let insideFence = false;

        const flushBuffer = () => {
            if (buffer.length) {
                chunks.push(buffer.join("\n"));
                buffer = [];
                bufferLength = 0;
            }
        };

        lines.forEach(line => {
            const trimmed = line.trim();
            if (trimmed.startsWith("```")) {
                insideFence = !insideFence;
            }

            buffer.push(line);
            bufferLength += line.length + 1;

            if (!insideFence && bufferLength >= CHARS_PER_CHUNK) {
                flushBuffer();
            }
        });

        flushBuffer();

        return chunks.length ? chunks : [normalized];
    }, [content]);

    useEffect(() => {
        setVisibleChunkCount(prev => {
            if (!markdownChunks.length) {
                return INITIAL_CHUNK_COUNT;
            }
            return Math.min(INITIAL_CHUNK_COUNT, markdownChunks.length);
        });

        if (scrollContainerRef.current) {
            scrollContainerRef.current.scrollTop = 0;
        }
    }, [markdownChunks, file]);

    const loadMoreChunks = useCallback(() => {
        if (!markdownChunks.length) {
            return;
        }

        setVisibleChunkCount(prev => {
            if (prev >= markdownChunks.length) {
                return prev;
            }

            const nextCount = Math.min(prev + CHUNKS_PER_BATCH, markdownChunks.length);
            return nextCount;
        });
    }, [markdownChunks]);

    const handleScroll = useCallback(() => {
        const container = scrollContainerRef.current;
        if (!container) {
            return;
        }

        if (markdownChunks.length <= visibleChunkCount) {
            return;
        }

        const { scrollTop, clientHeight, scrollHeight } = container;
        if (scrollHeight - (scrollTop + clientHeight) <= SCROLL_LOAD_THRESHOLD) {
            loadMoreChunks();
        }
    }, [loadMoreChunks, markdownChunks.length, visibleChunkCount]);

    const hasMoreChunks = markdownChunks.length > visibleChunkCount;

    if (isLoading || loadedId !== loadId) {
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
                <Spinner size={SpinnerSize.large} label="Loading document..." />
            </div>
        );
    }

    if (!content.trim()) {
        return <div style={{ padding: "1rem", textAlign: "center", color: "#555" }}>No content to display.</div>;
    }

    return (
        <div style={{ width: "100%", maxWidth: "100%", overflowX: "auto", overflowY: "auto", padding: "1rem" }}>
            <div
                ref={scrollContainerRef}
                onScroll={handleScroll}
                style={{
                    maxHeight: "75vh",
                    overflowY: "auto",
                    paddingRight: "1rem"
                }}
            >
                {markdownChunks.slice(0, visibleChunkCount).map((chunk, index) => (
                    <div key={`md-chunk-${index}`} style={{ marginBottom: "1.5rem" }}>
                        <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                            {chunk}
                        </ReactMarkdown>
                    </div>
                ))}

                {hasMoreChunks && (
                    <div style={{ display: "flex", justifyContent: "center", padding: "1rem 0" }}>
                        <PrimaryButton onClick={loadMoreChunks}>Load more content</PrimaryButton>
                    </div>
                )}
            </div>
        </div>
    );
};

export default MarkdownViewer;
