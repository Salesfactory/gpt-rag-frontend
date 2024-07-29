import { useState } from "react";
import { Stack, Spinner, TextField, IconButton } from "@fluentui/react";
import { getTokenOrRefresh } from "./token_util";
import { Send32Filled, Attach32Filled, SlideMicrophone32Filled } from "@fluentui/react-icons";
import { ResultReason, SpeechConfig, AudioConfig, SpeechRecognizer } from "microsoft-cognitiveservices-speech-sdk";

import { uploadFile } from "../../api";

import styles from "./QuestionInput.module.css";
interface Props {
    onSend: (question: string, fileBlobUrl: string | null) => void;
    disabled: boolean;
    placeholder?: string;
    clearOnSend?: boolean;
}

import { useFilePicker } from "use-file-picker";

export const FileAttachmentInput = ({setFileBlobUrl}: {setFileBlobUrl: (url: string) => void}) => {
    const [files, setFiles] = useState<File[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [error, setError] = useState<string>("");

    const { openFilePicker, filesContent, loading, errors } = useFilePicker({
        readAs: "DataURL",
        accept: ["xls", "xlsx", "csv"],
        multiple: false,
        onFilesSelected: async ({ plainFiles, filesContent, errors }) => {
            // this callback is always called, even if there are errors
            setLoadingFiles(true);
            try{
                const data = await uploadFile(plainFiles[0]);
                setLoadingFiles(false);
                setError("");
                setFileBlobUrl(data.blob_url);
            } catch (error) {
                setLoadingFiles(false);
                setError("Error uploading file");
                return;
            }
        },
        onFilesRejected: ({ errors }) => {
            // this callback is called when there were validation errors
            setError("Error with the file picker");
            setLoadingFiles(false);
        },
        onFilesSuccessfullySelected: async ({ plainFiles, filesContent }) => {
            // this callback is called when the files are successfully selected
            setFiles(plainFiles);
        }
    });

    if (loading) {
        return (
            <div
                id="file-display-row"
                style={{
                    display: "flex",
                    flexDirection: "row",
                    position: "fixed",
                    bottom: 100,
                    color: "red"
                }}
            >
                <Spinner
                    styles={{
                        root: {
                            marginTop: "50px"
                        }
                    }}
                />
            </div>
        );
    }

    if (errors.length) {
        return (
            <div
                id="file-display-row"
                style={{
                    display: "flex",
                    flexDirection: "row",
                    position: "fixed",
                    bottom: 150,
                    color: "red"
                }}
            >
                <div>Error with the file picker</div>
            </div>
        );
    }

    return (
        <>
            <div
                id="file-display-row"
                style={{
                    display: "flex",
                    flexDirection: "row",
                    position: "fixed",
                    bottom: 200
                }}
            >
                {files.map((file, index) => (
                    <div
                        id="file-display-item"
                        key={index}
                        style={{
                            position: "absolute",
                            width: "1000px",
                            maxWidth: "700px",
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                            padding: "5px 10px",
                            border: "1px solid #ccc",
                            borderRadius: "5px",
                            cursor: "pointer",
                            overflow: "hidden",
                            textOverflow: "ellipsis",
                            backgroundColor: "white",
                            zIndex: 5
                        }}
                    >
                        <button
                            style={{
                                backgroundColor: "transparent",
                                border: "none",
                                cursor: "pointer",
                                padding: "0",
                                margin: "0",
                                fontSize: "20px",
                                color: "black"
                            }}
                            aria-label="Close"
                            onClick={() => {
                                setFiles([]);
                                setError("");
                                setFileBlobUrl("");
                            }}
                        >
                            &times;
                        </button>
                        <IconButton
                            style={{ color: "black" }}
                            iconProps={{ iconName: "ExcelDocument" }}
                            title="Attach a file"
                            ariaLabel="Attach a file"
                        />
                        <div>{file.name}</div>
                    </div>
                ))}
                {error && <div>{error}</div>}
                {loadingFiles && !error && (
                    <div
                        style={{
                            display: "flex",
                            flexDirection: "row",
                            alignItems: "center",
                        }}
                    >
                        Loading file...
                        <Spinner />
                    </div>
                )}
            </div>
            <br />
            <div className={`${styles.attachmentButton}`} aria-label="Button to attach file" onClick={openFilePicker} tabIndex={0}>
                <Attach32Filled primaryFill="rgba(115, 118, 225, 1)" />
            </div>
        </>
    );
};

export const QuestionInput = ({ onSend, disabled, placeholder, clearOnSend }: Props) => {
    const [question, setQuestion] = useState<string>("");
    const [fileBlobUrl, setFileBlobUrl] = useState<string | null>(null);

    const sendQuestion = () => {
        if (disabled || !question.trim()) {
            return;
        }

        onSend(question, fileBlobUrl);

        if (clearOnSend) {
            setQuestion("");
        }
    };

    const sttFromMic = async () => {
        const tokenObj = await getTokenOrRefresh();
        const speechConfig = SpeechConfig.fromAuthorizationToken(tokenObj.authToken, tokenObj.region);
        speechConfig.speechRecognitionLanguage = tokenObj.speechRecognitionLanguage;

        const audioConfig = AudioConfig.fromDefaultMicrophoneInput();
        const recognizer = new SpeechRecognizer(speechConfig, audioConfig);

        const userLanguage = navigator.language;
        let reiniciar_text = "";
        if (userLanguage.startsWith("pt")) {
            reiniciar_text = "Pode falar usando seu microfone...";
        } else if (userLanguage.startsWith("es")) {
            reiniciar_text = "Puedes hablar usando su micrófono...";
        } else {
            reiniciar_text = "You can talk using your microphone...";
        }

        setQuestion(reiniciar_text);

        recognizer.recognizeOnceAsync(result => {
            let displayText;
            if (result.reason === ResultReason.RecognizedSpeech) {
                displayText = result.text;
                //setQuestion(displayText);
                //onSend(question);
            } else {
                displayText = "ERROR: Voice recognition was canceled or the voice cannot be recognized. Make sure your microphone is working properly.";
                //setQuestion(displayText);
            }
            setQuestion(displayText);
        });
    };

    const onEnterPress = (ev: React.KeyboardEvent<Element>) => {
        if (ev.key === "Enter" && !ev.shiftKey) {
            ev.preventDefault();
            sendQuestion();
        }
    };

    const onQuestionChange = (_ev: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        if (!newValue) {
            setQuestion("");
        } else {
            setQuestion(newValue);
        }
    };

    const sendQuestionDisabled = disabled || !question.trim();

    return (
        <Stack horizontal className={styles.questionInputContainer}>
            <FileAttachmentInput setFileBlobUrl={setFileBlobUrl} />
            <TextField
                className={styles.questionInputTextArea}
                placeholder={placeholder}
                multiline
                resizable={false}
                borderless
                value={question}
                onChange={onQuestionChange}
                onKeyDown={onEnterPress}
            />
            <div className={styles.questionInputButtonsContainer}>
                <div
                    className={`${styles.questionInputSendButton} ${sendQuestionDisabled ? styles.questionInputSendButtonDisabled : ""}`}
                    aria-label="Ask a question button"
                    onClick={sendQuestion}
                    onKeyDown={ev => {
                        if (ev.key === "Enter") {
                            ev.preventDefault();
                            sendQuestion();
                        }
                    }}
                    tabIndex={0}
                >
                    <Send32Filled primaryFill="rgba(115, 118, 225, 1)" />
                </div>
                <div
                    className={`${styles.questionInputSendButton}`}
                    aria-label="Button to talk"
                    onClick={sttFromMic}
                    onKeyDown={ev => {
                        if (ev.key === "Enter") {
                            ev.preventDefault();
                            sttFromMic();
                        }
                    }}
                    tabIndex={0}
                >
                    <SlideMicrophone32Filled primaryFill="rgba(115, 118, 225, 1)" />
                </div>
            </div>
        </Stack>
    );
};
