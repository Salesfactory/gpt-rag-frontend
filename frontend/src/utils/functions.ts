export function getPage(citations: string): number | undefined {
    const match = citations.match(/\.pdf:\s*(\d+)/);

    if (match) {
        const numero = parseFloat(match[1].trim());

        return isNaN(numero) ? undefined : numero;
    }

    return undefined;
}

export function getFileType(citation: string): string {
    const extension = citation.split(".").pop()?.toLowerCase();

    switch (extension) {
        case "pdf":
            return "pdf";
        case "doc":
        case "docx":
            return "docx";
        case "ppt":
        case "pptx":
            return "pptx";
        case "xls":
        case "xlsx":
            return "xlsx";
        case "jpg":
        case "jpeg":
            return "image";
        case "png":
            return "image";
        case "gif":
            return "image";
        case "webp":
            return "image";
        case "svg":
            return "image";
        case "bmp":
            return "image";
        case "tiff":
        case "tif":
            return "image";
        case "txt":
            return "txt";
        case "html":
        case "htm":
            return "html";
        default:
            return "unknown";
    }
}

export function isImageFile(filename: string): boolean {
    const imageExtensions = ['jpg', 'jpeg', 'png', 'gif', 'webp', 'svg', 'bmp', 'tiff', 'tif'];
    const extension = filename.split('.').pop()?.toLowerCase();
    return imageExtensions.includes(extension || '');
}
