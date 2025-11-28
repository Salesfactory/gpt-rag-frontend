import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import { Upload, CheckCircle, XCircle } from "lucide-react";
import styles from "./UploadConsumerPulse.module.css";
import { uploadSharedDocument } from "../../api/api";

type UploadStatus = "idle" | "uploading" | "success" | "error";

const UploadConsumerPulse: React.FC = () => {
    const [uploadStatus, setUploadStatus] = useState<UploadStatus>("idle");
    const [uploadMessage, setUploadMessage] = useState<string>("");
    const [uploadDetails, setUploadDetails] = useState<any>(null);

    const onDrop = useCallback(async (acceptedFiles: File[]) => {
        if (acceptedFiles.length === 0) return;

        const file = acceptedFiles[0]; // Only handle one file at a time
        setUploadStatus("uploading");
        setUploadMessage(`Uploading ${file.name}...`);

        try {
            const result = await uploadSharedDocument(file);
            
            // Check if the upload was successful
            if (result.data) {
                setUploadStatus("success");
                setUploadDetails(result.data);
                setUploadMessage(`Success! File uploaded to all organizations.`);
                
            } else {
                setUploadStatus("error");
                setUploadMessage("Upload failed. Please try again.");
            }
        } catch (error: any) {
            console.error("Upload error:", error);
            setUploadStatus("error");
            setUploadMessage(
                error.message || "An error occurred during upload. Please try again."
            );
        }
    }, []);

    const { getRootProps, getInputProps, isDragActive } = useDropzone({
        onDrop,
        multiple: false,
        accept: {
            'application/pdf': ['.pdf'],
            'text/csv': ['.csv'],
            'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': ['.xlsx'],
            'application/vnd.ms-excel': ['.xls'],
            'application/msword': ['.doc'],
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document': ['.docx'],
            'application/vnd.ms-powerpoint': ['.ppt'],
            'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx']
        }
    });

    const resetUpload = () => {
        setUploadStatus("idle");
        setUploadMessage("");
        setUploadDetails(null);
    };

    return (
        <div className={styles.page_container}>
            <div className={styles.content_wrapper}>
                <div className={styles.header}>
                    <h1 className={styles.title}>Upload Consumer Pulse Data</h1>
                    <p className={styles.subtitle}>
                        Upload files that will be distributed across all organizations
                    </p>
                </div>

                {uploadStatus === "idle" || uploadStatus === "uploading" ? (
                    <div
                        {...getRootProps()}
                        className={`${styles.dropzone} ${
                            isDragActive ? styles.dropzone_active : ""
                        } ${uploadStatus === "uploading" ? styles.dropzone_uploading : ""}`}
                    >
                        <input {...getInputProps()} />
                        
                        {uploadStatus === "uploading" ? (
                            <div className={styles.uploading_content}>
                                <div className={styles.spinner} />
                                <p className={styles.uploading_text}>{uploadMessage}</p>
                            </div>
                        ) : (
                            <>
                                <div className={styles.upload_icon}>
                                    <Upload size={48} />
                                </div>
                                {isDragActive ? (
                                    <p className={styles.dropzone_text}>Drop the file here...</p>
                                ) : (
                                    <>
                                        <p className={styles.dropzone_text}>
                                            Drag and drop a file here, or click to select
                                        </p>
                                        <p className={styles.dropzone_subtext}>
                                            Supported formats: PDF, CSV, Excel, Word, PowerPoint
                                        </p>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                ) : uploadStatus === "success" ? (
                    <div className={styles.result_container}>
                        <div className={styles.success_content}>
                            <div className={styles.success_icon}>
                                <CheckCircle size={64} />
                            </div>
                            <h2 className={styles.success_title}>Upload Successful!</h2>
                            <p className={styles.success_message}>{uploadMessage}</p>
                            
                            {uploadDetails && (
                                <div className={styles.upload_summary}>
                                    <div className={styles.summary_item}>
                                        <span className={styles.summary_label}>Total Organizations:</span>
                                        <span className={styles.summary_value}>
                                            {uploadDetails.total_organizations}
                                        </span>
                                    </div>
                                    <div className={styles.summary_item}>
                                        <span className={styles.summary_label}>Successful Uploads:</span>
                                        <span className={styles.summary_value_success}>
                                            {uploadDetails.successful_uploads}
                                        </span>
                                    </div>
                                    {uploadDetails.failed_uploads > 0 && (
                                        <div className={styles.summary_item}>
                                            <span className={styles.summary_label}>Failed Uploads:</span>
                                            <span className={styles.summary_value_error}>
                                                {uploadDetails.failed_uploads}
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                            
                            <button onClick={resetUpload} className={styles.reset_button}>
                                Upload Another File
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className={styles.result_container}>
                        <div className={styles.error_content}>
                            <div className={styles.error_icon}>
                                <XCircle size={64} />
                            </div>
                            <h2 className={styles.error_title}>Upload Failed</h2>
                            <p className={styles.error_message}>{uploadMessage}</p>
                            
                            <button onClick={resetUpload} className={styles.reset_button}>
                                Try Again
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
};

export default UploadConsumerPulse;

