import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./UploadResources.module.css";
import { PrimaryButton } from "@fluentui/react";
import { AlertTriangle, Upload } from "lucide-react";
import { ALLOWED_FILE_TYPES } from "../../constants";
import { Text } from "@fluentui/react/lib/Text";
import { useDropzone } from "react-dropzone";

function BoldMessage({ text }: { text: string }) {
        const parts = text.split(/\*\*(.*?)\*\*/g);
        return <>{parts.map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>))}</>;
    }

const processingMessages = [
    "**Train a neural network to read your files.** We won't build a digital brain that learns patterns from millions of examples, then gets confused by your unique formatting.",
    "**Pit two AI systems against each other.** We won't create fake data by having one AI generate content while another tries to spot the fakes—like a never-ending game of digital forgery.",
    "**Slice your images into tiny pieces.** We won't run algorithms that examine every pixel, looking for edges and patterns like a detective with a magnifying glass.",
    "**Apply fuzzy logic to your numbers.** We won't use rules that work with 'maybe' and 'sort of'—turning clear data into digital soup.",
    "**Run machine learning experiments.** We won't split your data into training sets, test different models, and pick winners like hosting a science fair for algorithms.",
    "**Hunt for perfect settings.** We won't spend hours testing thousands of parameter combinations, like tuning a radio to find the perfect station that doesn't exist.",
    "**Memorize your specific files too well.** We won't create a system so tailored to your data that it fails the moment it sees anything new—like a student who only knows yesterday's test answers.",
    "**Set up reward systems for AI agents.** We won't create digital entities that learn by trial and error, wandering through your files like lost tourists collecting stamps.",
    "**Break your text into subword pieces.** We won't tokenize every sentence and run it through layers of attention mechanisms that decide which words matter most—like having a committee debate every phrase."
];

const UploadDialogModal: React.FC<{ closeUploadDialog: () => void, isUploading: boolean }> = ({ closeUploadDialog, isUploading }) => {
    const uploadModalRef = useRef<HTMLDivElement>(null);
    const [selectedFiles, setSelectedFiles] = useState<File[]>([]);
    const [showExcelWarning, setShowExcelWarning] = useState<boolean>(false);
    const [currentMessage, setCurrentMessage] = useState<number>(0);

    if (isUploading && currentMessage < processingMessages.length - 1) {
        setTimeout(() => {
            setCurrentMessage(currentMessage + 1);
        }, 4000); 
    }
    
    const onDrop = useCallback((acceptedFiles: any) => {
        setSelectedFiles(acceptedFiles);
    }, []);

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
            onDrop,
            noClick: true
        });

    useEffect(() => {
            const handleClickOutside = (event: MouseEvent) => {
                if (uploadModalRef.current && !uploadModalRef.current.contains(event.target as Node)) {
                    closeUploadDialog();
                }
            };
            document.addEventListener("mousedown", handleClickOutside);
            return () => {
                document.removeEventListener("mousedown", handleClickOutside);
            };
        }, []);

    return (
        <div className={styles.custom_modal_overlay}>
            <div className={styles.custom_modal} ref={uploadModalRef}>
                {/* Modal Header */}
                <div className={styles.modal_header}>
                    <h4>Upload Files</h4>
                    <p className={styles.modal_subtext}>Select files to upload to blob storage</p>
                        </div>
                        <div className={styles.modal_content}>
                            {/* Modal Content */}
                            <div className={styles.upload_dialog_content}>
                                {isUploading ? (
                                    <div className={styles.processing_container}>
                                        {/* File names */}
                                        <div className={styles.processing_files}>
                                            <span className={styles.processing_files_loader_msg}>Processing Files</span>
                                            <div className={styles.processing_files_name}>
                                                {selectedFiles.map((file, index) => (
                                                    <div key={index}>{file.name}</div>
                                                ))}
                                            </div>
                                        </div>

                                        {/* Spinner */}
                                        <div className={styles.spinner_container}>
                                            <div className={styles.spinner}>
                                                {[...Array(8)].map((_, i) => (
                                                    <div
                                                        key={i}
                                                        className={styles.spinner_dot}
                                                        style={{
                                                            backgroundColor: i === 7 ? "#065f46" : i === 6 ? "#047857" : i === 0 ? "#059669" : "#d1fae5",
                                                            transform: `translate(-50%, -50%) rotate(${i * 45}deg) translateY(-24px)`,
                                                            animationDelay: `${i * 0.125}s`
                                                        }}
                                                    />
                                                ))}
                                            </div>
                                            <span className={styles.processing_footer}>Processing</span>
                                        </div>
                                        <div className={styles.message_container}>
                                            <h5 className={styles.message_title}>
                                                Here's a little peek behind the curtain at what we{" "}
                                                <em>
                                                    absolutely will <strong>not</strong>
                                                </em>{" "}
                                                do to your files while we process them—because simplicity rules, and complexity drools:
                                            </h5>
                                            <div className={styles.message_body}>
                                                <div className={styles.message_line}>
                                                    <span className={styles.message_bullet}>•</span>
                                                    <div className={styles.message_text}>
                                                        <BoldMessage text={processingMessages[currentMessage] || ""} />
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                ) : !showExcelWarning ? (
                                    <div className={`${styles.dropzone} ${isDragActive ? styles.dropzone_active : ""}`} {...getRootProps()}>
                                        <input aria-label="Dropzone" {...getInputProps()} />

                                        <div>
                                            <label className={styles.file_label}>
                                                <Upload size={48} className={styles.upload_icon} />
                                                <Text variant="large">{isDragActive ? "Drop files here" : "Drag files here or click to browse"}</Text>
                                                <Text variant="medium" color="#4B5563">
                                                    Allowed file types: {ALLOWED_FILE_TYPES.join(", ")}
                                                </Text>
                                            </label>
                                            <button type="button" onClick={open} className={styles.browse_button}>
                                                Browse Files
                                            </button>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.excelWarningContainer}>
                                        <div className={styles.excelWarningHeader}>
                                            <div className={styles.iconWrapper}>
                                                <AlertTriangle className={styles.icon} />
                                            </div>
                                            <h4 className={styles.title}>Excel Files Detected</h4>
                                        </div>

                                        <div className={styles.warningBox}>
                                            <p className={styles.message}>
                                                <strong>Important:</strong> Only the first sheet of each Excel file will be processed.
                                            </p>
                                            <p className={styles.message}>
                                                If your Excel files have multiple sheets, we recommend uploading one file per sheet for complete data
                                                processing.
                                            </p>
                                            <div className={styles.filesList}>
                                                <strong>Excel files detected:</strong>
                                                <ul>
                                                    {/* {excelFiles.map((fileName, index) => (
                                                        <li key={index}>{fileName}</li>
                                                    ))} */}
                                                </ul>
                                            </div>
                                        </div>

                                        <div className={styles.actions}>
                                            <button className={styles.cancelButton}>
                                                Cancel Upload
                                            </button>
                                            <button className={styles.confirmButton}>
                                                Continue Anyway
                                            </button>
                                        </div>
                                    </div>
                                )}
                            </div>

                            {/* Modal Footer */}
                            {!isUploading && (
                                <div className={styles.modal_footer}>
                                    <PrimaryButton
                                        onClick={closeUploadDialog}
                                        text="Cancel"
                                        styles={{
                                            root: {
                                                backgroundColor: "#d83b01 !important",
                                                borderColor: "#d83b01 !important",
                                                color: "white !important",
                                                borderRadius: "0.5rem"
                                            },
                                            rootHovered: {
                                                backgroundColor: "#a42600 !important",
                                                borderColor: "#a42600 !important",
                                                color: "white !important",
                                                borderRadius: "0.5rem"
                                            },
                                            rootPressed: {
                                                backgroundColor: "#a42600 !important",
                                                borderColor: "#a42600 !important",
                                                color: "white !important",
                                                borderRadius: "0.5rem"
                                            }
                                        }}
                                    />
                                </div>
                            )}
                        </div>
                    </div>
                </div>
    );
}

export default UploadDialogModal;