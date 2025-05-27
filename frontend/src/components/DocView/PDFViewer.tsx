import React, { useEffect, useState } from "react";

interface PDFRenderProps {
    file: Blob | MediaSource;
    page?: number;
    fileType?: string;
}

const PDFViewer: React.FC<PDFRenderProps> = ({ file, page }) => {
    const [pdfUrl, setPdfUrl] = useState<string>("");

    useEffect(() => {
        if (file instanceof Blob) {
            const pdfBlob = new Blob([file], { type: "application/pdf" });
            const url = URL.createObjectURL(pdfBlob);
            setPdfUrl(url);
            return () => {
                URL.revokeObjectURL(url);
            };
        } else {
            setPdfUrl("");
            return () => {};
        }
    }, [file]);

    const pageParam = page ? `#page=${page}` : "";

    return (
        <div style={{ height: "750px" }}>
            {pdfUrl ? (
                <iframe
                    src={`${pdfUrl}${pageParam}`}
                    title="PDF Viewer"
                    width="100%"
                    height="100%"
                    style={{ border: "none", height: "100%" }}
                    allow="fullscreen"
                />
            ) : (
                <div>Loading PDF...</div>
            )}
        </div>
    );
};

export default PDFViewer;
