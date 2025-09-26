import { useRef, useState, useEffect } from "react";
import { Spinner } from "@fluentui/react";

import styles from "./Chatcopy.module.css";

import { Approaches, AskResponse, ChatRequestGpt, ChatTurn, exportConversation, getFileBlob, generateExcelDownloadUrl } from "../../api";
import { Answer, AnswerError } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput/QuestionInputcopy";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { getFileType } from "../../utils/functions";
import { useAppContext } from "../../providers/AppProviders";
import StartNewChatButton from "../../components/StartNewChatButton/StartNewChatButtoncopy";
import AttachButton from "../../components/AttachButton/AttachButton";
import { ALLOWED_FILE_TYPES } from "../../constants";

import "react-toastify/dist/ReactToastify.css";
import FreddaidLogo from "../../img/FreddaidLogo.png";

import React from "react";
import { parseStreamWithMarkdownValidation, ParsedEvent, isProgressMessage, isThoughtsMessage, extractProgressState, ProgressMessage } from "./streamParser";

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
    const ATTACH_ACCEPT = ALLOWED_FILE_TYPES.join(",");
    const [attachedFile, setAttachedFile] = useState<{ file: File; name: string; previewUrl: string } | null>(null);
    const [fileUploadError, setFileUploadError] = useState<string>("Theres AN ERROR AHHHHHH");

    const [isDragOver, setIsDragOver] = useState(false);

    const chatContainerRef = useRef<HTMLDivElement>(null);

    const {
        dataConversation,
        setDataConversation,
        chatId,
        conversationIsLoading,
        setRefreshFetchHistory,
        setChatId,
        setChatSelected,
        setChatIsCleaned,
        chatIsCleaned,
        user,
        isFinancialAssistantActive,
        setisResizingAnalysisPanel
    } = useAppContext();

    const lastQuestionRef = useRef<string>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const [fileType, setFileType] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [activeCitation, setActiveCitation] = useState<string>();
    const [spreadsheetDownloadUrl, setSpreadsheetDownloadUrl] = useState<string | undefined>(undefined);
    const [spreadsheetFileName, setSpreadsheetFileName] = useState<string | undefined>(undefined);
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: AskResponse][]>([]);

    const [userId, setUserId] = useState<string>(""); // this is more like a conversation id instead of a user id
    const triggered = useRef(false);

    const [lastAnswer, setLastAnswer] = useState<string>("");
    const [progressState, setProgressState] = useState<{ step: string; message: string; progress?: number; timestamp?: number } | null>(null);
    const restartChat = useRef<boolean>(false);
    const [loadingCitationPath, setLoadingCitationPath] = useState<string | null>(null);

    const streamResponse = async (question: string, chatId: string | null) => {
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

        const agent = "consumer";
        // const agent = isFinancialAssistantActive ? "financial" : "consumer";

        let history: ChatTurn[] = [];
        if (dataConversation.length > 0) {
            history.push(...dataConversation);
        } else {
            history.push(...answers.map(a => ({ user: a[0], bot: { message: a[1]?.answer, thoughts: a[1]?.thoughts || [] } })));
        }
        history.push({ user: question, bot: undefined });
        const request: ChatRequestGpt = {
            history: history,
            approach: Approaches.ReadRetrieveRead,
            conversation_id: chatId !== null ? chatId : userId,
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
            const response = await fetch("/stream_chatgpt", {
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
                    user_timezone: Intl.DateTimeFormat().resolvedOptions().timeZone
                })
            });

            if (!response.body) {
                throw new Error("ReadableStream not supported in this browser.");
            }

            /* ---------- 3 · Consume the stream via our parser with markdown validation ---------- */
            const reader = response.body.getReader();
            let result = "";
            let ctrlMsg: { conversation_id?: string; thoughts?: string } = {};

            for await (const evt of parseStreamWithMarkdownValidation(reader)) {
                /* allow user to abort mid-stream */
                if (restartChat.current) {
                    handleNewChat();
                    return;
                }

                if (evt.type === "json") {
                    // ---- Handle different types of JSON messages from backend ----
                    if (isProgressMessage(evt.payload)) {
                        // Progress message - update progress state
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

                thoughts: ctrlMsg.thoughts ?? ""
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
        if (lastQuestionRef.current || dataConversation.length > 0 || !chatIsCleaned) {
            lastQuestionRef.current = "";
            error && setError(undefined);
            setActiveCitation(undefined);
            setActiveAnalysisPanelTab(undefined);
            setAnswers([]);
            setDataConversation([]);
            setChatIsCleaned(true);
        } else {
            return;
        }
    };

    const handleNewChat = () => {
        if (lastQuestionRef.current || dataConversation.length > 0 || chatIsCleaned) {
            restartChat.current = true;
            lastQuestionRef.current = "";
            error && setError(undefined);
            setActiveCitation(undefined);
            setActiveAnalysisPanelTab(undefined);
            setAnswers([]);
            setDataConversation([]);
            setChatId("");
            setUserId("");
            setChatSelected("");
            setChatIsCleaned(false);
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
                    thoughts: data?.bot?.thoughts || []
                }
            ])
        );
    }, [isLoading, dataConversation]);

    useEffect(() => {
        return () => {
            if (attachedFile?.previewUrl) URL.revokeObjectURL(attachedFile.previewUrl);
        };
    }, [attachedFile]);

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

        const file = files[0];
        const name = file.name.toLowerCase();
        const allowed = ALLOWED_FILE_TYPES.map(ext => ext.toLowerCase());
        if (!allowed.some(ext => name.endsWith(ext))) {
            const allowedTypesString = ALLOWED_FILE_TYPES.join(", ");
            setFileUploadError(`Unsupported file type! Please upload: ${allowedTypesString} (max 50MB)`);
            return;
        }

        if (attachedFile?.previewUrl) URL.revokeObjectURL(attachedFile.previewUrl);

        const previewUrl = URL.createObjectURL(file);
        setAttachedFile({ file, name: file.name, previewUrl });
    };

    function handleRemoveAttachment() {
        if (attachedFile?.previewUrl) URL.revokeObjectURL(attachedFile.previewUrl);
        setAttachedFile(null);
        setFileUploadError(""); // Clear error when removing attachment
    }

    const onShowCitation = async (citation: string, fileName: string, index: number) => {
        if (isSpreadsheet(citation)) {
            try {
                await previewSpreadsheet(citation, fileName, index);
                return;
            } catch (error) {
                return window.open(citation, "_blank");
            }
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

    const responseForPreviewPanel = {
        answer: answerFromHistory.toString(),
        conversation_id: chatId,
        data_points: [""],
        thoughts: thoughtsFromHistory.toString()
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
        const handleResize = () => {
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
                {/* <FinancialPopup /> */}
                <div className={styles.container}>
                    <div className={styles.chatRoot}>
                        <div style={{ display: "flex", flexDirection: "row", width: "100%", height: "100%" }}>
                            <div className={styles.chatContainer} style={{ flex: 1, minWidth: 0 }}>
                                {!lastQuestionRef.current && dataConversation.length <= 0 ? (
                                    <div className={dataConversation.length > 0 && !conversationIsLoading ? styles.chatMessageStream : styles.chatEmptyState}>
                                        {conversationIsLoading && <Spinner size={3} className={styles.spinnerStyles} />}
                                        {!isFinancialAssistantActive && (
                                            <div className={conversationIsLoading ? styles.noneDisplay : styles.flexDescription}>
                                                <h1>
                                                    <img height="100px" src={FreddaidLogo} alt="FreddAid 4.1"></img>
                                                </h1>

                                                <p style={{ width: "80%", textAlign: "center" }}>
                                                    Your AI-driven Home Improvement expert who boosts marketing performance by synthesizing multiple data
                                                    sources to deliver actionable insights.
                                                </p>
                                            </div>
                                        )}
                                        {/* {isFinancialAssistantActive && (
                                            <div className={conversationIsLoading ? styles.noneDisplay : styles.flexDescription}>
                                                <img height="70px" src={FreddaidLogoFinlAi} alt="FreddAid 4.1"></img>
                                                <h1>FinlAI</h1>

                                                <p style={{ width: "80%", textAlign: "center" }}>
                                                    Your financial ally, delivering real-time insights and strategic guidance to help you stay ahead of
                                                    opportunities and threats in an ever-changing financial landscape.
                                                </p>
                                            </div>
                                        )} */}
                                    </div>
                                ) : (
                                    <div
                                        className={!conversationIsLoading ? styles.chatMessageStream : styles.conversationIsLoading}
                                        aria-label="Chat messages"
                                        tabIndex={0}
                                    >
                                        {conversationIsLoading && <Spinner size={3} className={styles.spinnerStyles} />}
                                        {dataConversation.length > 0
                                            ? dataConversation.map((item, index) => {
                                                  const response = {
                                                      answer: item.bot?.message || "",
                                                      conversation_id: chatId,
                                                      data_points: [""],
                                                      thoughts: item.bot?.thoughts || []
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
                                                                  onSupportingContentClicked={() => onToggleTab(AnalysisPanelTabs.SupportingContentTab, index)}
                                                                  onFollowupQuestionClicked={question =>
                                                                      streamResponse(question, chatId !== "" ? chatId : null)
                                                                  }
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
                                                                  onSupportingContentClicked={() => onToggleTab(AnalysisPanelTabs.SupportingContentTab, index)}
                                                                  onFollowupQuestionClicked={question =>
                                                                      streamResponse(question, chatId !== "" ? chatId : null)
                                                                  }
                                                                  showFollowupQuestions={false}
                                                                  showSources={true}
                                                              />
                                                          </div>
                                                      </div>
                                                  );
                                              })}
                                        {error ? (
                                            <>
                                                <UserChatMessage message={lastQuestionRef.current} />
                                                <div className={styles.chatMessageGptMinWidth} role="alert" aria-live="assertive">
                                                    <AnswerError
                                                        error={error_message_text + error.toString()}
                                                        onRetry={() => {
                                                            streamResponse(lastQuestionRef.current, chatId !== "" ? chatId : null);
                                                        }}
                                                    />
                                                </div>
                                            </>
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
                                                                thoughts: ""
                                                            } as AskResponse
                                                        }
                                                        isGenerating={isLoading}
                                                        progressState={progressState}
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
                                )}
                                <div className={styles.chatInputContainer}>
                                    {/* File upload error message */}

                                    {/* Attachment display - outside of chat input */}
                                    {attachedFile && (
                                        <div className={styles.attachmentDisplay} role="status" aria-live="polite">
                                            <div className={styles.attachmentChip}>
                                                <span className={styles.attachmentName}>{attachedFile.name}</span>
                                                <button
                                                    type="button"
                                                    className={styles.removeChipBtn}
                                                    aria-label="Remove attachment"
                                                    onClick={handleRemoveAttachment}
                                                >
                                                    ×
                                                </button>
                                            </div>
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
                                            disabled={isLoading}
                                            onSend={question => {
                                                streamResponse(question, chatId !== "" ? chatId : null);
                                                setAttachedFile(null);
                                                setFileUploadError(""); // Clear error when sending
                                            }}
                                            extraButtonNewChat={<StartNewChatButton isEnabled={isButtonEnabled} onClick={handleNewChat} />}
                                            extraButtonAttach={
                                                <AttachButton
                                                    isEnabled={!isLoading}
                                                    isUploading={false}
                                                    onFilesSelected={handleAttachFiles}
                                                    accept={ATTACH_ACCEPT}
                                                    multiple={false}
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
                                        />
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
