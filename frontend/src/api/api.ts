import { List } from "@fluentui/react";
import {
    AskRequest,
    AskResponse,
    AskResponseGpt,
    ChatRequest,
    ChatRequestGpt,
    GetSettingsProps,
    PostSettingsProps,
    ConversationHistoryItem,
    ConversationChatItem,
    ChatTurn,
    UserInfo
} from "./models";

export async function getUserInfo(): Promise<UserInfo[]> {
    const response = await fetch("/.auth/me");
    if (!response.ok) {
        return [];
    }
    const payload = await response.json();
    return payload;
}

export async function getSettings({ user }: GetSettingsProps): Promise<any> {
    const user_id = user ? user.id : "00000000-0000-0000-0000-000000000000";
    const user_name = user ? user.name : "anonymous";
    try {
        const response = await fetch("/api/settings", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": user_id,
                "X-MS-CLIENT-PRINCIPAL-NAME": user_name
            }
        });
        const fetchedData = await response.json();
        return fetchedData;
    } catch (error) {
        console.log("Error fetching settings", error);
        return { temperature: "0", presencePenalty: "0", frequencyPenalty: "0" };
    }
}

export async function postSettings({ user, temperature, presence_penalty, frequency_penalty }: PostSettingsProps): Promise<any> {
    const user_id = user ? user.id : "00000000-0000-0000-0000-000000000000";
    const user_name = user ? user.name : "anonymous";
    try {
        const response = await fetch("/api/settings", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": user_id,
                "X-MS-CLIENT-PRINCIPAL-NAME": user_name
            },
            body: JSON.stringify({
                temperature,
                presence_penalty,
                frequency_penalty
            })
        });
        const fetchedData = await response.json();
        console.log("Settings posted", fetchedData);
        return fetchedData;
    } catch (error) {
        console.error("Error posting settings", error);
        return {};
    }
}

export async function chatApiGpt(options: ChatRequestGpt): Promise<AskResponseGpt> {
    const response = await fetch("/chatgpt", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            history: options.history,
            approach: options.approach,
            conversation_id: options.conversation_id,
            query: options.query,
            overrides: {
                semantic_ranker: options.overrides?.semanticRanker,
                semantic_captions: options.overrides?.semanticCaptions,
                top: options.overrides?.top,
                temperature: options.overrides?.temperature,
                prompt_template: options.overrides?.promptTemplate,
                prompt_template_prefix: options.overrides?.promptTemplatePrefix,
                prompt_template_suffix: options.overrides?.promptTemplateSuffix,
                exclude_category: options.overrides?.excludeCategory,
                suggest_followup_questions: options.overrides?.suggestFollowupQuestions
            }
        })
    });

    const parsedResponse: AskResponseGpt = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error(parsedResponse.error || "Unknown error");
    }
    return parsedResponse;
}

export async function getChatFromHistoryPannelById(chatId: string, userId: string): Promise<ChatTurn[]> {
    const response = await fetch(`/api/get-chat-conversation/${chatId}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "X-MS-CLIENT-PRINCIPAL-ID": userId
        }
    });

    const responseData = await response.json();
    const history = responseData.history;

    const conversationItems: ChatTurn[] = [];
    let currentUserMessage = "";
    let currentBotMessage = "";

    history.forEach((item: any) => {
        if (item.role === "user") {
            currentUserMessage = item.content;
        } else if (item.role === "assistant") {
            currentBotMessage = item.content;
            if (currentUserMessage !== "" || currentBotMessage !== "") {
                conversationItems.push({ user: currentUserMessage, bot: currentBotMessage });
                currentUserMessage = "";
                currentBotMessage = "";
            }
        }
    });

    if (currentUserMessage !== "" || currentBotMessage !== "") {
        conversationItems.push({ user: currentUserMessage, bot: currentBotMessage });
    }

    return conversationItems;
}

export async function deleteChatConversation(chatId: string, userId: string): Promise<void> {
    try {
        const response = await fetch(`/api/conversations/${chatId}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": userId
            }
        });
        if (!response.ok) {
            throw new Error(`Failed to delete conversation. Status: ${response.status}`);
        }
    } catch (error) {
        console.error("Error deleting conversation:", error);
        throw new Error("Error deleting conversation");
    }
}

export async function getChatHistory(userId: string): Promise<ConversationHistoryItem[]> {
    const response = await fetch("/api/get-chat-history", {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "X-MS-CLIENT-PRINCIPAL-ID": userId
        }
    });
    const parsedResponse: ConversationHistoryItem[] = await response.json();
    if (response.status > 299 || !response.ok) {
        throw Error("Error getting chat history");
    }
    return parsedResponse;
}

export function getCitationFilePath(citation: string): string {
    var storage_account = "please_check_if_storage_account_is_in_frontend_app_settings";

    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/get-storage-account", false);
    xhr.send();

    if (xhr.status > 299) {
        console.log("Please check if STORAGE_ACCOUNT is in frontend app settings");
        return storage_account;
    } else {
        const parsedResponse = JSON.parse(xhr.responseText);
        storage_account = parsedResponse["storageaccount"];
    }
    console.log("storage account:" + storage_account);

    return `https://${storage_account}.blob.core.windows.net/documents/${citation}`;
}

export function getFilePath(fileUrl: string) {
    const regex = /documents\/(.*)/;
    const match = fileUrl.match(regex);
    let filepath = "";

    if (match && match[1]) {
        filepath = match[1];
    }
    return filepath;
}

export async function postFeedbackRating({ user, conversation_id, feedback_message, question, answer, rating, category }: any): Promise<any> {
    const user_id = user ? user.id : "00000000-0000-0000-0000-000000000000";
    const user_name = user ? user.name : "anonymous";
    return new Promise(async (resolve, reject) => {
        try {
            const response = await fetch("/api/feedback", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "X-MS-CLIENT-PRINCIPAL-ID": user_id,
                    "X-MS-CLIENT-PRINCIPAL-NAME": user_name
                },
                body: JSON.stringify({
                    conversation_id: conversation_id,
                    feedback: feedback_message,
                    question: question,
                    answer: answer,
                    rating: rating,
                    category: category
                })
            });

            const fetchedData = await response.json();
            resolve(fetchedData);
        } catch (error) {
            console.error("Error posting feedback", error);
            reject(error);
        }
    });
}
