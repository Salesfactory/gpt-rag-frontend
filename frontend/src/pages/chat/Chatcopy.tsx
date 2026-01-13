import { useRef, useState, useEffect } from "react";
import { Spinner } from "@fluentui/react";

import styles from "./Chatcopy.module.css";

import {
    Approaches,
    AskResponse,
    ChatRequestGpt,
    ChatTurn,
    ThoughtProcess,
    exportConversation,
    getFileBlob,
    generateExcelDownloadUrl,
    uploadUserDocument,
    deleteUserDocument,
    listUserDocuments
} from "../../api";
import { Answer, AnswerError } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput/QuestionInputcopy";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { getFileType } from "../../utils/functions";
import { useAppContext } from "../../providers/AppProviders";
import StartNewChatButton from "../../components/StartNewChatButton/StartNewChatButtoncopy";
import AttachButton from "../../components/AttachButton/AttachButton";
import DataAnalystButton from "../../components/DataAnalystButton/DataAnalystButton";
import { CHAT_ATTACHMENT_ALLOWED_TYPES, CHAT_MAX_ATTACHED_FILES } from "../../constants";
import { get403ErrorMessages, getPlaceholderText } from "../../utils/errorMessages";
import { ERROR_CODE_UNAUTHORIZED_ORG, ERROR_CODE_USER_LIMIT_EXCEEDED, ERROR_CODE_ORG_LIMIT_EXCEEDED, BackendErrorResponse } from "../../api/models";

import "react-toastify/dist/ReactToastify.css";
import FreddaidLogo from "../../img/SF-actionableLogo.png";

import React from "react";
import {
    parseStreamWithMarkdownValidation,
    ParsedEvent,
    isProgressMessage,
    isThoughtsMessage,
    isThinkingMessage,
    isDataAnalystContentMessage,
    extractProgressState,
    ProgressMessage,
    ThinkingMessage,
    DataAnalystContentMessage
} from "./streamParser";
import { Warning28Regular } from "@fluentui/react-icons";
import { log } from "console";
import { fetchWrapper } from "../../api/fetchWrapper";

const userLanguage = navigator.language;
let error_message_text = "";
if (userLanguage.startsWith("pt")) {
    error_message_text = "Desculpe, tive um problema técnico com a solicitação. Por favor informar o erro a equipe de suporte. ";
} else if (userLanguage.startsWith("es")) {
    error_message_text = "Lo siento, yo tuve un problema con la solicitud. Por favor informe el erro al equipo de suporte. ";
} else {
    error_message_text = "I'm sorry, I had a problem with the request. Please report the error to the support team. ";
}

const Chat = () => {
    // speech synthesis is disabled by default

    const speechSynthesisEnabled = false;

    const [placeholderText, setPlaceholderText] = useState("");
    const [promptTemplate, setPromptTemplate] = useState<string>("");
    const [retrieveCount, setRetrieveCount] = useState<number>(3);
    const [useSemanticRanker, setUseSemanticRanker] = useState<boolean>(true);
    const [useSemanticCaptions, setUseSemanticCaptions] = useState<boolean>(false);
    const [excludeCategory, setExcludeCategory] = useState<string>("");
    const [useSuggestFollowupQuestions, setUseSuggestFollowupQuestions] = useState<boolean>(false);
    const ATTACH_ACCEPT = CHAT_ATTACHMENT_ALLOWED_TYPES.join(",");
    const [attachedDocs, setAttachedDocs] = useState<{ blobName: string; originalFilename: string; savedFilename: string }[]>([]);
    const [fileUploadError, setFileUploadError] = useState<string>("");
    const [isDataAnalystMode, setIsDataAnalystMode] = useState<boolean>(false);

    const [isDragOver, setIsDragOver] = useState(false);

    const chatContainerRef = useRef<HTMLDivElement>(null);

    const {
        dataConversation,
        setDataConversation,
        chatId,
        conversationIsLoading,
        setRefreshFetchHistory,
        setChatId,
        chatSelected,
        setChatSelected,
        setChatIsCleaned,
        chatIsCleaned,
        user,
        isResizingAnalysisPanel,
        setisResizingAnalysisPanel
    } = useAppContext();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const [fileType, setFileType] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [isUploadingDocs, setIsUploadingDocs] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [activeCitation, setActiveCitation] = useState<string>();
    const [spreadsheetDownloadUrl, setSpreadsheetDownloadUrl] = useState<string | undefined>(undefined);
    const [spreadsheetFileName, setSpreadsheetFileName] = useState<string | undefined>(undefined);
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);
    const [error403Data, setError403Data] = useState<{
        errorCode?: string;
        nextPeriodStart?: number;
    } | null>(null);
    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: AskResponse][]>([]);

    const [userId, setUserId] = useState<string>(""); // this is more like a conversation id instead of a user id
    const [conversationId, setConversationId] = useState<string>(""); // Pre-generated conversation ID for new chats
    const triggered = useRef(false);

    const [lastAnswer, setLastAnswer] = useState<string>("");
    const [progressState, setProgressState] = useState<{ step: string; message: string; progress?: number; timestamp?: number } | null>(null);
    const [thinkingContent, setThinkingContent] = useState<string>("");
    const restartChat = useRef<boolean>(false);
    const [loadingCitationPath, setLoadingCitationPath] = useState<string | null>(null);

    // Function to generate UUID with fallback for older browsers
    const generateUUID = (): string => {
        if (typeof crypto !== "undefined" && crypto.randomUUID) {
            return crypto.randomUUID();
        }
        // Fallback for older browsers
        return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, function (c) {
            const r = (Math.random() * 16) | 0;
            const v = c == "x" ? r : (r & 0x3) | 0x8;
            return v.toString(16);
        });
    };

    // Function to get or create a conversation ID
    const getOrCreateConversationId = (): string => {
        if (chatId) return chatId; // prioritize existing chatId if available
        if (!conversationId) {
            // Generate new UUID for new conversation (typically happens before the first message)
            const newId = generateUUID();
            setConversationId(newId);
            return newId;
        }
        return conversationId;
    };

    const streamResponse = async (question: string, chatId: string | null, userDocumentBlobNames?: string[]) => {
        /* ---------- 0 · Common pre-flight state handling ---------- */
        lastQuestionRef.current = question;
        restartChat.current = false;
        if (error) {
            setError(undefined);
        }
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);
        setLastAnswer("");
        setProgressState(null);
        setThinkingContent("");

        const agent = "consumer";

        let history: ChatTurn[] = [];
        if (dataConversation.length > 0) {
            history.push(...dataConversation);
        } else {
            history.push(...answers.map(a => ({ user: a[0], bot: { message: a[1]?.answer, thoughts: a[1]?.thoughts ?? null } })));
        }
        history.push({ user: question, bot: undefined });
        const activeConversationId = getOrCreateConversationId();
        const request: ChatRequestGpt = {
            history: history,
            approach: Approaches.ReadRetrieveRead,
            conversation_id: activeConversationId,
            query: question,
            agent,
            overrides: {
                promptTemplate: promptTemplate.length === 0 ? undefined : promptTemplate,
                excludeCategory: excludeCategory.length === 0 ? undefined : excludeCategory,
                top: retrieveCount,
                semanticRanker: useSemanticRanker,
                semanticCaptions: useSemanticCaptions,
                suggestFollowupQuestions: useSuggestFollowupQuestions
            }
        };

        try {
            const response = await fetchWrapper("/stream_chatgpt", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-MS-CLIENT-PRINCIPAL-ID": user?.id || "",
                    "X-MS-CLIENT-PRINCIPAL-NAME": user?.name || "",
                    "X-MS-CLIENT-PRINCIPAL-ORGANIZATION": user?.organizationId || ""
                },
                body: JSON.stringify({
                    question: request.query,
                    conversation_id: request.conversation_id,
                    agent: request.agent,
                    user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
                    user_document_blob_names: Array.isArray(userDocumentBlobNames) && userDocumentBlobNames.length > 0 ? userDocumentBlobNames : undefined,
                    is_data_analyst_mode: isDataAnalystMode
                })
            });

            if (response.status == 403) {
                try {
                    const data: BackendErrorResponse = await response.json();
                    const errorCode = data.error?.code;

                    // Calculate days until reset only for user limit errors
                    let daysUntilReset: number | undefined = undefined;
                    if (errorCode === ERROR_CODE_USER_LIMIT_EXCEEDED && data.error?.nextPeriodStart) {
                        const nextPeriodStartSeconds = (data.error.nextPeriodStart - Date.now()) / 1000;
                        daysUntilReset = Math.max(1, Math.ceil(nextPeriodStartSeconds / 86400)); // Minimum 1 day
                    }

                    setError403Data({
                        errorCode,
                        nextPeriodStart: daysUntilReset
                    });

                    // Update placeholder text
                    setPlaceholderText(getPlaceholderText(errorCode));
                } catch (parseError) {
                    console.error("Failed to parse 403 error response:", parseError);
                    // Fallback to generic 403 error
                    setError403Data({ errorCode: undefined });
                    setPlaceholderText(getPlaceholderText(undefined));
                }
                return; // Exit early, don't process stream
            }

            if (!response.body) {
                throw new Error("ReadableStream not supported in this browser.");
            }

            /* ---------- 3 · Consume the stream via our parser with markdown validation ---------- */
            const reader = response.body.getReader();
            let result = "";
            let ctrlMsg: { conversation_id?: string; thoughts?: ThoughtProcess } = {};

            for await (const evt of parseStreamWithMarkdownValidation(reader)) {
                /* allow user to abort mid-stream */
                if (restartChat.current) {
                    handleNewChat();
                    return;
                }

                if (evt.type === "json") {
                    setError403Data(null); // Clear any previous 403 errors
                    // ---- Handle different types of JSON messages from backend ----
                    if (isDataAnalystContentMessage(evt.payload)) {
                        // Data analyst content - treat as thinking (goes into collapsible section)
                        const contentMsg = evt.payload as DataAnalystContentMessage;
                        setThinkingContent(prev => prev + contentMsg.content);
                    } else if (isThinkingMessage(evt.payload)) {
                        // Thinking message - accumulate Claude's thinking process
                        const thinkingMsg = evt.payload as ThinkingMessage;
                        setThinkingContent(prev => prev + thinkingMsg.content);
                    } else if (isProgressMessage(evt.payload)) {
                        const progress = extractProgressState(evt.payload as ProgressMessage);
                        setProgressState(progress);
                    } else if (isThoughtsMessage(evt.payload)) {
                        // Thoughts/control message arriving from backend
                        const { conversation_id, thoughts } = evt.payload;
                        if (conversation_id && conversation_id !== ctrlMsg.conversation_id) {
                            ctrlMsg = { conversation_id, thoughts };
                            if (answers.length === 0) {
                                setRefreshFetchHistory(true);
                                setChatId(conversation_id);
                            } else {
                                setRefreshFetchHistory(false);
                            }
                            setUserId(conversation_id);
                        }
                    }
                } else {
                    // ---- plain text / IMAGE_PREVIEW (markdown validation handled in parser) ----
                    result += evt.payload;
                    setLastAnswer(result); // incremental UI update

                    // Clear progress state once we start getting actual response content (not just whitespace)
                    if (progressState && result.trim().length > 0 && evt.payload.trim().length > 0) {
                        setProgressState(null);
                    }
                }
            }

            /* ---------- 4 · Post-stream tidy-up (citation cleanup etc.) ---------- */
            const blobRegex = /(Source:\s?\/?)?(source:)?(https:\/\/)?([^/]+\.blob\.core\.windows\.net)?(\/?documents\/?)?/g;
            // Function to clean citations
            const cleanCitation = (citation: string) => {
                return citation.replace(blobRegex, "");
            };
            result = result.replace(/\\[\\[(\\d+)\\]\\]\\((.*?)\\)/g, (_, n, cite) => `[[${n}]](${cleanCitation(cite)})`);

            /* ---------- 5 · Persist to local chat state ---------- */
            const botResponse = {
                answer: result || "",
                data_points: [""],
                thoughts: ctrlMsg.thoughts ?? null
            } as AskResponse;

            setAnswers(prev => [...prev, [question, botResponse]]);
            setDataConversation(prev => [...prev, { user: question, bot: { message: botResponse.answer, thoughts: botResponse.thoughts } }]);

            // Clear progress state when response is complete
            setProgressState(null);

            lastQuestionRef.current = "";
        } catch (err) {
            console.error("Error fetching streamed response:", err);
            setError(err as Error);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        setThinkingContent("");
        setIsDataAnalystMode(false);

        if (lastQuestionRef.current || dataConversation.length > 0 || !chatIsCleaned) {
            lastQuestionRef.current = "";
            error && setError(undefined);
            setActiveCitation(undefined);
            setActiveAnalysisPanelTab(undefined);
            setAnswers([]);
            setError403Data(null);
            setDataConversation([]);
            setChatIsCleaned(true);
        } else {
            return;
        }
    };

    const handleNewChat = () => {
        setThinkingContent("");
        setIsDataAnalystMode(false);

        if (lastQuestionRef.current || dataConversation.length > 0 || chatIsCleaned) {
            restartChat.current = true;
            lastQuestionRef.current = "";
            error && setError(undefined);
            setActiveCitation(undefined);
            setActiveAnalysisPanelTab(undefined);
            setAnswers([]);
            setError403Data(null);
            setDataConversation([]);
            setChatId("");
            setUserId("");
            setConversationId(""); // Reset conversation ID for new chat
            setChatSelected("");
            setChatIsCleaned(false);
            setAttachedDocs([]); // clear attachments for a fresh chat
        } else {
            return;
        }
    };

    const handleDownloadConversation = async () => {
        // Check if there's a conversation to export
        if (!chatId || !user?.id) {
            console.error("Cannot export: No conversation ID or user ID available");
            return;
        }

        // Check if there's actually conversation data to export
        if (dataConversation.length === 0 && answers.length === 0) {
            console.error("Cannot export: No conversation data available");
            return;
        }

        setIsDownloading(true);
        try {
            // Call the export API with DOCX format
            const result = await exportConversation(chatId, user.id, "docx");

            if (result.success && result.share_url) {
                if (result.format.toLowerCase() !== "docx") {
                    console.warn(`Warning: Expected DOCX format but received ${result.format}`);
                }

                // Try to trigger download directly instead of opening in new tab
                const link = document.createElement("a");
                link.href = result.share_url;
                link.download = result.filename || `conversation_export.${result.format}`;
                document.body.appendChild(link);
                link.click();
                document.body.removeChild(link);
            } else {
                throw new Error("Export failed: No download URL received");
            }
        } catch (error) {
            console.error("Error exporting conversation:", error);
        } finally {
            setIsDownloading(false);
        }
    };

    /**Get File Blob - Wrapper function that uses the centralized API and manages local state */
    const getFileBlobWithState = async (fileName: string, container: string = "documents") => {
        /** get file type */
        let type = getFileType(fileName);
        setFileType(type);

        try {
            return await getFileBlob(fileName, container);
        } catch (error) {
            console.error(error);
            throw error;
        }
    };

    useEffect(() => {
        chatMessageStreamEnd.current?.scrollIntoView({ behavior: "smooth" });
        if (dataConversation.length > 0) {
            chatContainerRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
        }
        if (triggered.current === false) {
            triggered.current = true;
        }
        const language = navigator.language;
        if (language.startsWith("pt")) {
            setPlaceholderText("Escreva aqui sua pergunta");
        }
        if (language.startsWith("es")) {
            setPlaceholderText("Escribe tu pregunta aqui");
        } else {
            setPlaceholderText("Write your question here");
        }

        // fill answers with data from dataConversation
        setAnswers(
            dataConversation.map(data => [
                data.user,
                {
                    answer: data?.bot?.message || "",
                    data_points: [],
                    thoughts: data?.bot?.thoughts ?? null
                }
            ])
        );
    }, [isLoading, dataConversation]);

    const extractAfterDomain = (url: string) => {
        const extensions = [".net", ".com"];

        for (const ext of extensions) {
            const index = url.lastIndexOf(ext);
            if (index !== -1) {
                let currentUrl = url.substring(index + ext.length);
                if (currentUrl.startsWith("/")) {
                    currentUrl = currentUrl.substring(1);
                }
                return currentUrl;
            }
        }
        return url;
    };

    // Treat .xlsx, .xls, and .csv uniformly as spreadsheets for preview
    const isSpreadsheet = (path: string) => {
        const p = path.toLowerCase();
        return p.endsWith(".xlsx") || p.endsWith(".xls") || p.endsWith(".csv");
    };

    const previewSpreadsheet = async (citation: string, fileName: string, index: number) => {
        setLoadingCitationPath(fileName);
        try {
            const downloadInfo = await generateExcelDownloadUrl(citation);
            const isLocalHost = ["localhost", "127.0.0.1"].includes(window.location.hostname);
            const isCsv = citation.toLowerCase().endsWith(".csv");

            // Choose the best source for Office Web Viewer
            let sourceUrl = downloadInfo.preview_url || downloadInfo.download_url;
            if (isLocalHost) {
                if (isCsv) {
                    // On localhost, Office viewer cannot reach our local server; trigger direct download instead
                    const a = document.createElement("a");
                    a.href = downloadInfo.download_url; // streams XLSX bytes for CSV
                    a.download = downloadInfo.filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    return; // do not open preview panel for CSV on localhost
                }
                if (downloadInfo.sas_url) {
                    sourceUrl = downloadInfo.sas_url; // publicly reachable blob URL for Excel
                }
            }

            const officeEmbedUrl = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(sourceUrl)}`;

            setSpreadsheetDownloadUrl(downloadInfo.download_url);
            setSpreadsheetFileName(downloadInfo.filename);
            setActiveCitation(officeEmbedUrl);
            setFileType("spreadsheet-embed");
            setActiveAnalysisPanelTab(AnalysisPanelTabs.CitationTab);
            setSelectedAnswer(index);
        } finally {
            setLoadingCitationPath(null);
        }
    };

    const handleAttachFiles = async (files: File[]) => {
        if (!files?.length) return;

        // Clear any previous error
        setFileUploadError("");

        // AC3: Max 3 documents validation
        if (attachedDocs.length + files.length > CHAT_MAX_ATTACHED_FILES) {
            setFileUploadError(`Too many files. You can attach up to 3 documents maximum.`);
            return;
        }

        try {
            setIsUploadingDocs(true);
            const allowed = CHAT_ATTACHMENT_ALLOWED_TYPES.map(ext => ext.toLowerCase());
            const maxSizeInBytes = 10 * 1024 * 1024; // 10MB
            const activeConversationId = getOrCreateConversationId();
            if (!user?.organizationId) {
                setFileUploadError("Organization ID not available");
                return;
            }

            for (const file of files) {
                const name = file.name.toLowerCase();
                if (!allowed.some(ext => name.endsWith(ext))) {
                    const fileExtension = name.split(".").pop() || "unknown";
                    setFileUploadError(`Unsupported type .${fileExtension}. Supported types: PDF`);
                    return;
                }
                if (file.size > maxSizeInBytes) {
                    setFileUploadError(`File too large (10 MB max). Try splitting your document.`);
                    return;
                }

                const result = await uploadUserDocument({
                    file,
                    conversationId: activeConversationId,
                    user
                });
                if (result?.blob_name) {
                    setAttachedDocs(prev => [
                        ...prev,
                        {
                            blobName: result.blob_name,
                            originalFilename: result.original_filename || file.name,
                            savedFilename: result.saved_filename || file.name
                        }
                    ]);
                }
            }
        } catch (err) {
            console.error("Error uploading user docs:", err);
            setFileUploadError("Failed to upload one or more documents.");
        } finally {
            setIsUploadingDocs(false);
        }
    };

    async function handleRemoveAttachment(index: number) {
        const doc = attachedDocs[index];
        if (!doc) return;
        try {
            setIsUploadingDocs(true);
            const activeConversationId = getOrCreateConversationId();
            if (!user?.organizationId) {
                setFileUploadError("Organization ID not available");
                return;
            }
            await deleteUserDocument({
                blobName: doc.blobName,
                conversationId: activeConversationId,
                user
            });
        } catch (err) {
            console.error("Error deleting user doc:", err);
        } finally {
            setIsUploadingDocs(false);
            setAttachedDocs(prev => prev.filter((_, i) => i !== index));
            setFileUploadError("");
        }
    }

    // Rehydrate attachment chips when conversation is available
    useEffect(() => {
        const convId = chatId || conversationId;
        if (!user?.organizationId || !convId) return;
        let cancelled = false;
        (async () => {
            try {
                const files = await listUserDocuments({
                    conversationId: convId,
                    user
                });
                if (cancelled) return;
                const mapped = files.map(f => ({
                    blobName: f.blob_name,
                    originalFilename: f.original_filename || f.saved_filename,
                    savedFilename: f.saved_filename
                }));
                setAttachedDocs(mapped);
            } catch (e) {
                // do not block chat on rehydrate errors
            }
        })();
        return () => {
            cancelled = true;
        };
    }, [user?.organizationId, chatId, conversationId]);

    const onShowCitation = async (citation: string, fileName: string, index: number) => {
        if (isSpreadsheet(citation)) {
            try {
                await previewSpreadsheet(citation, fileName, index);
                return;
            } catch (error) {
                return window.open(citation, "_blank");
            }
        }
        // Handle PPTX/PPT files separately - use blob name for SAS URL generation
        if (citation.endsWith(".ppt") || citation.endsWith(".pptx")) {
            // Extract filepath if necessary
            const modifiedFilename = extractAfterDomain(fileName);

            if (activeCitation === citation && activeAnalysisPanelTab === AnalysisPanelTabs.CitationTab && selectedAnswer === index) {
                setActiveAnalysisPanelTab(undefined);
            } else {
                setLoadingCitationPath(fileName);
                // For PPTX files, store the blob name in a special format so PPTXViewer can fetch SAS URL
                setFileType("pptx");
                setActiveCitation(`pptx-blob://${modifiedFilename}`);
                setActiveAnalysisPanelTab(AnalysisPanelTabs.CitationTab);
                setLoadingCitationPath(null);
            }

            setSelectedAnswer(index);
            return;
        }

        // Handle PDF/DOC/DOCX files - load in analysis panel for preview
        if (citation.endsWith(".pdf") || citation.endsWith(".doc") || citation.endsWith(".docx")) {
            // Extract filepath if necessary
            const modifiedFilename = extractAfterDomain(fileName);

            if (activeCitation === citation && activeAnalysisPanelTab === AnalysisPanelTabs.CitationTab && selectedAnswer === index) {
                setActiveAnalysisPanelTab(undefined);
            } else {
                setLoadingCitationPath(fileName);
                const response = await getFileBlobWithState(modifiedFilename, "documents");
                var file = new Blob([response as BlobPart]);
                readFile(file);

                function readFile(input: Blob) {
                    const fr = new FileReader();
                    fr.readAsDataURL(input);
                    fr.onload = function (event) {
                        const res: any = event.target ? event.target.result : undefined;
                        setActiveCitation(res);
                    };
                }
                setActiveAnalysisPanelTab(AnalysisPanelTabs.CitationTab);
                setLoadingCitationPath(null);
            }

            setSelectedAnswer(index);
            return;
        }

        // For all other file types, open in new tab
        return window.open(citation, "_blank");
    };

    const answerFromHistory = dataConversation.map(data => data.bot?.message);
    const thoughtsFromHistory = dataConversation.map(data => data.bot?.thoughts);

    const latestAnswerFromHistory = answerFromHistory.length > 0 ? answerFromHistory[answerFromHistory.length - 1] ?? "" : "";
    const latestThoughtFromHistory = thoughtsFromHistory.length > 0 ? thoughtsFromHistory[thoughtsFromHistory.length - 1] ?? null : null;

    const responseForPreviewPanel = {
        answer: latestAnswerFromHistory,
        conversation_id: chatId,
        data_points: [""],
        thoughts: latestThoughtFromHistory
    } as AskResponse;

    const onToggleTab = (tab: AnalysisPanelTabs, index: number) => {
        if (index !== selectedAnswer) {
            setActiveCitation(undefined);
            setActiveAnalysisPanelTab(undefined);
        }
        if (activeAnalysisPanelTab === tab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
            setSelectedAnswer(-1);
            setActiveCitation(undefined);
        } else {
            setActiveAnalysisPanelTab(tab);
        }
        setSelectedAnswer(index);
    };

    const hideTab = () => {
        setActiveAnalysisPanelTab(undefined);
        setActiveCitation(undefined);
        setFileType("");
        setSpreadsheetDownloadUrl(undefined);
        setSpreadsheetFileName(undefined);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
        const isCtrlOrCmd = event.ctrlKey || event.metaKey;
        const isAlt = event.altKey;

        if (event.code === "KeyO" && isCtrlOrCmd && isAlt) {
            event.preventDefault();
            clearChat();
        } else if (event.code === "KeyY" && isCtrlOrCmd && isAlt) {
            event.preventDefault();
            handleNewChat();
        }
    };

    window.addEventListener("keydown", handleKeyDown);

    const isButtonEnabled = !!(lastQuestionRef.current || dataConversation.length > 0 || chatIsCleaned);
    const [analysisPanelWidth, setAnalysisPanelWidth] = useState<number>(500);
    const [analysisPanelMinWidth, setAnalysisPanelMinWidth] = useState(350);
    const [analysisPanelMaxWidth, setAnalysisPanelMaxWidth] = useState(1000);
    const [windowWidth, setWindowWidth] = useState(window.innerWidth);

    const handleResizeMouseDown = (e: React.MouseEvent<HTMLDivElement>) => {
        setisResizingAnalysisPanel(true);
        const startX = e.clientX;
        const startWidth = analysisPanelWidth;
        document.body.style.userSelect = "none";

        // Create overlay to prevent iframe from capturing mouse events
        const overlay = document.createElement("div");
        overlay.style.position = "fixed";
        overlay.style.top = "0";
        overlay.style.left = "0";
        overlay.style.width = "100%";
        overlay.style.height = "100%";
        overlay.style.zIndex = "9999";
        overlay.style.cursor = "col-resize";
        overlay.style.backgroundColor = "transparent";
        document.body.appendChild(overlay);

        const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(analysisPanelMinWidth, Math.min(analysisPanelMaxWidth, startWidth - (moveEvent.clientX - startX)));
            setAnalysisPanelWidth(newWidth);
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.userSelect = "";
            setisResizingAnalysisPanel(false);
            // Remove overlay
            if (overlay.parentNode) {
                overlay.parentNode.removeChild(overlay);
            }
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    useEffect(() => {
        hideTab();
    }, [chatSelected]);

    useEffect(() => {
        const handleResize = () => {
            setWindowWidth(window.innerWidth);
            if (window.innerWidth < 700) {
                setAnalysisPanelMinWidth(120);
                setAnalysisPanelMaxWidth(window.innerWidth * 0.98);
                if (analysisPanelWidth > window.innerWidth * 0.98) {
                    setAnalysisPanelWidth(window.innerWidth * 0.98);
                }
            } else {
                setAnalysisPanelMinWidth(350);
                setAnalysisPanelMaxWidth(1000);
                if (analysisPanelWidth > 1000) {
                    setAnalysisPanelWidth(1000);
                }
            }
        };
        window.addEventListener("resize", handleResize);
        handleResize();
        return () => window.removeEventListener("resize", handleResize);
    }, [analysisPanelWidth]);

    // Cleanup effect to remove any leftover resize overlays on component unmount
    useEffect(() => {
        return () => {
            // Remove any resize overlay that might still be in the DOM
            const overlays = document.querySelectorAll('div[style*="z-index: 9999"][style*="cursor: col-resize"]');
            overlays.forEach(overlay => {
                if (overlay.parentNode) {
                    overlay.parentNode.removeChild(overlay);
                }
            });
        };
    }, []);

    return (
        <>
            <div className={styles.mainContainer} style={{ display: "flex", flexDirection: "row-reverse", flex: 1, overflow: "hidden" }}>
                <div>
                    {/* <div className={showFeedbackRatingPanel ? styles.commandsContainer : styles.hidden}>{showFeedbackRatingPanel && <FeedbackRating />}</div> */}
                </div>

                <div className={styles.container}>
                    <div className={styles.chatRoot}>
                        <div style={{ display: "flex", flexDirection: "row", width: "100%", height: "100%" }}>
                            <div className={styles.chatContainer} style={{ flex: 1, minWidth: 0 }}>
                                {!lastQuestionRef.current && dataConversation.length <= 0 ? (
                                    <div className={dataConversation.length > 0 && !conversationIsLoading ? styles.chatMessageStream : styles.chatEmptyState}>
                                        {conversationIsLoading && <Spinner size={3} className={styles.spinnerStyles} />}
                                        <div className={conversationIsLoading ? styles.noneDisplay : styles.flexDescription}>
                                            <h1>
                                                <img height="100px" src={FreddaidLogo} alt="FreddAid 4.1"></img>
                                            </h1>

                                            <p style={{ width: "80%", textAlign: "center" }}>
                                                Your AI-driven Marketing expert who boosts marketing performance by synthesizing multiple data sources to
                                                deliver actionable insights.
                                            </p>
                                        </div>
                                    </div>
                                ) : (
                                    <div className={styles.chatScrollWrapper} aria-label="Chat messages scroll wrapper" tabIndex={0}>
                                        <div className={!conversationIsLoading ? styles.chatMessageStream : styles.conversationIsLoading}>
                                            {conversationIsLoading && <Spinner size={3} className={styles.spinnerStyles} />}
                                            {dataConversation.length > 0
                                                ? dataConversation.map((item, index) => {
                                                      const response = {
                                                          answer: item.bot?.message || "",
                                                          conversation_id: chatId,
                                                          data_points: [""],
                                                          thoughts: item.bot?.thoughts ?? null
                                                      } as AskResponse;
                                                      return (
                                                          <div key={index} className={conversationIsLoading ? styles.noneDisplay : ""}>
                                                              <UserChatMessage message={item.user} />
                                                              <div className={styles.chatMessageGpt} role="region" aria-label="Chat message" data-cy="chat-msg">
                                                                  <Answer
                                                                      key={index}
                                                                      answer={response}
                                                                      isGenerating={false}
                                                                      isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                                                      loadingCitationPath={loadingCitationPath}
                                                                      onCitationClicked={(c, n) => onShowCitation(c, n, index)}
                                                                      onThoughtProcessClicked={() => onToggleTab(AnalysisPanelTabs.ThoughtProcessTab, index)}
                                                                      onSupportingContentClicked={() =>
                                                                          onToggleTab(AnalysisPanelTabs.SupportingContentTab, index)
                                                                      }
                                                                      onFollowupQuestionClicked={question => {
                                                                          const blobNames = attachedDocs.map(d => d.blobName);
                                                                          streamResponse(question, chatId !== "" ? chatId : null, blobNames);
                                                                      }}
                                                                      showFollowupQuestions={false}
                                                                      showSources={true}
                                                                  />
                                                              </div>
                                                          </div>
                                                      );
                                                  })
                                                : answers.map((answer, index) => {
                                                      return (
                                                          <div key={index} className={conversationIsLoading ? styles.noneDisplay : ""}>
                                                              <UserChatMessage message={answer[0]} />
                                                              <div className={styles.chatMessageGpt} role="region" aria-label="Chat message" data-cy="chat-msg">
                                                                  <Answer
                                                                      key={index}
                                                                      answer={answer[1]}
                                                                      isGenerating={false}
                                                                      isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                                                      loadingCitationPath={loadingCitationPath}
                                                                      onCitationClicked={(c, n) => onShowCitation(c, n, index)}
                                                                      onThoughtProcessClicked={() => onToggleTab(AnalysisPanelTabs.ThoughtProcessTab, index)}
                                                                      onSupportingContentClicked={() =>
                                                                          onToggleTab(AnalysisPanelTabs.SupportingContentTab, index)
                                                                      }
                                                                      onFollowupQuestionClicked={question => {
                                                                          const blobNames = attachedDocs.map(d => d.blobName);
                                                                          streamResponse(question, chatId !== "" ? chatId : null, blobNames);
                                                                      }}
                                                                      showFollowupQuestions={false}
                                                                      showSources={true}
                                                                  />
                                                              </div>
                                                          </div>
                                                      );
                                                  })}
                                            {error && !error403Data ? (
                                                <>
                                                    <UserChatMessage message={lastQuestionRef.current} />
                                                    <div className={styles.chatMessageGptMinWidth} role="alert" aria-live="assertive">
                                                        <AnswerError
                                                            error={error_message_text + error.toString()}
                                                            onRetry={() => {
                                                                const blobNames = attachedDocs.map(d => d.blobName);
                                                                streamResponse(lastQuestionRef.current, chatId !== "" ? chatId : null, blobNames);
                                                            }}
                                                        />
                                                    </div>
                                                </>
                                            ) : null}
                                            {error403Data ? (
                                                <div className={styles.limitExceeded} role="alert" aria-live="assertive">
                                                    <div className={styles.errorIcon}>
                                                        <Warning28Regular color="#E29D6B" />
                                                    </div>
                                                    <div>
                                                        <h1>{get403ErrorMessages(error403Data.errorCode, error403Data.nextPeriodStart).title}</h1>
                                                        <p>{get403ErrorMessages(error403Data.errorCode, error403Data.nextPeriodStart).message}</p>
                                                    </div>
                                                </div>
                                            ) : null}
                                            {lastQuestionRef.current !== "" && (
                                                <>
                                                    <UserChatMessage message={lastQuestionRef.current} />
                                                    <div className={styles.chatMessageGpt} role="region" aria-label="Chat message" data-cy="chat-msg">
                                                        <Answer
                                                            answer={
                                                                {
                                                                    answer: lastAnswer,
                                                                    conversation_id: chatId,
                                                                    data_points: [""],
                                                                    thoughts: null
                                                                } as AskResponse
                                                            }
                                                            isGenerating={isLoading}
                                                            progressState={progressState}
                                                            thinkingContent={thinkingContent}
                                                            isSelected={activeAnalysisPanelTab !== undefined}
                                                            loadingCitationPath={loadingCitationPath}
                                                            onCitationClicked={(c, n) => {}}
                                                            onThoughtProcessClicked={() => {}}
                                                            onSupportingContentClicked={() => {}}
                                                            onFollowupQuestionClicked={q => {}}
                                                            showFollowupQuestions={false}
                                                            showSources={true}
                                                        />
                                                    </div>
                                                </>
                                            )}
                                            <div ref={chatMessageStreamEnd} />
                                        </div>
                                    </div>
                                )}
                                <div
                                    className={styles.chatInputContainer}
                                    style={{
                                        width: activeAnalysisPanelTab ? windowWidth - analysisPanelWidth : "100%"
                                    }}
                                >
                                    {/* File upload error message */}

                                    {/* Attachment display - outside of chat input */}
                                    {attachedDocs.length > 0 && (
                                        <div className={styles.attachmentDisplay} role="status" aria-live="polite">
                                            {attachedDocs.map((doc, index) => (
                                                <div key={index} className={styles.attachmentChip}>
                                                    <span className={styles.attachmentName}>{doc.originalFilename}</span>
                                                    <button
                                                        type="button"
                                                        className={styles.removeChipBtn}
                                                        aria-label={`Remove attachment ${doc.originalFilename}`}
                                                        onClick={() => handleRemoveAttachment(index)}
                                                    >
                                                        ×
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    <div
                                        className={`${styles.chatInput} ${isDragOver ? styles.chatInputDragOver : ""}`}
                                        onDragOver={e => {
                                            e.preventDefault();
                                            setIsDragOver(true);
                                        }}
                                        onDragLeave={() => setIsDragOver(false)}
                                        onDrop={e => {
                                            e.preventDefault();
                                            setIsDragOver(false);
                                            const files = Array.from(e.dataTransfer?.files || []);
                                            if (files.length) handleAttachFiles(files);
                                        }}
                                    >
                                        <QuestionInput
                                            clearOnSend
                                            placeholder={placeholderText}
                                            disabled={isLoading || isUploadingDocs || !!error403Data}
                                            onSend={question => {
                                                (async () => {
                                                    const blobNames = attachedDocs.map(d => d.blobName);
                                                    await streamResponse(question, chatId !== "" ? chatId : null, blobNames);
                                                    setFileUploadError("");
                                                })();
                                            }}
                                            extraButtonNewChat={<StartNewChatButton isEnabled={isButtonEnabled} onClick={handleNewChat} />}
                                            extraButtonDataAnalyst={
                                                <DataAnalystButton
                                                    isEnabled={!isLoading && !isUploadingDocs}
                                                    isActive={isDataAnalystMode}
                                                    ariaLabel="Data analyst mode"
                                                    onChange={setIsDataAnalystMode}
                                                />
                                            }
                                            extraButtonAttach={
                                                <AttachButton
                                                    isEnabled={!isLoading && !isUploadingDocs && attachedDocs.length < CHAT_MAX_ATTACHED_FILES}
                                                    isUploading={isUploadingDocs}
                                                    onFilesSelected={handleAttachFiles}
                                                    accept={ATTACH_ACCEPT}
                                                    multiple={attachedDocs.length < CHAT_MAX_ATTACHED_FILES}
                                                    ariaLabel="Attach file"
                                                />
                                            }
                                        />
                                    </div>
                                    <div className={styles.chatDisclaimer}>
                                        <p className={styles.noMargin}>This app is in beta. Responses may not be fully accurate.</p>
                                    </div>
                                    {fileUploadError && (
                                        <div className={styles.fileUploadError} role="alert" aria-live="assertive">
                                            <span className={styles.errorIcon}>✕</span>
                                            <span>{fileUploadError}</span>
                                        </div>
                                    )}
                                </div>
                            </div>
                            {(answers.length > 0 && activeAnalysisPanelTab && answers[selectedAnswer]) ||
                            (dataConversation.length > 0 && fileType !== "" && activeAnalysisPanelTab) ? (
                                <>
                                    <div className={styles.analysisResizeHandle} onMouseDown={handleResizeMouseDown} style={{ cursor: "col-resize" }} />

                                    <div
                                        style={{
                                            width: analysisPanelWidth,
                                            minWidth: analysisPanelMinWidth,
                                            maxWidth: analysisPanelMaxWidth,
                                            transition: "width 0.1s",
                                            background: "#fff",
                                            height: "100%"
                                        }}
                                    >
                                        {isResizingAnalysisPanel && (
                                            <div
                                                style={{
                                                    width: "100%",
                                                    height: "100%",
                                                    background: "#fff",
                                                    display: "flex",
                                                    justifyContent: "center",
                                                    alignItems: "center"
                                                }}
                                            >
                                                <h4>Resizing...</h4>
                                            </div>
                                        )}
                                        {!isResizingAnalysisPanel && (
                                            <AnalysisPanel
                                                className={styles.chatAnalysisPanel}
                                                activeCitation={activeCitation}
                                                onActiveTabChanged={x => {
                                                    onToggleTab(x, selectedAnswer);
                                                }}
                                                citationHeight="810px"
                                                answer={answers.length > 0 && answers[selectedAnswer] ? answers[selectedAnswer]?.[1] : responseForPreviewPanel}
                                                activeTab={activeAnalysisPanelTab}
                                                fileType={fileType}
                                                onHideTab={hideTab}
                                                spreadsheetDownloadUrl={spreadsheetDownloadUrl}
                                                spreadsheetFileName={spreadsheetFileName}
                                                onCitationClicked={(c, n) => onShowCitation(c, n, selectedAnswer)}
                                            />
                                        )}
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
};

export default Chat;
