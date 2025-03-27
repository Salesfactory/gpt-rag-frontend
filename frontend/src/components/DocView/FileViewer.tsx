import PDFViewer from "./PDFViewer";
import TextViewer from "./TextViewer";
import DocxViewer from "./DocxViewer";
import IMGViewer from "./IMGViewer";
import PptxViewer from "./PPTXViewer";
import HTMLViewer from "./HTMLViewer";

interface FileViewerProps {
    file: (string|Blob);
    fileType: string;
    page?: number;
}

const FileViewer: React.FC<FileViewerProps> = ({ file, fileType, page }) => {
    switch (fileType.toLowerCase()) {
        case 'pdf':
            return <PDFViewer file={file as Blob} page={page} />;
        case 'docx':
        case 'doc':
            return <DocxViewer file={file as Blob} />;
        case 'html':
            return <HTMLViewer file={file as Blob} />;
        case 'txt':
        case 'cvs':
            return <TextViewer file={file as Blob} />;
        case 'pptx':
            return <PptxViewer file={file as Blob} />;
        case 'jpg':
        case 'png':
            return <IMGViewer file={file as Blob} />;
        default:
            return <div>Unsupported file type: {fileType}</div>;
    }
};

export default FileViewer;
