import { lazy } from "react";
const PDFViewer = lazy(() => import("./PDFViewer"));
const TextViewer = lazy(() => import("./TextViewer"));
const DocxViewer = lazy(() => import("./DocxViewer"));
const IMGViewer = lazy(() => import("./IMGViewer"));
const PptxViewer = lazy(() => import("./PPTXViewer"));
const HTMLViewer = lazy(() => import("./HTMLViewer"));
import { useAppContext } from "../../providers/AppProviders";

interface FileViewerProps {
    file: string | Blob;
    fileType: string;
    page?: number;
}

const FileViewer: React.FC<FileViewerProps> = ({ file, fileType, page }) => {
    const { isResizingAnalysisPanel } = useAppContext();

    if (isResizingAnalysisPanel) {
        return <div style={{ textAlign: "center", color: "rgb(21, 146, 68)", padding: "2rem" }}>Resizing...</div>;
    }

    switch (fileType.toLowerCase()) {
        case "pdf":
            return <PDFViewer file={file as Blob} page={page} />;
        case "docx":
        case "doc":
            return <DocxViewer file={file as Blob} />;
        case "txt":
        case "cvs":
            return <TextViewer file={file as Blob} />;
        case "pptx":
            return <PptxViewer file={file as Blob} />;
        case "jpg":
        case "png":
            return <IMGViewer file={file as Blob} />;
        default:
            return <div>Unsupported file type: {fileType}</div>;
    }
};

export default FileViewer;
