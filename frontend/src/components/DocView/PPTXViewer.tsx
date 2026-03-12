import React, { useEffect, useState } from "react";
import DocViewer, { DocViewerRenderers } from "react-doc-viewer";
import { getBlobSasUrl } from "../../api/api";
import { useAppContext } from "../../providers/AppProviders";

interface PptxViewerProps {
    file: Blob | string;
    blobName?: string; // Optional blob name for SAS URL generation
}

const getSupportedFileType = (value: string): "pptx" | "docx" | "xlsx" | null => {
    const normalizedValue = value.toLowerCase();
    if (normalizedValue.endsWith(".pptx")) return "pptx";
    if (normalizedValue.endsWith(".docx")) return "docx";
    if (normalizedValue.endsWith(".xlsx")) return "xlsx";
    return null;
};

const getLoadingMessage = (fileType: "pptx" | "docx" | "xlsx" | null): string => {
    if (fileType === "pptx") return "Loading PowerPoint presentation...";
    if (fileType === "docx") return "Loading Word document...";
    if (fileType === "xlsx") return "Loading Excel spreadsheet...";
    return "Loading document preview...";
};

const PptxViewer: React.FC<PptxViewerProps> = ({ file, blobName }) => {
    const { user } = useAppContext();
    const [fileUrl, setFileUrl] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [error, setError] = useState<string>("");

    useEffect(() => {
        let isCancelled = false;

        const setupFileUrl = async () => {
            setIsLoading(true);
            setError("");

            try {
                // If blobName is provided, fetch SAS URL from backend
                if (blobName) {
                    const cleanedBlobName = decodeURIComponent(blobName.replace("documents/", ""));
                    const response = await getBlobSasUrl(cleanedBlobName, "documents", user);
                    setFileUrl(response);
                } else if (file instanceof Blob) {
                    // Fallback: create blob URL (though this doesn't work well with react-doc-viewer)
                    const url = URL.createObjectURL(file);
                    if (!isCancelled) {
                        setFileUrl(url);
                    }
                    return () => {
                        URL.revokeObjectURL(url);
                    };
                }
            } catch (err) {
                if (!isCancelled) {
                    console.error("Error setting up PPTX viewer:", err);
                    setError(err instanceof Error ? err.message : "Failed to load presentation");
                }
            } finally {
                if (!isCancelled) {
                    setIsLoading(false);
                }
            }
        };

        setupFileUrl();

        return () => {
            isCancelled = true;
        };
    }, [file, blobName]);

    const sourceName = blobName || (typeof file === "string" ? file : "");
    const detectedFileType = getSupportedFileType(sourceName);

    const docs =
        fileUrl && detectedFileType
            ? [
                  {
                      uri: fileUrl,
                      fileType: detectedFileType
                  }
              ]
            : [];

    return (
        <div style={{ height: "750px", width: "100%", overflow: "auto" }}>
            {error ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "red" }}>Error: {error}</div>
            ) : isLoading ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "rgb(21, 146, 68)" }}>{getLoadingMessage(detectedFileType)}</div>
            ) : docs.length > 0 ? (
                <DocViewer
                    documents={docs}
                    pluginRenderers={DocViewerRenderers}
                    config={{
                        header: {
                            disableHeader: true,
                            disableFileName: true,
                            retainURLParams: false
                        }
                    }}
                    style={{ height: "100%", width: "100%" }}
                />
            ) : (
                <div style={{ textAlign: "center", padding: "2rem", color: "rgb(21, 146, 68)" }}>No document to display</div>
            )}
        </div>
    );
};

export default PptxViewer;
