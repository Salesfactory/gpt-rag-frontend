import { useRef, useState, useEffect, useContext } from "react";
import { Checkbox, Panel, DefaultButton, TextField, SpinButton, Spinner } from "@fluentui/react";

import styles from "./Chat.module.css";

import { chatApiGpt, Approaches, AskResponse, ChatRequestGpt, ChatTurn } from "../../api";
import { Answer, AnswerError, AnswerLoading } from "../../components/Answer";
import { QuestionInput } from "../../components/QuestionInput";
import { ExampleList } from "../../components/Example";
import { UserChatMessage } from "../../components/UserChatMessage";
import { AnalysisPanel, AnalysisPanelTabs } from "../../components/AnalysisPanel";
import { ClearChatButton } from "../../components/ClearChatButton";
import { getTokenOrRefresh } from "../../components/QuestionInput/token_util";
import { SpeechConfig, AudioConfig, SpeechSynthesizer, ResultReason } from "microsoft-cognitiveservices-speech-sdk";
import { getFileType } from "../../utils/functions";
import salesLogo from "../../img/logo.png";
import { useAppContext } from "../../providers/AppProviders";
import { ChatHistoryPanel } from "../../components/HistoryPannel/ChatHistoryPanel";
import { FeedbackRating } from "../../components/FeedbackRating/FeedbackRating";
import { SettingsPanel } from "../../components/SettingsPanel";
import StartNewChatButton from "../../components/StartNewChatButton/StartNewChatButton";

const userLanguage = navigator.language;
let error_message_text = "";
if (userLanguage.startsWith("pt")) {
    error_message_text = "Desculpe, tive um problema técnico com a solicitação. Por favor informar o erro a equipe de suporte. ";
} else if (userLanguage.startsWith("es")) {
    error_message_text = "Lo siento, yo tuve un problema con la solicitud. Por favor informe el error al equipo de soporte. ";
} else {
    error_message_text = "I'm sorry, I had a problem with the request. Please report the error to the support team. ";
}

const Chat = () => {
    // speech synthesis is disabled by default

    const { organization } = useAppContext();
    const speechSynthesisEnabled = false;

    const [placeholderText, setPlaceholderText] = useState("");
    const [isConfigPanelOpen, setIsConfigPanelOpen] = useState(false);
    const [promptTemplate, setPromptTemplate] = useState<string>("");
    const [retrieveCount, setRetrieveCount] = useState<number>(3);
    const [useSemanticRanker, setUseSemanticRanker] = useState<boolean>(true);
    const [useSemanticCaptions, setUseSemanticCaptions] = useState<boolean>(false);
    const [excludeCategory, setExcludeCategory] = useState<string>("");
    const [useSuggestFollowupQuestions, setUseSuggestFollowupQuestions] = useState<boolean>(false);

    const chatContainerRef = useRef<HTMLDivElement>(null);

    const {
        showHistoryPanel,
        showFeedbackRatingPanel,
        dataConversation,
        setDataConversation,
        chatId,
        conversationIsLoading,
        setRefreshFetchHistory,
        setChatId,
        setChatSelected,
        setChatIsCleaned,
        chatIsCleaned,
        settingsPanel,
        user,
        isFinancialAssistantActive,
        documentName
    } = useAppContext();

    const lastQuestionRef = useRef<string>("");
    const lastFileBlobUrl = useRef<string | null>("");
    const chatMessageStreamEnd = useRef<HTMLDivElement | null>(null);
    const [fileType, setFileType] = useState<string>("");

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [error, setError] = useState<unknown>();

    const [activeCitation, setActiveCitation] = useState<string>();
    const [activeAnalysisPanelTab, setActiveAnalysisPanelTab] = useState<AnalysisPanelTabs | undefined>(undefined);

    const [selectedAnswer, setSelectedAnswer] = useState<number>(0);
    const [answers, setAnswers] = useState<[user: string, response: AskResponse][]>([]);

    const [userId, setUserId] = useState<string>(""); // this is more like a conversation id instead of a user id
    const triggered = useRef(false);

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

        console.log("AGENT=", agent);
        console.log("isFinancialAssistant=", isFinancialAssistantActive);

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
            console.log(typeof e);
            console.log(Object.keys(e as object));
            console.log((e as Error).toString());
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

    /**Get Pdf */
    const getPdf = async (pdfName: string) => {
        /** get file type */
        let type = getFileType(pdfName);
        setFileType(type);
        try {
            const response = await fetch("/api/get-blob", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    blob_name: pdfName
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

    const onPromptTemplateChange = (_ev?: React.FormEvent<HTMLInputElement | HTMLTextAreaElement>, newValue?: string) => {
        setPromptTemplate(newValue || "");
    };

    const onRetrieveCountChange = (_ev?: React.SyntheticEvent<HTMLElement, Event>, newValue?: string) => {
        setRetrieveCount(parseInt(newValue || "3"));
    };

    const onUseSemanticRankerChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSemanticRanker(!!checked);
    };

    const onUseSemanticCaptionsChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSemanticCaptions(!!checked);
    };

    const onExcludeCategoryChanged = (_ev?: React.FormEvent, newValue?: string) => {
        setExcludeCategory(newValue || "");
    };

    const onUseSuggestFollowupQuestionsChange = (_ev?: React.FormEvent<HTMLElement | HTMLInputElement>, checked?: boolean) => {
        setUseSuggestFollowupQuestions(!!checked);
    };

    const onShowCitation = async (citation: string, fileName: string, index: number) => {
        if (!citation.endsWith(".pdf") && !citation.endsWith(".doc") && !citation.endsWith(".docx")) {
            return window.open(citation, "_blank");
        }
        const response = await getPdf(fileName);
        if (activeCitation === citation && activeAnalysisPanelTab === AnalysisPanelTabs.CitationTab && selectedAnswer === index) {
            setActiveAnalysisPanelTab(undefined);
        } else {
            //var file = new Blob([response as BlobPart], { type: "application/pdf" });
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
    //If I add this on a useEffect it doesn't work, I don't know why
    //maybe because it's a global event listener and is called multiple times

    const isButtonEnabled = !!(lastQuestionRef.current || dataConversation.length > 0 || chatIsCleaned);

    return (
        <div className={styles.mainContainer}>
            <div>
                <div className={showHistoryPanel ? styles.commandsContainer : styles.hidden}>
                    {showHistoryPanel && <ChatHistoryPanel functionDeleteChat={handleNewChat} />}
                </div>
            </div>
            <div>
                <div className={showFeedbackRatingPanel ? styles.commandsContainer : styles.hidden}>{showFeedbackRatingPanel && <FeedbackRating />}</div>
            </div>
            <div>
                <div className={settingsPanel ? styles.commandsContainer : styles.hidden}>{settingsPanel && <SettingsPanel />}</div>
            </div>
            <div className={styles.container}>
                <div className={styles.chatRoot}>
                    <div className={styles.chatContainer}>
                        {!lastQuestionRef.current && dataConversation.length <= 0 ? (
                            <div className={dataConversation.length > 0 && !conversationIsLoading ? styles.chatMessageStream : styles.chatEmptyState}>
                                {conversationIsLoading && <Spinner size={3} className={styles.spinnerStyles} />}
                                { !isFinancialAssistantActive &&
                                    <div className={conversationIsLoading ? styles.noneDisplay : styles.flexDescription}>
                                        <img height="40px" src={salesLogo} alt="Sales Factory logo"></img>
                                        <h1>FreddAid</h1>

                                        <p style={{ width: "80%", textAlign: "center" }}>
                                            Your AI-driven Home Improvement expert who boosts marketing performance by synthesizing multiple data sources to deliver
                                            actionable insights.
                                        </p>
                                    </div>
                                }

                                { isFinancialAssistantActive && 
                                    <div className={conversationIsLoading ? styles.noneDisplay : styles.flexDescription}>
                                        <img height="40px" src={salesLogo} alt="Sales Factory logo"></img>
                                        <h1>FreddAid</h1>
                                        <h4>Financial Assistant</h4>

                                        <p style={{ width: "80%", textAlign: "center" }}>
                                            Your AI-driven Home Improvement expert who boosts marketing performance by synthesizing multiple data sources to deliver
                                            actionable insights.
                                        </p>
                                    </div>
                                }
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
                                                  <div className={styles.chatMessageGpt} role="region" aria-label="Chat message">
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
                                    : answers.map((answer, index) => (
                                          <div key={index} className={conversationIsLoading ? styles.noneDisplay : ""}>
                                              <UserChatMessage message={answer[0]} />
                                              <div className={styles.chatMessageGpt} role="region" aria-label="Chat message">
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
                                      ))}

                                {isLoading && (
                                    <>
                                        <UserChatMessage message={lastQuestionRef.current} />
                                        <div className={styles.chatMessageGptMinWidth}>
                                            <AnswerLoading />
                                        </div>
                                    </>
                                )}
                                {error ? (
                                    <>
                                        <UserChatMessage message={lastQuestionRef.current} />
                                        <div className={styles.chatMessageGptMinWidth} role="alert" aria-live="assertive">
                                            <AnswerError
                                                error={error_message_text + error.toString()}
                                                onRetry={() =>
                                                    makeApiRequestGpt(lastQuestionRef.current, chatId !== "" ? chatId : null, lastFileBlobUrl.current)
                                                }
                                            />
                                        </div>
                                    </>
                                ) : null}
                                <div ref={chatMessageStreamEnd} />
                            </div>
                        )}
                        <div className={styles.chatInput}>
                            {/* <div className={styles.buttonsActions}>
                                <button
                                    className={lastQuestionRef.current || dataConversation.length > 0 ? styles.clearChatButton : styles.clearChatButtonDisabled}
                                    onClick={clearChat}
                                    aria-label="Clear chat"
                                    type="button"
                                >
                                    <BroomRegular />
                                </button>
                            </div> */}
                            <QuestionInput
                                clearOnSend
                                placeholder={placeholderText}
                                disabled={isLoading}
                                onSend={(question, fileBlobUrl) => {
                                    makeApiRequestGpt(question, chatId !== "" ? chatId : null, fileBlobUrl || null);
                                }}
                                extraButtonNewChat={<StartNewChatButton isEnabled={isButtonEnabled} onClick={handleNewChat} />}
                            />
                        </div>
                        <div className={styles.chatDisclaimer}>
                            <p>This app is in beta. Responses may not be fully accurate.</p>
                        </div>
                    </div>
                    {(answers.length > 0 && activeAnalysisPanelTab && answers[selectedAnswer] && (
                        <AnalysisPanel
                            className={styles.chatAnalysisPanel}
                            activeCitation={activeCitation}
                            onActiveTabChanged={x => {
                                onToggleTab(x, selectedAnswer);
                            }}
                            citationHeight="810px"
                            answer={answers[selectedAnswer]?.[1]}
                            activeTab={activeAnalysisPanelTab}
                            fileType={fileType}
                            onHideTab={hideTab}
                        />
                    )) ||
                        (dataConversation.length > 0 && fileType !== "" && activeAnalysisPanelTab && (
                            <AnalysisPanel
                                className={styles.chatAnalysisPanel}
                                activeCitation={activeCitation}
                                onActiveTabChanged={x => {
                                    onToggleTab(x, selectedAnswer);
                                }}
                                citationHeight="810px"
                                answer={responseForPreviewPanel}
                                activeTab={activeAnalysisPanelTab}
                                fileType={fileType}
                                onHideTab={hideTab}
                            />
                        ))}

                    <Panel
                        headerText="Configure answer generation"
                        isOpen={isConfigPanelOpen}
                        isBlocking={false}
                        onDismiss={() => setIsConfigPanelOpen(false)}
                        closeButtonAriaLabel="Close"
                        onRenderFooterContent={() => <DefaultButton onClick={() => setIsConfigPanelOpen(false)}>Close</DefaultButton>}
                        isFooterAtBottom={true}
                    >
                        <TextField
                            className={styles.chatSettingsSeparator}
                            defaultValue={promptTemplate}
                            label="Override prompt template"
                            multiline
                            autoAdjustHeight
                            onChange={onPromptTemplateChange}
                            aria-label="Override prompt template"
                        />

                        <SpinButton
                            className={styles.chatSettingsSeparator}
                            label="Retrieve this many documents from search:"
                            min={1}
                            max={50}
                            defaultValue={retrieveCount.toString()}
                            onChange={onRetrieveCountChange}
                            aria-label="Number of documents to retrieve"
                        />
                        <TextField
                            className={styles.chatSettingsSeparator}
                            label="Exclude category"
                            onChange={onExcludeCategoryChanged}
                            aria-label="Exclude category"
                        />
                        <Checkbox
                            className={styles.chatSettingsSeparator}
                            checked={useSemanticRanker}
                            label="Use semantic ranker for retrieval"
                            onChange={onUseSemanticRankerChange}
                            aria-label="Use semantic ranker for retrieval"
                        />
                        <Checkbox
                            className={styles.chatSettingsSeparator}
                            checked={useSemanticCaptions}
                            label="Use query-contextual summaries instead of whole documents"
                            onChange={onUseSemanticCaptionsChange}
                            disabled={!useSemanticRanker}
                            aria-label="Use query-contextual summaries"
                        />
                        <Checkbox
                            className={styles.chatSettingsSeparator}
                            checked={useSuggestFollowupQuestions}
                            label="Suggest follow-up questions"
                            onChange={onUseSuggestFollowupQuestionsChange}
                            aria-label="Suggest follow-up questions"
                        />
                    </Panel>
                </div>
            </div>
        </div>
    );
};

export default Chat;
