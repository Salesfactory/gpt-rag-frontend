import React, { useState, useEffect, useRef } from "react";
import DOMPurify from "dompurify";

interface HTMLViewerProps {
    file: Blob;
}

const HTMLViewer: React.FC<HTMLViewerProps> = ({ file }) => {
    const [htmlContent, setHtmlContent] = useState<string>("");
    const containerRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const reader = new FileReader();
        reader.onload = () => {
            const content = reader.result as string;
            DOMPurify.setConfig({
                ADD_ATTR: ['target'],
                FORBID_TAGS: ['base', 'meta'],
                FORBID_ATTR: ['target', 'onclick', 'onmouseover']
            });
            const sanitizedHtml = DOMPurify.sanitize(content);
            setHtmlContent(sanitizedHtml);
        };
        reader.readAsText(file);
    }, [file]);

    // Prevent any clicks from bubbling up and causing navigation
    useEffect(() => {
        const container = containerRef.current;
        if (container) {
            const handleClick = (e: Event) => {
                const target = e.target as HTMLElement;
                if (target.tagName === 'A') {
                    e.preventDefault();
                }
            };
            
            container.addEventListener('click', handleClick, true);
            return () => container.removeEventListener('click', handleClick, true);
        }
    }, [htmlContent]);

    return (
        <div 
            ref={containerRef}
            style={{ 
                height: "750px", 
                overflow: "auto", 
                padding: "20px",
                position: "relative" // Ensure contained elements don't escape
            }}
        >
            <div dangerouslySetInnerHTML={{ __html: htmlContent }} />
        </div>
    );
};

export default HTMLViewer; 