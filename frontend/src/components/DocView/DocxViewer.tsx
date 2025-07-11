import React, { useEffect, useRef, useState } from "react";
import { renderAsync } from "docx-preview";
import styles from "./DocxPreviewViewer.module.css";

interface DocxPreviewViewerProps {
    file: Blob;
    className?: string;
}

const DocxPreviewViewer: React.FC<DocxPreviewViewerProps> = ({ file, className = "" }) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");

    const applyResponsiveStyles = () => {
        const wrapper = containerRef.current?.querySelector(".docx-wrapper") as HTMLElement | null;
        if (!wrapper || !containerRef.current) return;

        wrapper.style.width = "100%";
        wrapper.style.minWidth = "0";
        wrapper.style.boxSizing = "border-box";
        wrapper.style.padding = "42px";
    };

    useEffect(() => {
        if (!file) {
            setError("No valid file was providedRendering document...");
            setLoading(false);
            return;
        }

        if (file.size === 0) {
            setError("The file is empty");
            setLoading(false);
            return;
        }

        let correctedFile = file;
        if (file.type === "docx" || file.type === "" || !file.type.includes("officedocument")) {
            correctedFile = new Blob([file], {
                type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
            });
        }

        const renderDocument = async () => {
            let retries = 0;
            const maxRetries = 10;

            while (!containerRef.current && retries < maxRetries) {
                await new Promise(resolve => setTimeout(resolve, 100));
                retries++;
            }

            if (!containerRef.current) {
                setError("Error: The document container could not be accessed.");
                setLoading(false);
                return;
            }

            setLoading(true);
            setError("");

            try {
                containerRef.current.innerHTML = "";
                await renderAsync(correctedFile, containerRef.current, undefined, {
                    className: "docx-wrapper",
                    inWrapper: true,
                    ignoreWidth: false,
                    ignoreHeight: false,
                    ignoreFonts: false,
                    breakPages: true,
                    ignoreLastRenderedPageBreak: true,
                    experimental: false,
                    trimXmlDeclaration: true,
                    useBase64URL: false,
                    debug: true
                });

                applyResponsiveStyles();
                setLoading(false);
            } catch (err) {
                setError(`Error rendering DOCX document: ${err instanceof Error ? err.message : "Unknown error"}`);
                setLoading(false);
            }
        };

        const timeoutId = setTimeout(() => {
            renderDocument();
        }, 0);

        return () => clearTimeout(timeoutId);
    }, [file]);

    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new (window as any).ResizeObserver(() => {
            applyResponsiveStyles();
        });

        observer.observe(containerRef.current);

        return () => {
            observer.disconnect();
        };
    }, []);

    return (
        <div className={`${styles.docxContainer} ${className}`} style={{ position: "relative" }}>
            <div ref={containerRef} className={styles.docxContent} />

            {loading && (
                <div className={styles.loadingOverlay}>
                    <div className={styles.spinner}></div>
                    <p className={styles.loadingText}>Rendering document...</p>
                </div>
            )}

            {error && (
                <div className={styles.errorOverlay}>
                    <p className={styles.errorText}>❌ {error}</p>
                    <button
                        className={styles.retryButton}
                        onClick={() => {
                            setError("");
                            setLoading(true);
                        }}
                    >
                        Retry
                    </button>
                </div>
            )}
        </div>
    );
};

export default DocxPreviewViewer;
