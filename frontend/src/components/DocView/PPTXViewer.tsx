import React, { useEffect, useState } from "react";
import DocViewer, { DocViewerRenderers } from "react-doc-viewer";
import { getBlobSasUrl } from "../../api/api";
import { useAppContext } from "../../providers/AppProviders";

interface PptxViewerProps {
    file: Blob | string;
    blobName?: string; // Optional blob name for SAS URL generation
}

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

    const docs = fileUrl
        ? [
              {
                  uri: fileUrl,
                  fileType: "pptx"
              }
          ]
        : [];

    return (
        <div style={{ height: "750px", width: "100%", overflow: "auto" }}>
            {error ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "red" }}>
                    Error: {error}
                </div>
            ) : isLoading ? (
                <div style={{ textAlign: "center", padding: "2rem", color: "rgb(21, 146, 68)" }}>
                    Loading PowerPoint presentation...
                </div>
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
                <div style={{ textAlign: "center", padding: "2rem", color: "rgb(21, 146, 68)" }}>
                    No presentation to display
                </div>
            )}
        </div>
    );
};

export default PptxViewer;
