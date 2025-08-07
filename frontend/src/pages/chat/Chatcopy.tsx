import { useRef, useState, useEffect } from "react";
import { Spinner } from "@fluentui/react";

import styles from "./Chatcopy.module.css";

import { chatApiGpt, Approaches, AskResponse, ChatRequestGpt, ChatTurn, exportConversation } from "../../api";
import { Answer, AnswerError } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput/QuestionInputcopy";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { getTokenOrRefresh } from "../../components/QuestionInput/token_util";
import { SpeechConfig, AudioConfig, SpeechSynthesizer, ResultReason } from "microsoft-cognitiveservices-speech-sdk";
import { getFileType } from "../../utils/functions";
import { useAppContext } from "../../providers/AppProviders";
// import { ChatHistoryPanel } from "../../components/HistoryPannel/ChatHistoryPanel";
//import { FeedbackRating } from "../../components/FeedbackRating/FeedbackRating";
import StartNewChatButton from "../../components/StartNewChatButton/StartNewChatButtoncopy";
import DownloadButton from "../../components/DownloadButton/DownloadButton";
import FinancialPopup from "../../components/FinancialAssistantPopup/FinancialAssistantPopup";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import FreddaidLogo from "../../img/FreddaidLogo.png";
import FreddaidLogoFinlAi from "../../img/FreddAidFinlAi.png";
import React from "react";
import { parseStream, ParsedEvent } from "./streamParser";

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
        documentName,
        setisResizingAnalysisPanel
    } = useAppContext();

    const lastQuestionRef = useRef<string>("");
    const lastFileBlobUrl = useRef<string | null>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const [fileType, setFileType] = useState<string>("");
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isDownloading, setIsDownloading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: AskResponse][]>([]);

    const [userId, setUserId] = useState<string>(""); // this is more like a conversation id instead of a user id
    const triggered = useRef(false);

    const [lastAnswer, setLastAnswer] = useState<string>("");
    const restartChat = useRef<boolean>(false);

    const streamResponse = async (question: string, chatId: string | null, fileBlobUrl: string | null) => {
        /* ---------- 0 · Common pre-flight state handling ---------- */
        lastQuestionRef.current = question;
        lastFileBlobUrl.current = fileBlobUrl;
        restartChat.current = false;
        if (error) {
            setError(undefined);
        }
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);
        setLastAnswer("");

        const agent = isFinancialAssistantActive ? "financial" : "consumer";

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
            file_blob_url: fileBlobUrl || "",
            documentName,
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
                    url: request.file_blob_url,
                    agent: request.agent,
                    documentName: request.documentName
                })
            });

            if (!response.body) {
                throw new Error("ReadableStream not supported in this browser.");
            }

            /* ---------- 3 · Consume the stream via our parser ---------- */
            const reader = response.body.getReader();
            let result = "";
            let ctrlMsg: { conversation_id?: string; thoughts?: string[] } = {};

            for await (const evt of parseStream(reader)) {
                /* allow user to abort mid-stream */
                if (restartChat.current) {
                    handleNewChat();
                    return;
                }

                if (evt.type === "json") {
                    // ---- control message arriving from backend ----
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
                } else {
                    // ---- plain text / IMAGE_PREVIEW ----
                    result += evt.payload;
                    setLastAnswer(result); // incremental UI update
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
            const botResponse: AskResponse = {
                answer: result || "",
                conversation_id: ctrlMsg.conversation_id ?? "",
                data_points: [""],
                thoughts: ctrlMsg.thoughts ?? []
            };

            setAnswers(prev => [...prev, [question, botResponse]]);
            setDataConversation(prev => [...prev, { user: question, bot: { message: botResponse.answer, thoughts: botResponse.thoughts } }]);
            lastQuestionRef.current = "";
        } catch (err) {
            console.error("Error fetching streamed response:", err);
            setError(err as Error);
        } finally {
            setIsLoading(false);
        }
    };

    const makeApiRequestGpt = async (question: string, chatId: string | null, fileBlobUrl: string | null) => {
        let agent = null;
        lastQuestionRef.current = question;
        lastFileBlobUrl.current = fileBlobUrl;

        error && setError(undefined);
        setIsLoading(true);
        setActiveCitation(undefined);
        setActiveAnalysisPanelTab(undefined);

        if (isFinancialAssistantActive == true) {
            agent = "financial";
        } else {
            agent = "consumer";
        }

        try {
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
                file_blob_url: fileBlobUrl || "",
                documentName,
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
            const result = await chatApiGpt(request, user);
            const conditionOne = answers.map(a => ({ user: a[0] }));
            if (conditionOne.length <= 0) {
                setRefreshFetchHistory(true);
                setChatId(result.conversation_id);
            } else {
                setRefreshFetchHistory(false);
            }
            setAnswers([...answers, [question, result]]);
            setUserId(result.conversation_id);
            const response = {
                answer: result.answer || "",
                conversation_id: chatId,
                data_points: [""],
                thoughts: result.thoughts || []
            } as AskResponse;
            setDataConversation([...dataConversation, { user: question, bot: { message: response.answer, thoughts: response.thoughts } }]);
            lastQuestionRef.current = "";

            // Voice Synthesis
            if (speechSynthesisEnabled) {
                const tokenObj = await getTokenOrRefresh();
                const speechConfig = SpeechConfig.fromAuthorizationToken(tokenObj.authToken, tokenObj.region);
                const audioConfig = AudioConfig.fromDefaultSpeakerOutput();
                speechConfig.speechSynthesisLanguage = tokenObj.speechSynthesisLanguage;
                speechConfig.speechSynthesisVoiceName = tokenObj.speechSynthesisVoiceName;
                const synthesizer = new SpeechSynthesizer(speechConfig, audioConfig);

                synthesizer.speakTextAsync(
                    result.answer.replace(/ *\[[^)]*\] */g, ""),
                    function (result) {
                        if (result.reason === ResultReason.SynthesizingAudioCompleted) {
                            console.log("synthesis finished.");
                        } else {
                            console.error("Speech synthesis canceled, " + result.errorDetails + "\nDid you update the subscription info?");
                        }
                        synthesizer.close();
                    },
                    function (err) {
                        console.trace("err - " + err);
                        synthesizer.close();
                    }
                );
            }
        } catch (e) {
            setError(e);
            console.log(e);
        } finally {
            setIsLoading(false);
        }
    };

    const clearChat = () => {
        if (lastQuestionRef.current || dataConversation.length > 0 || !chatIsCleaned) {
            lastQuestionRef.current = "";
            lastFileBlobUrl.current = "";
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
            lastFileBlobUrl.current = "";
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

    /**Get Pdf */
    const getPdf = async (pdfName: string) => {
        /** get file type */
        let type = getFileType(pdfName);
        setFileType(type);

        // Clear prefix ‘documents/’ if present
        const cleanedPdfName = pdfName.startsWith("documents/") ? pdfName.slice("documents/".length) : pdfName;
        try {
            const response = await fetch("/api/get-blob", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    blob_name: cleanedPdfName
                })
            });

            if (!response.ok) {
                throw new Error(`Error fetching DOC: ${response.status}`);
            }

            return await response.blob();
        } catch (error) {
            console.error(error);
            throw new Error("Error fetching DOC.");
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

    const onShowCitation = async (citation: string, fileName: string, index: number) => {
        if (!citation.endsWith(".pdf") && !citation.endsWith(".doc") && !citation.endsWith(".docx") && !citation.endsWith(".html")) {
            return window.open(citation, "_blank");
        }
        // Extract filepath if necessary
        const modifiedFilename = extractAfterDomain(fileName);

        const response = await getPdf(modifiedFilename);
        if (activeCitation === citation && activeAnalysisPanelTab === AnalysisPanelTabs.CitationTab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
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
        }

        setSelectedAnswer(index);
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

        const onMouseMove = (moveEvent: MouseEvent) => {
            const newWidth = Math.max(analysisPanelMinWidth, Math.min(analysisPanelMaxWidth, startWidth - (moveEvent.clientX - startX)));
            setAnalysisPanelWidth(newWidth);
        };

        const onMouseUp = () => {
            document.removeEventListener("mousemove", onMouseMove);
            document.removeEventListener("mouseup", onMouseUp);
            document.body.style.userSelect = "";
            setisResizingAnalysisPanel(false);
        };

        document.addEventListener("mousemove", onMouseMove);
        document.addEventListener("mouseup", onMouseUp);
    };

    useEffect(() => {
        const handleResize = () => {
            if (window.innerWidth < 700) {
                setAnalysisPanelMinWidth(120); // o el valor que prefieras para móvil
                setAnalysisPanelMaxWidth(window.innerWidth * 0.98); // 98% del ancho de pantalla
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

    return (
        <>
            <div className={styles.mainContainer} style={{ display: "flex", flexDirection: "row-reverse", flex: 1, overflow: "hidden" }}>
                <div>
                    {/* <div className={showFeedbackRatingPanel ? styles.commandsContainer : styles.hidden}>{showFeedbackRatingPanel && <FeedbackRating />}</div> */}
                </div>
                <FinancialPopup />
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
                                        {isFinancialAssistantActive && (
                                            <div className={conversationIsLoading ? styles.noneDisplay : styles.flexDescription}>
                                                <img height="70px" src={FreddaidLogoFinlAi} alt="FreddAid 4.1"></img>
                                                <h1>FinlAI</h1>

                                                <p style={{ width: "80%", textAlign: "center" }}>
                                                    Your financial ally, delivering real-time insights and strategic guidance to help you stay ahead of
                                                    opportunities and threats in an ever-changing financial landscape.
                                                </p>
                                            </div>
                                        )}
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
                                                                  isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                                                  onCitationClicked={(c, n) => onShowCitation(c, n, index)}
                                                                  onThoughtProcessClicked={() => onToggleTab(AnalysisPanelTabs.ThoughtProcessTab, index)}
                                                                  onSupportingContentClicked={() => onToggleTab(AnalysisPanelTabs.SupportingContentTab, index)}
                                                                  onFollowupQuestionClicked={q => makeApiRequestGpt(q, null, null)}
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
                                                                  isSelected={selectedAnswer === index && activeAnalysisPanelTab !== undefined}
                                                                  onCitationClicked={(c, n) => onShowCitation(c, n, index)}
                                                                  onThoughtProcessClicked={() => onToggleTab(AnalysisPanelTabs.ThoughtProcessTab, index)}
                                                                  onSupportingContentClicked={() => onToggleTab(AnalysisPanelTabs.SupportingContentTab, index)}
                                                                  onFollowupQuestionClicked={q => makeApiRequestGpt(q, null, null)}
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
                                                            streamResponse(lastQuestionRef.current, chatId !== "" ? chatId : null, lastFileBlobUrl.current);
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
                                                        isSelected={activeAnalysisPanelTab !== undefined}
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
                                    <div className={styles.chatInput}>
                                        <QuestionInput
                                            clearOnSend
                                            placeholder={placeholderText}
                                            disabled={isLoading}
                                            onSend={(question, fileBlobUrl) => {
                                                streamResponse(question, chatId !== "" ? chatId : null, fileBlobUrl || null);
                                            }}
                                            extraButtonNewChat={<StartNewChatButton isEnabled={isButtonEnabled} onClick={handleNewChat} />}
                                            extraButtonDownload={
                                                <DownloadButton
                                                    isEnabled={dataConversation.length > 0 || answers.length > 0}
                                                    isLoading={isDownloading}
                                                    onClick={handleDownloadConversation}
                                                />
                                            }
                                        />
                                    </div>
                                    <div className={styles.chatDisclaimer}>
                                        <p className={styles.noMargin}>This app is in beta. Responses may not be fully accurate.</p>
                                    </div>
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
                                        />
                                    </div>
                                </>
                            ) : null}
                        </div>
                    </div>
                </div>
            </div>
            <ToastContainer position="top-right" autoClose={3000} />
        </>
    );
};

export default Chat;
