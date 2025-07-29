import { AskResponseGpt, ChatRequestGpt, GetSettingsProps, PostSettingsProps, ConversationHistoryItem, ChatTurn, UserInfo, SummarizationReportProps } from "./models";

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

export async function getUserById({ user }: any): Promise<any> {
    const user_id = user ? user.id : "00000000-0000-0000-0000-000000000000";
    const user_name = user ? user.name : "anonymous";

    try {
        const response = await fetch(`/api/getusers?user_id=${user_id}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": user_id,
                "X-MS-CLIENT-PRINCIPAL-NAME": user_name
            }
        });

        const parsedResponse = await response.json();
        if (response.status > 299 || !response.ok) {
            throw Error("Unknown error in getUserById");
        }
        return parsedResponse;
    } catch (error) {
        console.log("Error fetching user by ID", error);
        return { data: null };
    }
}

export async function fetchUserOrganizations(userId: string): Promise<any> {
    try {
        const response = await fetch(`/api/get-user-organizations`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": userId,
            }
        });

        if (!response.ok) {
            throw new Error("Failed to fetch organizations");
        }

        const organizations = await response.json();
        return organizations;
    } catch (error) {
        console.error("Error fetching user organizations", error);
        return { error: error };
    }
}

export async function fetchUserRoleForOrganization(userId: string, organizationId: string): Promise<{ role: string } | null> {
    try {
        const response = await fetch(`/api/get-users-organizations-role?organization_id=${encodeURIComponent(organizationId)}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": userId,
            },
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch role. Status: ${response.status}`);
        }

        const data = await response.json();
        return { role: data.role };
    } catch (error) {
        console.error("Error fetching user role:", error);
        return null;
    }
}

export async function deleteUser({ user, userId, organizationId }: any): Promise<any> {
    try {
        const response = await fetch(`/api/deleteuser?userId=${userId}&organizationId=${organizationId}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": user.id
            }
        });
        
        /*This is a temporal fix. The deleteuser code in the frontend needs to be refactored*/
        if (response.status === 200 || response.status === 204) {
            return { success: true };
        }

        const fetchedData = await response.json();
        return fetchedData;
    } catch (error) {
        console.error("Error deleting user", error);
        return { error: error };
    }
}

export async function deleteInvitation({user, invitationId }: any): Promise<any> {
    try {
        const response = await fetch(`/api/deleteInvitation?invitationId=${invitationId}`, {
            method: "DELETE",
            headers: {
                "X-MS-CLIENT-PRINCIPAL-ID": user.id,
                "Content-Type": "application/json",
            }
        });
        
        if (response.status === 200 || response.status === 204) {
            return { success: true };
        }

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

export async function postSettings({ user, temperature, model, font_family, font_size }: PostSettingsProps): Promise<any> {
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
                model,
                font_family,
                font_size
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
    const user_organization = user ? user.organizationId : "00000000-0000-0000-0000-000000000000";
    const response = await fetch("/chatgpt", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-MS-CLIENT-PRINCIPAL-ID": user_id,
            "X-MS-CLIENT-PRINCIPAL-NAME": user_name,
            "X-MS-CLIENT-PRINCIPAL-ORGANIZATION": user_organization
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

export async function inviteUser({ username, email, organizationId, organizationName }: any): Promise<any> {
    try {
        const response = await fetch("/api/inviteUser", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                username,
                email,
                organizationId,
                organizationName
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
    const userName = user?.name ?? "anonymous";
    const userOrganizationId = user?.organizationId ?? "00000000-0000-0000-0000-000000000000";

    try {
        const response = await fetch(`/api/subscription/${subscriptionId}/financialAssistant`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": userId,
                "X-MS-CLIENT-PRINCIPAL-NAME": userName
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
    const userName = user?.name ?? "anonymous";
    try {
        const response = await fetch(`/api/subscription/${subscriptionId}/financialAssistant`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": userId,
                "X-MS-CLIENT-PRINCIPAL-NAME": userName
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

export async function createInvitation({ organizationId, invitedUserEmail, userId, role, nickname }: any): Promise<any> {
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
                nickname,
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

export async function getSourceFileFromBlob(organizationId: string) {
    const response = await fetch(`/api/get-source-documents?organization_id=${organizationId}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });
    if (!response.ok) {
        console.log("Error fetching files:", response.statusText);
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    return result;
}

export async function uploadSourceFileToBlob(file: any, organizationId: string) {
    const formdata = new FormData();
    formdata.append("file", file);
    formdata.append("organization_id", organizationId);
    
    try {
        const response = await fetch("/api/upload-source-document", {
            method: "POST",
            body: formdata,
            redirect: "follow"
        });
        if (!response.ok) {
            console.log("Error uploading file:", response.statusText);
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

export async function deleteSourceFileFromBlob(blob_name: string) {
    const response = await fetch(`/api/delete-source-document?blob_name=${blob_name}`, {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        }
    });
    if (!response.ok) {
        console.log("Error deleting file:", response.statusText);
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    console.log("File deleted successfully:", result);
    return result;
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

export async function createCheckoutSession({ userId, priceId, successUrl, cancelUrl, organizationId, userName, organizationName }: any) {
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
            organizationId,
            userName,
            organizationName
        })
    });
    if (response.status > 299 || !response.ok) {
        throw Error("Error creating checkout session");
    }

    const session = await response.json();
    return session;
}

export async function getCustomerId({ subscriptionId }: { subscriptionId: string }): Promise<string> {
    const response = await fetch("/get-customer", {
        method: "POST",
        headers: {
           "Content-Type": "application/json" 
        },
        body: JSON.stringify({
            subscription_id: subscriptionId
        })
    });
    if (response.status > 299 || !response.ok) {
        throw Error("Error creating checkout session")
    }

    const data = await response.json();
    return data.customer_id;
}

interface CustomerPortalSession {
    url: string;
}

export async function createCustomerPortalSession({ 
    customerId, 
    return_url,
    subscription_id
}: {
    customerId: string;
    return_url: string;
    subscription_id:string;
}): Promise<CustomerPortalSession>{
    const response = await fetch("/create-customer-portal-session", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            customer: customerId,
            return_url,
            subscription_id
        })
    });
    if (response.status > 299 || !response.ok) {
        throw Error("Error creating checkout session");
    }
    
    if (!response.ok) {
        throw new Error("Error creating customer portal session");
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

export async function getReportBlobs({
    container_name,
    prefix,
    include_metadata,
    max_results,
}: {
    container_name: string;
    prefix: string;
    include_metadata: string;
    max_results: string;
}) {
    const params = new URLSearchParams({
        container_name,
        prefix,
        include_metadata,
        max_results,
    });

    try {
        const response = await fetch(`/api/reports/storage/files?${params}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            },
        });
    
        if (response.status > 299 || !response.ok) {
            throw Error("Error getting report blobs");
        }
    
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error getting report blobs", error);
        return { data: [] };
    }
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

// Summarization reports 
export async function getSummarizationTemplates() {
    const response = await fetch('/api/reports/summarization/templates', {method: 'GET', headers: {'Content-Type': 'application/json'}});
    if (response.status > 299 || !response.ok) {
        throw Error('Error getting summarization templates');
    }
    const reports = await response.json();
    return reports.data;
}

export async function getSummarizationReportTemplateByID(templateID: string) {
    const response = await fetch(`/api/reports/summarization/templates/${templateID}`, {method: 'GET', headers: {'Content-Type': 'application/json'}});
    const report = await response.json();
    return report.data;
}

export async function createSummarizationReport(templateData: SummarizationReportProps) {
    const response = await fetch('/api/reports/summarization/templates', {
        method: 'POST',
        headers: {'Content-Type': 'application/json'},
        body: JSON.stringify(templateData),
    });

    if (response.status > 299 || !response.ok) {
        throw Error('Error creating a new summarization report');
    }

    const newReport = await response.json();
    return newReport;
}

export async function deleteSummarizationReportTemplate(templateID: string) {
    const response = await fetch(`/api/reports/summarization/templates/${templateID}`, {
        method: 'DELETE',
        headers: {'Content-Type': 'application/json'},
    });

    if (response.status > 299 || !response.ok) {
        throw Error('Error deleting summarization report');
    }
    const deletedReport = await response.json();
    return deletedReport;
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

export async function updateOrganizationInfo({ orgId, patchData }: { orgId: string; patchData: object }) {
    const response = await fetch(`/api/organization/${encodeURIComponent(orgId)}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(patchData),
    });

    if (response.status === 404) {
        throw Error(`Organization with ID ${orgId} not found`);
    }

    if (response.status > 299 || !response.ok) {
        throw Error(`Error updating organization data of ID ${orgId}`);
    }

    return response.json();
}

export async function updateUserData({ userId, patchData }: { userId: string; patchData: object }) {
    const response = await fetch(`/api/user/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify(patchData)
    });

    if (response.status === 404) {
        throw Error(`User with ID ${userId} not found`);
    }

    if (response.status > 299 || !response.ok) {
        throw Error(`Error updating user data of ID ${userId}`);
    }
}

export async function resetUserPassword({ userId, newPassword }: { userId: string; newPassword: string }) {
    const response = await fetch(`/api/user/${encodeURIComponent(userId)}/reset-password`, {
        method: "PATCH",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ "new_password":newPassword })
    });

    if (response.status === 404) {
        throw Error(`User with ID ${userId} not found`);
    }

    if (response.status > 299 || !response.ok) {
        throw Error(`Error resetting password for user with ID ${userId}`);
    }

    return response.json();
}

export async function changeSubscription({ subscriptionId, newPlanId, user}: {subscriptionId: string;newPlanId: string; user:any;}): Promise<any> {
    const userId = user ? user.id : "00000000-0000-0000-0000-000000000000";
    const userName = user ? user.name : "anonymous";
    try {
        const response = await fetch(`/api/subscriptions/${subscriptionId}/change`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID":userId,
                "X-MS-CLIENT-PRINCIPAL-NAME": userName
            },
            body: JSON.stringify({
                new_plan_id: newPlanId,
            }),
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Subscription change failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const result: { message: string; subscription: any; } = await response.json();

        console.log("Subscription changed successfully:", result.message);
        return result.subscription;
    } catch (error) {
        console.error(
            "Error changing subscription:",
            error instanceof Error ? error.message : error
        );
        throw error;
    }
}

export async function cancelSubscription({ subscriptionId, user }: {subscriptionId: string; user:any}): Promise<void> {
    const userId = user ? user.id : "00000000-0000-0000-0000-000000000000";
    const userName = user ? user.name : "anonymous";
    try {
        const response = await fetch(`/api/subscriptions/${subscriptionId}/cancel`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID":userId,
                "X-MS-CLIENT-PRINCIPAL-NAME": userName,
            },
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`Subscription cancellation failed: ${response.status} ${response.statusText} - ${errorText}`);
        }

        console.log("Subscription canceled successfully");
    } catch (error) {
        console.error(
            "Error canceling subscription:",
            error instanceof Error ? error.message : error
        );
        throw error;
    }
}

export async function getLogs(organizationId: string): Promise<any> {
    try {
        const response = await fetch('/api/logs/', {method:'POST',
            headers:{
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                organization_id: organizationId
            })
        })

        if (!response.ok) {
            throw new Error(`Error getting logs: ${response.status} ${response.statusText}`);
        }

        if (response.status === 204) {
            return [];
        }

        const logs = await response.json();
        if (!logs.data || !Array.isArray(logs.data)) {
            return [];
        }
        // order data using timestamp in descending order
        const orderedLogs = logs.data.sort((a: any, b: any) => {
            return new Date(b.changeTime).getTime() - new Date(a.changeTime).getTime();
        });
        return orderedLogs;
    } catch (error: any) {
        if (error instanceof TypeError) {
            console.error('Network error: Unable to reach logs API.')
            throw new Error('Network error: Unable to reach logs API. ')
        }
        console.error("API request failed:", error)
        throw new Error(error.message || "Unexpected error fetching logs.")
    }
}

export async function getCompanyData() {
    try {
        const response = await fetch("/api/companydata", {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            }
        });
        const companydata = await response.json()
        return companydata.data
    } catch {
        console.error("API request failed")
    }
}

export async function scrapeUrls(url: string, organizationId?: string, user?: any): Promise<any> {
    try {
        const payload: any = { url };
        
        // Include organization_id if provided to save URLs to database
        if (organizationId) {
            payload.organization_id = organizationId;
        }
        
        const headers: any = {
            "Content-Type": "application/json",
        };
        
        // Add user authentication headers if user is provided
        if (user) {
            headers["X-MS-CLIENT-PRINCIPAL-ID"] = user.id;
            headers["X-MS-CLIENT-PRINCIPAL-NAME"] = user.name;
        }
        
        const response = await fetch("/api/webscraping/scrape-url", {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        // Return the detailed result which should include success/failure info for each URL
        return result;
    } catch (error) {
        console.error("Error scraping URL:", error);
        throw error;
    }
}

export async function scrapeUrlsMultipage(url: string, organizationId?: string, user?: any): Promise<any> {
    try {
        const payload: any = { url };
        
        // Include organization_id if provided to save URLs to database
        if (organizationId) {
            payload.organization_id = organizationId;
        }
        
        const headers: any = {
            "Content-Type": "application/json",
        };
        
        // Add user authentication headers if user is provided
        if (user) {
            headers["X-MS-CLIENT-PRINCIPAL-ID"] = user.id;
            headers["X-MS-CLIENT-PRINCIPAL-NAME"] = user.name;
        }
        
        const response = await fetch("/api/webscraping/multipage-scrape", {
            method: "POST",
            headers,
            body: JSON.stringify(payload)
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        
        // Return the detailed result which should include success/failure info for each URL
        return result;
    } catch (error) {
        console.error("Error scraping URL with multipage:", error);
        throw error;
    }
}

// Knowledge Sources API functions
export async function getOrganizationUrls(organizationId: string): Promise<any> {
    try {
        const response = await fetch(`/api/webscraping/get-urls?organization_id=${encodeURIComponent(organizationId)}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Error fetching organization URLs:", error);
        throw error;
    }
}

export async function addOrganizationUrl(organizationId: string, url: string, user?: any): Promise<any> {
    try {
        const headers: any = {
            "Content-Type": "application/json",
        };
        
        // Add user authentication headers if user is provided
        if (user) {
            headers["X-MS-CLIENT-PRINCIPAL-ID"] = user.id;
            headers["X-MS-CLIENT-PRINCIPAL-NAME"] = user.name;
        }
        
        const response = await fetch("/api/webscraping/add-url", {
            method: "POST",
            headers,
            body: JSON.stringify({
                organization_id: organizationId,
                url: url
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Error adding organization URL:", error);
        throw error;
    }
}

export async function deleteOrganizationUrl(urlId: string, organizationId: string): Promise<any> {
    try {
        const response = await fetch(`/api/webscraping/delete-url?url_id=${encodeURIComponent(urlId)}&organization_id=${encodeURIComponent(organizationId)}`, {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Error deleting organization URL:", error);
        throw error;
    }
}

export async function updateOrganizationUrl(urlId: string, organizationId: string, newUrl: string): Promise<any> {
    try {
        const response = await fetch("/api/webscraping/modify-url", {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({
                url_id: urlId,
                organization_id: organizationId,
                new_url: newUrl
            })
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Error updating organization URL:", error);
        throw error;
    }
}

export async function searchOrganizationUrls(organizationId: string, searchTerm: string): Promise<any> {
    try {
        const response = await fetch(`/api/webscraping/search-urls?organization_id=${encodeURIComponent(organizationId)}&search_term=${encodeURIComponent(searchTerm)}`, {
            method: "GET",
            headers: {
                "Content-Type": "application/json",
            }
        });

        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Error searching organization URLs:", error);
        throw error;
    }
}

export interface ConversationExportResponse {
    success: boolean;
    share_url: string;
    filename: string;
    format: string;
    message_count: number;
    export_date: string;
}

export async function exportConversation(conversationId: string, userId: string, format: string = "html"): Promise<ConversationExportResponse> {
    try {
        const requestBody = {
            id: conversationId,
            user_id: userId,
            format: format
        };
        
        console.log("Exporting conversation with payload:", requestBody);
        
        const response = await fetch("/api/conversations/export", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": userId,
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            throw new Error(`Export failed: ${response.status} ${response.statusText}`);
        }

        const result: ConversationExportResponse = await response.json();
        
        console.log("Export response from server:", result);
        
        if (!result.success) {
            throw new Error("Export failed: Server returned unsuccessful response");
        }

        return result;
    } catch (error) {
        console.error("Error exporting conversation:", error);
        throw error;
    }
}

// Create a brand
export async function createBrand({
  brand_name,
  brand_description,
  organization_id,
  user,
}: {
  brand_name: string;
  brand_description: string;
  organization_id: string;
  user: any;
}): Promise<any> {
  const response = await fetch('/api/voice-customer/brands', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
      'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
    },
    body: JSON.stringify({ brand_name, brand_description, organization_id }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Error creating brand');
  }
  return data;
}

// Delete a brand
export async function deleteBrand({
  brand_id,
  user,
}: {
  brand_id: string;
  user: any;
}): Promise<any> {
  const response = await fetch(`/api/voice-customer/brands/${encodeURIComponent(brand_id)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
      'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Error deleting brand');
  }
  return data;
}

// Get brands by organization
export async function getBrandsByOrganization({
  organization_id,
  user,
}: {
  organization_id: string;
  user: any;
}): Promise<any> {
  const response = await fetch(`/api/voice-customer/organizations/${encodeURIComponent(organization_id)}/brands`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
      'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Error fetching brands');
  }
  return data.data || [];
}

// Update a brand
export async function updateBrand({
  brand_id,
  brand_name,
  brand_description,
  user,
}: {
  brand_id: string;
  brand_name: string;
  brand_description: string;
  user: any;
}): Promise<any> {
  const response = await fetch(`/api/voice-customer/brands/${encodeURIComponent(brand_id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
      'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
    },
    body: JSON.stringify({ brand_name, brand_description }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Error updating brand');
  }
  return data;
}

// Create a product
export async function createProduct({
  product_name,
  product_description,
  brand_id,
  organization_id,
  category,
  user,
}: {
  product_name: string;
  product_description: string;
  brand_id: string;
  organization_id: string;
  category: string;
  user: any;
}): Promise<any> {
  const response = await fetch('/api/voice-customer/products', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
      'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
    },
    body: JSON.stringify({
      product_name,
      product_description,
      brand_id,
      organization_id,
      category,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Error creating product');
  }
  return data;
}

// Delete a product
export async function deleteProduct({
  product_id,
  user,
}: {
  product_id: string;
  user: any;
}): Promise<any> {
  const response = await fetch(`/api/voice-customer/products/${encodeURIComponent(product_id)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
      'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Error deleting product');
  }
  return data;
}

// Get products by organization
export async function getProductsByOrganization({
  organization_id,
  user,
}: {
  organization_id: string;
  user: any;
}): Promise<any> {
  const response = await fetch(`/api/voice-customer/organizations/${encodeURIComponent(organization_id)}/products`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
      'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Error fetching products');
  }
  return data.data || [];
}

// Update a product
export async function updateProduct({
  product_id,
  product_name,
  product_description,
  category,
  brand_id,
  user,
}: {
  product_id: string;
  product_name: string;
  product_description: string;
  category: string;
  brand_id: string;
  user: any;
}): Promise<any> {
  const response = await fetch(`/api/voice-customer/products/${encodeURIComponent(product_id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
      'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
    },
    body: JSON.stringify({
      product_name,
      product_description,
      category,
      brand_id,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Error updating product');
  }
  return data;
}

// Create a competitor
export async function createCompetitor({
  competitor_name,
  competitor_description,
  industry,
  brands_id,
  organization_id,
  user,
}: {
  competitor_name: string;
  competitor_description: string;
  industry: string;
  brands_id: string[];
  organization_id: string;
  user: any;
}): Promise<any> {
  const response = await fetch('/api/voice-customer/competitors', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
      'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
    },
    body: JSON.stringify({
      competitor_name,
      competitor_description,
      industry,
      brands_id,
      organization_id,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Error creating competitor');
  }
  return data;
}

// Delete a competitor
export async function deleteCompetitor({
  competitor_id,
  user,
}: {
  competitor_id: string;
  user: any;
}): Promise<any> {
  const response = await fetch(`/api/voice-customer/competitors/${encodeURIComponent(competitor_id)}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
      'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Error deleting competitor');
  }
  return data;
}

// Get competitors by organization
export async function getCompetitorsByOrganization({
  organization_id,
  user,
}: {
  organization_id: string;
  user: any;
}): Promise<any> {
  const response = await fetch(`/api/voice-customer/organizations/${encodeURIComponent(organization_id)}/competitors`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
      'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
    },
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Error fetching competitors');
  }
  return data.data || [];
}

// Update a competitor
export async function updateCompetitor({
  competitor_id,
  competitor_name,
  competitor_description,
  industry,
  brands_id,
  user,
}: {
  competitor_id: string;
  competitor_name: string;
  competitor_description: string;
  industry: string;
  brands_id: string[];
  user: any;
}): Promise<any> {
  const response = await fetch(`/api/voice-customer/competitors/${encodeURIComponent(competitor_id)}`, {
    method: 'PATCH',
    headers: {
      'Content-Type': 'application/json',
      'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
      'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
    },
    body: JSON.stringify({
      competitor_name,
      competitor_description,
      industry,
      brands_id,
    }),
  });
  const data = await response.json();
  if (!response.ok) {
    throw new Error(data?.message || data?.error || 'Error updating competitor');
  }
  return data;
}

export async function getItemsToDeleteByBrand({ brand_id, user }: { brand_id: string; user: any }): Promise<any> {
  const response = await fetch(`/api/voice-customer/brands/${encodeURIComponent(brand_id)}/items-to-delete/`, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
      'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch items to delete for brand ${brand_id}: ${response.statusText}`);
  }

  const result = await response.json();

  return result.data;
}