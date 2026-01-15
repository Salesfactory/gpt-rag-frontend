import React, { useState, useEffect } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeRaw from "rehype-raw";
import DOMPurify from "dompurify";

interface MarkdownViewerProps {
    file: Blob;
}

const MarkdownViewer: React.FC<MarkdownViewerProps> = ({ file }) => {
    const [content, setContent] = useState<string>("");

    useEffect(() => {
        const reader = new FileReader();
        reader.onload = () => {
            const text = reader.result as string;
            DOMPurify.setConfig({
                ADD_ATTR: ["target"],
                FORBID_TAGS: ["base", "meta"],
                FORBID_ATTR: ["target", "onclick", "onmouseover"]
            });
            const sanitized = DOMPurify.sanitize(text);
            setContent(sanitized);
        };
        reader.readAsText(file);
    }, [file]);

    return (
        <div style={{ width: "100%", maxWidth: "100%", overflowX: "auto", overflowY: "auto", padding: "1rem" }}>
            <ReactMarkdown remarkPlugins={[remarkGfm]} rehypePlugins={[rehypeRaw]}>
                {content}
            </ReactMarkdown>
        </div>
    );
};

export default MarkdownViewer;
