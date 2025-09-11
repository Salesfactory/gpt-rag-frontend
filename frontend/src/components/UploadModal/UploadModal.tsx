
import { PrimaryButton } from '@fluentui/react';
import styles from './UploadModal.module.css';
import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { AlertTriangle, Upload } from 'lucide-react';
import { Text } from "@fluentui/react/lib/Text";
import { ALLOWED_FILE_TYPES } from '../../constants';
import { Callback } from 'microsoft-cognitiveservices-speech-sdk/distrib/lib/src/sdk/Transcription/IConversation';

function BoldMessage({ text }: { text: string }) {
    const parts = text.split(/\*\*(.*?)\*\*/g);
    return <>{parts.map((part, index) => (index % 2 === 1 ? <strong key={index}>{part}</strong> : <span key={index}>{part}</span>))}</>;
}

export const UploadModalHeader = () => {
    return (
        <div className={styles.modal_header}>
            <h4>Upload Files</h4>
            <p className={styles.modal_subtext}>Select files to upload to blob storage</p>
        </div>
    )
}

export const UploadModalFooter = ({ closeUploadDialog }: { closeUploadDialog: () => void }) => {
    return (
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
    )
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


export const UploadingContent: React.FC<{ selectedFiles: File[] }> = ({ selectedFiles }) => {
    const [currentMessage, setCurrentMessage] = useState(0);

    if (currentMessage < processingMessages.length - 1) {
        setTimeout(() => {
            setCurrentMessage(currentMessage + 1);
        }, 4000);
    }

    return (
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
    )
}

export const DragFilesContent: React.FC<{onDrop: Callback }> = ({onDrop}) => {

    const { getRootProps, getInputProps, isDragActive, open } = useDropzone({
        onDrop,
        noClick: true
    });
    return (
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
    )
}

export const ExcelWarningContent: React.FC<{ excelFiles: String[], dispach: React.Dispatch<any> }> = ({ excelFiles, dispach }) => {
    return (
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
                        {excelFiles.map((fileName, index) => (
                            <li key={index}>{fileName}</li>
                        ))}
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
    )
}

export const DuplicateWarningContent: React.FC<{ 
    files: File[], 
    currentFileIndex: number,
    onRename: () => void,
    onReplace: () => void,
    onCancel: () => void
}> = ({ files, currentFileIndex, onRename, onReplace, onCancel }) => {
    const currentFile = files[currentFileIndex];
    const remainingCount = files.length - currentFileIndex - 1;

    return (
        <div className={styles.excelWarningContainer}>
            <div className={styles.excelWarningHeader}>
                <div className={styles.iconWrapper}>
                    <AlertTriangle className={styles.icon} />
                </div>
                <h4 className={styles.title}>File name already exists</h4>
            </div>

            <div className={styles.warningBox}>
                <p className={styles.message}>
                    <strong>Important:</strong>
                </p>
                <p className={styles.message}>
                    A file named "{currentFile?.name}" already exists in this location. What do you want to do?
                </p>
                {remainingCount > 0 && (
                    <p className={styles.message}>
                        {remainingCount} more duplicate file{remainingCount > 1 ? 's' : ''} to process.
                    </p>
                )}
            </div>

            <div className={styles.actions}>
                <button className={styles.confirmButton} onClick={onRename}>
                    Rename
                </button>
                <button className={styles.cancelButton} onClick={onCancel}>
                    Cancel
                </button>
                <button className={styles.confirmButton} onClick={onReplace}>
                    Replace
                </button>
            </div>
        </div>
    )
}

export const RenameFileContent: React.FC<{ 
    fileName: string;
    onConfirm: (newName: string) => void;
    onCancel: () => void;
}> = ({ fileName, onConfirm, onCancel }) => {
    const [newName, setNewName] = useState("");

    const extensionIndex = fileName.lastIndexOf('.');
    const extension = extensionIndex !== -1 ? fileName.substring(extensionIndex) : '';

    const handleConfirm = () => {
        if (newName.trim()) {
            onConfirm(`${newName.trim()}${extension}`);
        }
        setNewName("")
    };

    const handleKeyPress = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            handleConfirm();
        }
    };

    return (
        <div className={styles.excelWarningContainer}>
            <div className={styles.excelWarningHeader}>
                <div className={styles.iconWrapper}>
                    <AlertTriangle className={styles.icon} />
                </div>
            <h4 className={styles.title}>Rename File</h4>
            </div>
            <div className={styles.warningBox}>
                <p className={styles.message}>
                    <strong>Enter a new name for {fileName}</strong>
                </p>
                <input
                    className={styles.renameInput}
                    type="text"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    onKeyPress={handleKeyPress}
                    placeholder="New file name"
                    autoFocus
                />
                <span className={styles.file_extension}>{extension}</span>
            </div>
            <div className={styles.actions}>
                <button 
                    className={styles.confirmButton}
                    onClick={handleConfirm}
                    disabled={!newName.trim()}
                >
                    Rename
                </button>
                <button 
                    className={styles.cancelButton}
                    onClick={onCancel}
                >
                    Cancel
                </button>
            </div>
        </div>
    )
}