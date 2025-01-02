import { AskResponseGpt, ChatRequestGpt, GetSettingsProps, PostSettingsProps, ConversationHistoryItem, ChatTurn, UserInfo } from "./models";

export async function getUsers({ user }: any): Promise<any> {
    const user_id = user ? user.id : "00000000-0000-0000-0000-000000000000";
    const user_name = user ? user.name : "anonymous";
    const user_organizationId = user ? user.organizationId : "00000000-0000-0000-0000-000000000000";
    try {
        const response = await fetch("/api/getusers?organizationId=" + user_organizationId, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": user_id,
                "X-MS-CLIENT-PRINCIPAL-NAME": user_name
            }
        });

        const parsedResponse = await response.json();
        if (response.status > 299 || !response.ok) {
            throw Error("Unknown error in getUsers");
        }
        return parsedResponse;
    } catch (error) {
        console.log("Error fetching users", error);
        return { data: null };
    }
}

export async function deleteUser({ user, userId }: any): Promise<any> {
    try {
        const response = await fetch(`/api/deleteuser?userId=${userId}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": user.id
            }
        });
        const fetchedData = await response.json();
        return fetchedData;
    } catch (error) {
        console.error("Error deleting user", error);
        return { error: error };
    }
}

export async function checkUser({ user }: any): Promise<any> {
    const user_id = user ? user.id : "00000000-0000-0000-0000-000000000000";
    const user_name = user ? user.name : "anonymous";
    if (user.email) {
        const response = await fetch("/api/checkuser", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": user_id,
                "X-MS-CLIENT-PRINCIPAL-NAME": user_name
            },
            body: JSON.stringify({
                email: user.email
            })
        });
        const parsedResponse = await response.json();
        if (response.status > 299 || !response.ok) {
            throw Error("Unknown error in checkUser");
        }
        return parsedResponse;
    }

    return { data: null };
}

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

export async function postSettings({ user, temperature }: PostSettingsProps): Promise<any> {
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
                temperature
            })
        });
        const fetchedData = await response.json();
        return fetchedData;
    } catch (error) {
        console.error("Error posting settings", error);
        return {};
    }
}

export async function chatApiGpt(options: ChatRequestGpt, user: any): Promise<AskResponseGpt> {
    const user_id = user ? user.id : "00000000-0000-0000-0000-000000000000";
    const user_name = user ? user.name : "anonymous";
    const response = await fetch("/chatgpt", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-MS-CLIENT-PRINCIPAL-ID": user_id,
            "X-MS-CLIENT-PRINCIPAL-NAME": user_name
        },
        body: JSON.stringify({
            history: options.history,
            approach: options.approach,
            conversation_id: options.conversation_id,
            query: options.query,
            url: options.file_blob_url,
            agent: options.agent,
            documentName: options.documentName,
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
    const response = await fetch(`/api/chat-conversation/${chatId}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "X-MS-CLIENT-PRINCIPAL-ID": userId
        }
    });

    const responseData = await response.json();
    const messages = responseData.messages;

    const conversationItems: ChatTurn[] = [];
    let currentUserMessage = "";
    let currentBotMessage = "";
    let currentBotThoughts: string[] = [];

    if (messages) {
        messages.forEach((item: any) => {
            if (item.role === "user") {
                currentUserMessage = item.content;
            } else if (item.role === "assistant") {
                currentBotMessage = item.content;
                currentBotThoughts = item.thoughts;
                if (currentUserMessage !== "" || currentBotMessage !== "") {
                    conversationItems.push({ user: currentUserMessage, bot: { message: currentBotMessage, thoughts: currentBotThoughts } });
                    currentUserMessage = "";
                    currentBotMessage = "";
                    currentBotThoughts = [];
                }
            }
        });
    }

    if (currentUserMessage !== "" || currentBotMessage !== "") {
        conversationItems.push({ user: currentUserMessage, bot: { message: currentBotMessage, thoughts: currentBotThoughts } });
    }

    return conversationItems;
}

export async function deleteChatConversation(chatId: string, userId: string): Promise<void> {
    try {
        const response = await fetch(`/api/chat-conversations/${chatId}`, {
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
    const response = await fetch("/api/chat-history", {
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

    return `https://${storage_account}.blob.core.windows.net/documents/${citation}`;
}

export function getFilePath(fileUrl: string) {
    if (!fileUrl.endsWith(".pdf") || !fileUrl.endsWith(".docx") || fileUrl.endsWith(".doc")) {
        return fileUrl;
    }
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

export async function inviteUser({ username, email, organizationId }: any): Promise<any> {
    try {
        const response = await fetch("/api/inviteUser", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                email,
                organizationId
            })
        });
        const fetchedData = await response.json();
        return fetchedData;
    } catch (error) {
        console.error("Error inviting user", error);
        return { error: error };
    }
}

interface User {
    id: string;
    name: string;
    organizationId: string;
}

interface SubscriptionResponse {
    data: {
        message: string;
        subscription: {
            id: string;
            status: string;
            current_period_end: number;
        };
    };
    status: number;
}

export async function getFinancialAssistant({ user, subscriptionId }: { user?: User; subscriptionId: string }): Promise<any> {
    const userId = user?.id ?? "00000000-0000-0000-0000-000000000000";

    try {
        const response = await fetch(`/api/subscription/${subscriptionId}/financialAssistant`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": userId
            }
        });

        if (!response.ok) {
            const error = new Error(`Failed to check financial assistant status: ${response.status}`);
            (error as any).status = response.status; // Añade el código de estado al error
            throw error;
        }

        const parsedResponse = await response.json();
        return parsedResponse.data;
    } catch (error) {
        console.error("Error verifying the Financial Assistant: ", error instanceof Error ? error.message : error);
        throw error;
    }
}

export async function upgradeSubscription({ user, subscriptionId }: { user?: User; subscriptionId: string }): Promise<any> {
    const userId = user?.id ?? "00000000-0000-0000-0000-000000000000";
    const userOrganizationId = user?.organizationId ?? "00000000-0000-0000-0000-000000000000";

    try {
        const response = await fetch(`/api/subscription/${subscriptionId}/financialAssistant`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": userId
            },
            body: JSON.stringify({
                organizationId: userOrganizationId,
                activateFinancialAssistant: true
            })
        });

        if (!response.ok) {
            throw new Error(`Subscription upgrade failed: ${response.status} ${response.statusText}`);
        }

        const parsedResponse: SubscriptionResponse = await response.json();
        const { message, subscription } = parsedResponse.data;

        console.log("Subscription upgraded successfully:", message);
        return subscription;
    } catch (error) {
        console.error("Error upgrading subscription:", error instanceof Error ? error.message : error);
        throw error;
    }
}

export async function removeFinancialAssistant({ user, subscriptionId }: { user?: User; subscriptionId: string }): Promise<any> {
    const userId = user?.id ?? "00000000-0000-0000-0000-000000000000";

    try {
        const response = await fetch(`/api/subscription/${subscriptionId}/financialAssistant`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": userId
            }
        });

        if (!response.ok) {
            throw new Error(`Subscription removal failed: ${response.status} ${response.statusText}`);
        }

        const parsedResponse: SubscriptionResponse = await response.json();
        const { message, subscription } = parsedResponse.data;

        console.log("Financial Assistant removed successfully:", message);
        return subscription;
    } catch (error) {
        console.error("Error removing Financial Assistant:", error instanceof Error ? error.message : error);
        throw error;
    }
}

export async function createInvitation({ organizationId, invitedUserEmail, userId, role }: any): Promise<any> {
    try {
        const response = await fetch("/api/createInvitation", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": userId
            },
            body: JSON.stringify({
                organizationId,
                invitedUserEmail,
                role
            })
        });
        const fetchedData = await response.json();
        return fetchedData;
    } catch (error) {
        console.error("Error creating invitation", error);
        return { error: error };
    }
}
export async function getApiKeyPayment(): Promise<string> {
    const response = await fetch("/api/stripe", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });

    if (response.status > 299 || !response.ok) {
        throw Error("Error getting Api key payment");
    }

    const apiKey = await response.text();
    return apiKey;
}

export async function uploadFile(file: any) {
    const formdata = new FormData();
    formdata.append("file", file);
    try {
        const response = await fetch("/api/upload-blob", {
            method: "POST",
            body: formdata,
            redirect: "follow"
        });
        if (!response.ok) {
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
        console.log("File uploaded successfully:", result);
        return result;
    } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
    }
}

export async function createCheckoutSession({ userId, priceId, successUrl, cancelUrl, organizationId }: any) {
    const response = await fetch("/create-checkout-session", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            userId,
            priceId,
            successUrl,
            cancelUrl,
            organizationId
        })
    });
    if (response.status > 299 || !response.ok) {
        throw Error("Error creating checkout session");
    }

    const session = await response.json();
    return session;
}

export async function getProductPrices({ user }: { user: any }): Promise<any> {
    const user_id = user ? user.id : "00000000-0000-0000-0000-000000000000";
    const user_name = user ? user.name : "anonymous";
    try {
        const response = await fetch(`/api/prices`, {
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
        console.log("Error fetching product prices", error);
        return { prices: [] };
    }
}

export async function getOrganizationSubscription({ userId, organizationId }: any) {
    const response = await fetch("/api/get-organization-subscription?organizationId=" + organizationId, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "X-MS-CLIENT-PRINCIPAL-ID": userId
        }
    });

    if (response.status > 299 || !response.ok) {
        throw Error("Error getting organization subscription");
    }

    const subscription = await response.json();
    return subscription;
}

export const createOrganization = async ({ userId, organizationName }: any) => {
    const response = await fetch("/api/create-organization", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-MS-CLIENT-PRINCIPAL-ID": userId
        },
        body: JSON.stringify({
            organizationName
        })
    });

    if (response.status > 299 || !response.ok) {
        throw Error("Error creating organization");
    }

    const organization = await response.json();
    return organization;
};

export async function getInvitations({ user }: any): Promise<any> {
    const user_id = user ? user.id : "00000000-0000-0000-0000-000000000000";
    const user_username = user ? user.username : "anonymous";
    const user_organizationId = user ? user.organizationId : "00000000-0000-0000-0000-000000000000";
    try {
        const response = await fetch("/api/getInvitations?organizationId=" + user_organizationId, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": user_id,
                "X-MS-CLIENT-PRINCIPAL-NAME": user_username
            }
        });

        const parsedResponse = await response.json();
        if (response.status > 299 || !response.ok) {
            throw Error("Unknown error in getUsers");
        }
        return parsedResponse;
    } catch (error) {
        console.log("Error fetching users", error);
        return { data: null };
    }
}

//create report type "curation" or "companySummarization"
export async function createReport(reportData: object) {
    const response = await fetch(`/api/reports`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(reportData),
    });

    if (response.status > 299 || !response.ok) {
        throw Error("Error creating a new report");
    }

    const newReport = await response.json();
    return newReport;
}

//This function, if sent with the "type" parameter, receives a request with the required report. If nothing is sent, it will receive all the reports from the container.
export async function getFilteredReports(type?: string) {
    const url = type 
        ? `/api/reports?type=${encodeURIComponent(type)}` 
        : `/api/reports`;

    const response = await fetch(url, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (response.status > 299 || !response.ok) {
        const errorType = type ? `type ${type}` : "all reports";
        throw new Error(`Error getting reports for ${errorType}`);
    }

    const reports = await response.json();
    return reports;
}

export async function deleteReport(reportId: string) {
    const response = await fetch(`/api/reports/${encodeURIComponent(reportId)}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json",
        },
    });

    if (response.status === 404) {
        throw Error(`Report with ID ${reportId} not found`);
    }

    if (response.status > 299 || !response.ok) {
        throw Error(`Error deleting report with ID ${reportId}`);
    }
}

export async function updateUser({ userId, updatedData }: { userId: string; updatedData: object }) {
    const response = await fetch(`/api/user/${encodeURIComponent(userId)}`, {
        method: "PUT",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(updatedData)
    });

    if (response.status === 404) {
        throw Error(`User with ID ${userId} not found`);
    }

    if (response.status > 299 || !response.ok) {
        throw Error(`Error updating user with ID ${userId}`);
    }
}