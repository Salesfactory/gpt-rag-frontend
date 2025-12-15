import { GetSettingsProps, PostSettingsProps, ConversationHistoryItem, ChatTurn, ThoughtProcess, UserInfo, BackendReportStatus, BackendReportJobDoc, Category, OrganizationUsage, Policy, SubscriptionTier } from "./models";
import { SourceDocumentsResponse } from '../types';
import { fetchWrapper } from './fetchWrapper';

/**
 * API Functions for Frontend
 *
 * Session Management:
 * - Critical auth functions have been migrated to use fetchWrapper (with automatic 401 handling)
 * - fetchWrapper automatically intercepts 401 responses and triggers session expiration modal
 * - When adding new API functions, use fetchWrapper instead of native fetch for better session handling
 *
 * Migration Status:
 * - ✅ fetchUserOrganizations
 * - ✅ fetchUserRoleForOrganization
 * - ✅ checkUser
 * - ✅ getOrganizationSubscription
 * - ⏳ Other functions can be migrated gradually as needed
 */

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
        const response = await fetchWrapper(`/api/get-user-organizations`, {
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
        const response = await fetchWrapper(`/api/get-users-organizations-role?organization_id=${encodeURIComponent(organizationId)}`, {
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

export async function deleteInvitation({ user, invitationId }: any): Promise<any> {
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
        const response = await fetchWrapper("/api/checkuser", {
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
        const response = await fetchWrapper("/api/settings", {
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

export async function postSettings({ user, temperature, model, font_family, font_size, detail_level }: PostSettingsProps): Promise<any> {
    const user_id = user ? user.id : "00000000-0000-0000-0000-000000000000";
    const user_name = user ? user.name : "anonymous";
    try {
        const response = await fetchWrapper("/api/settings", {
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
                font_size,
                detail_level
            })
        });
        const fetchedData = await response.json();
        return fetchedData;
    } catch (error) {
        console.error("Error posting settings", error);
        return {};
    }
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
    let currentBotThoughts: ThoughtProcess = null;

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
                    currentBotThoughts = null;
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
        const response = await fetchWrapper(`/api/chat-conversations/${chatId}`, {
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

// Cache the storage account to avoid repeated API calls
let storageAccountCache: string | null = null;

export function getCitationFilePath(citation: string): string {
    // Return cached value if available
    if (storageAccountCache) {
        return `https://${storageAccountCache}.blob.core.windows.net/documents/${citation}`;
    }

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
        storageAccountCache = storage_account;
    }

    return `https://${storage_account}.blob.core.windows.net/documents/${citation}`;
}

export async function getFeedbackUrl(): Promise<string | null> {
    try {
        const response = await fetch("/api/get-feedback-url", {
            method: "GET",
            headers: {
                "Content-Type": "application/json"
            }
        });

        if (response.status > 299 || !response.ok) {
            console.log("Error getting feedback URL");
            return null;
        }

        const parsedResponse = await response.json();
        return parsedResponse["feedback_url"] || null;
    } catch (error) {
        console.error("Error fetching feedback URL:", error);
        return null;
    }
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
export async function getApiKeyPayment(): Promise<any> {
    const response = await fetchWrapper("/api/stripe", {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });
    if (response.status > 299 || !response.ok) {
        throw Error("Error getting Api key payment");
    }

    return await response.json();
}

export async function getSourceFileFromBlob(
    organizationId: string, 
    folderPath: string = "", 
    category: string = "all",
    order: "newest" | "oldest" = "newest",
    signal?: AbortSignal
): Promise<SourceDocumentsResponse> {
    const url = new URL('/api/get-source-documents', window.location.origin);
    url.searchParams.append('organization_id', organizationId);
    if (folderPath) {
        url.searchParams.append('folder_path', folderPath);
    }
    if (category && category !== 'all') {
        url.searchParams.append('category', category);
    }
    if (order) {
        url.searchParams.append('order', order);
    }
    
    const response = await fetch(url.toString(), {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        },
        signal
    });
    if (!response.ok) {
        console.log("Error fetching files:", response.statusText);
        throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
    }
    const result = await response.json();
    return result?.data ?? result;
}

export async function uploadSourceFileToBlob(file: any, organizationId: string, folderPath: string = "") {
    const formdata = new FormData();
    formdata.append("file", file);
    formdata.append("organization_id", organizationId);
    formdata.append("MIME_type", file.type);
    formdata.append("folder_path", folderPath);

    try {
        const response = await fetch("/api/upload-source-document", {
            method: "POST",
            body: formdata,
            redirect: "follow"
        });
        if (!response.ok) {
            console.log("Error uploading file:", response.statusText);
            if (response.status === 422) {
                throw new Error("File type not allowed. Please upload a valid file.");
            }
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }
        const result = await response.json();
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
    return result;
}

export async function createFolder(organizationId: string, folderName: string, currentPath: string = "") {
    const response = await fetch("/api/create-folder", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            organization_id: organizationId,
            folder_name: folderName,
            current_path: currentPath
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        
        // Handle specific error cases
        if (response.status === 409) {
            throw new Error("A folder with this name already exists");
        }
        
        throw new Error(errorData.message || `Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result;
}

export async function moveFile(organizationId: string, sourceBlobName: string, destinationFolderPath: string = "") {
    const response = await fetch("/api/move-file", {
        method: "POST",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            organization_id: organizationId,
            source_blob_name: sourceBlobName,
            destination_folder_path: destinationFolderPath
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        
        // Handle specific error cases
        if (response.status === 403) {
            throw new Error("Unauthorized: You do not have permission to move this file");
        }
        
        if (response.status === 404) {
            throw new Error("Source file not found");
        }
        
        if (response.status === 409) {
            throw new Error("A file with this name already exists in the destination folder");
        }
        
        throw new Error(errorData.message || `Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
    return result;
}

export async function renameFile(
  organizationId: string,
  sourceBlobName: string,
  newFileName: string
) {
  const response = await fetch("/api/rename-file", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organization_id: organizationId,
      source_blob_name: sourceBlobName,
      new_file_name: newFileName,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Unknown error" }));

    if (response.status === 400) throw new Error("Invalid request to rename file");
    if (response.status === 403) throw new Error("Unauthorized: You do not have permission to rename this file");
    if (response.status === 404) throw new Error("Source file not found");
    if (response.status === 409) throw new Error("A file with this name already exists in this folder");
    if (response.status === 422) throw new Error("Invalid file name");

    throw new Error(errorData.message || `Server responded with ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export async function renameFolder(
  organizationId: string,
  folderFullPath: string,
  newFolderName: string
) {
  const response = await fetch("/api/rename-folder", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      organization_id: organizationId,
      folder_full_path: folderFullPath,
      new_folder_name: newFolderName,
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({ message: "Unknown error" }));

    if (response.status === 400) throw new Error("Invalid request to rename folder");
    if (response.status === 403) throw new Error("Unauthorized: You do not have permission to rename this folder");
    if (response.status === 404) throw new Error("Folder not found");
    if (response.status === 409) throw new Error("A folder with this name already exists at this level");
    if (response.status === 422) throw new Error("Invalid folder name");

    throw new Error(errorData.message || `Server responded with ${response.status}: ${response.statusText}`);
  }

  return response.json();
}


export async function deleteFolder(organizationId: string, folderPath: string) {
    const response = await fetch("/api/delete-folder", {
        method: "DELETE",
        headers: {
            "Content-Type": "application/json"
        },
        body: JSON.stringify({
            organization_id: organizationId,
            folder_path: folderPath
        })
    });
    
    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ message: "Unknown error" }));
        
        // Handle specific error cases
        if (response.status === 403) {
            throw new Error("Unauthorized: You do not have permission to delete this folder");
        }
        
        if (response.status === 404) {
            throw new Error("Folder not found");
        }
        
        if (response.status === 400) {
            throw new Error(errorData.message || "Invalid request");
        }
        
        throw new Error(errorData.message || `Server responded with ${response.status}: ${response.statusText}`);
    }
    
    const result = await response.json();
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
        return result;
    } catch (error) {
        console.error("Error uploading file:", error);
        throw error;
    }
}

export async function createCheckoutSession({ userId, priceId, successUrl, cancelUrl, organizationId, userName, organizationName, subscriptionTierId }: any) {
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
            organizationName,
            subscriptionTierId
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
    subscription_id: string;
}): Promise<CustomerPortalSession> {
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
    const response = await fetchWrapper("/api/get-organization-subscription?organizationId=" + organizationId, {
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

export const createOrganizationUsage = async ({ userId, organizationId, subscriptionTierId }: any) => {
    const response = await fetchWrapper("/api/create-organization-usage", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-MS-CLIENT-PRINCIPAL-ID": userId
        },
        body: JSON.stringify({
            organizationId,
            subscriptionTierId
        })
    });
    if (response.status > 299 || !response.ok) {
        throw Error("Error creating organization usage");
    }
    const organizationUsage = await response.json();
    return organizationUsage;
}

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
        body: JSON.stringify({ "new_password": newPassword })
    });

    if (response.status === 404) {
        throw Error(`User with ID ${userId} not found`);
    }

    if (response.status > 299 || !response.ok) {
        throw Error(`Error resetting password for user with ID ${userId}`);
    }

    return response.json();
}

export async function changeSubscription({ subscriptionId, newPlanId, user, organizationId }: { subscriptionId: string; newPlanId: string; user: any; organizationId: string; }): Promise<any> {
    const userId = user ? user.id : "00000000-0000-0000-0000-000000000000";
    const userName = user ? user.name : "anonymous";
    try {
        const response = await fetch(`/api/subscriptions/${subscriptionId}/change`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": userId,
                "X-MS-CLIENT-PRINCIPAL-NAME": userName
            },
            body: JSON.stringify({
                new_plan_id: newPlanId,
                organization_id: organizationId
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

export async function getSubscriptionTierDetails(subscriptionTierId: string): Promise<any> {
    const response = await fetch(`/api/subscriptions-tiers/${subscriptionTierId}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });
    if (!response.ok) {
        throw new Error(`Error getting subscription tier details: ${response.status} ${response.statusText}`);
    }
    return response.json();
}

export async function getLogs(organizationId: string): Promise<any> {
    try {
        const response = await fetch('/api/logs/', {
            method: 'POST',
            headers: {
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

export async function getOrganizationUsage({ organizationId }: { organizationId: string }): Promise<OrganizationUsage> {
    const response = await fetch(`/api/organizations/${organizationId}/get-organization-usage`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json"
        }
    });
    if (response.status > 299 || !response.ok) {
        throw Error("Error getting organization usage");
    }
    const organizationUsage = (await response.json()).data;
    return organizationUsage;
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

        const response = await fetchWrapper("/api/conversations/export", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID": userId
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
    organization_id,
}: {
    brand_id: string;
    user: any;
    organization_id: string;
}): Promise<any> {
    const response = await fetch(`/api/voice-customer/brands/${encodeURIComponent(brand_id)}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
            'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
        },
        body: JSON.stringify({ organization_id }),
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
    organization_id,
}: {
    brand_id: string;
    brand_name: string;
    brand_description: string;
    user: any;
    organization_id: string;
}): Promise<any> {
    const response = await fetch(`/api/voice-customer/brands/${encodeURIComponent(brand_id)}`, {
        method: 'PATCH',
        headers: {
            'Content-Type': 'application/json',
            'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
            'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
        },
        body: JSON.stringify({ brand_name, brand_description, organization_id }),
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
    user,
    category,
}: {
    product_name: string;
    product_description: string;
    brand_id: string;
    organization_id: string;
    user: any;
    category: string;
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
    organization_id,
}: {
    product_id: string;
    user: any;
    organization_id: string;
}): Promise<any> {
    const response = await fetch(`/api/voice-customer/products/${encodeURIComponent(product_id)}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
            'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
        },
        body: JSON.stringify({ organization_id }),
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
    const response = await fetchWrapper(`/api/voice-customer/organizations/${encodeURIComponent(organization_id)}/products`, {
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
    brand_id,
    user,
    organization_id,
    category,
}: {
    product_id: string;
    product_name: string;
    product_description: string;
    brand_id: string;
    user: any;
    organization_id: string;
    category: string;
}): Promise<any> {
    const response = await fetchWrapper(`/api/voice-customer/products/${encodeURIComponent(product_id)}`, {
        method: 'PATCH',
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
        throw new Error(data?.message || data?.error || 'Error updating product');
    }
    return data;
}

// Create a competitor
export async function createCompetitor({
    competitor_name,
    competitor_description,
    brands_id,
    organization_id,
    user,
}: {
    competitor_name: string;
    competitor_description: string;
    brands_id: string[];
    organization_id: string;
    user: any;
}): Promise<any> {
    const response = await fetchWrapper('/api/voice-customer/competitors', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
            'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
        },
        body: JSON.stringify({
            competitor_name,
            competitor_description,
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
    organization_id,
}: {
    competitor_id: string;
    user: any;
    organization_id: string;
}): Promise<any> {
    const response = await fetchWrapper(`/api/voice-customer/competitors/${encodeURIComponent(competitor_id)}`, {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
            'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
        },
        body: JSON.stringify({ organization_id }),
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
    const response = await fetchWrapper(`/api/voice-customer/organizations/${encodeURIComponent(organization_id)}/competitors`, {
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
    user,
    organization_id,
}: {
    competitor_id: string;
    competitor_name: string;
    competitor_description: string;
    user: any;
    organization_id: string;
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
            organization_id,
        }),
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(data?.message || data?.error || 'Error updating competitor');
    }
    return data;
}

// This needs to be implemented in the future with a Delete Modal in Voice of Customer. DO NOT DELETE
export async function getItemsToDeleteByBrand({ brand_id, user, organization_id }: { brand_id: string; user: any, organization_id: string }): Promise<any> {
    const response = await fetch(`/api/voice-customer/organization/${encodeURIComponent(organization_id)}/brands/${encodeURIComponent(brand_id)}/items-to-delete/`, {
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

/**
 * Generic function for fetching any file type from Azure blob storage
 * @param fileName - The name/path of the file to fetch
 * @param container - The container name (defaults to "documents")
 * @returns Promise<Blob> - The file blob data
 */
export async function getFileBlob(fileName: string, container: string = "documents"): Promise<Blob> {
    // Clean prefix 'documents/' if present
    const cleanedFileName = fileName.startsWith('documents/')
        ? fileName.slice('documents/'.length)
        : fileName;

    try {
        const response = await fetch('/api/get-blob', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                container: container,
                blob_name: cleanedFileName
            })
        });

        if (!response.ok) {
            throw new Error(`Error fetching file: ${response.status} ${response.statusText}`);
        }

        return await response.blob();
    } catch (error) {
        console.error('Error fetching file blob:', error);
        throw new Error('Error fetching file.');
    }
}

export async function getBlobSasUrl(blobName: string, containerName: string = "documents"): Promise<string> {
    const response = await fetchWrapper('/api/generate-sas-url', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ blob_name: blobName, container_name: containerName })
    });
    const data = await response.json();
    if (!response.ok) {
        throw new Error(`Failed to generate SAS URL: ${data.error}`);
    }
    return data.sas_url;
}


/**
 * @param filePath - The file path/URL for the Excel file
 * @returns Promise with download URL and metadata
 */
export async function generateExcelDownloadUrl(filePath: string): Promise<{
    success: boolean;
    download_url: string;
    preview_url?: string;
    sas_url?: string;     // fallback public blob SAS (Excel only)
    filename: string;
    expires_in_days: number;
}> {
    try {
        const response = await fetchWrapper('/api/download-excel-citation', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                file_path: filePath
            })
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
            throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
    } catch (error) {
        throw error;
    }
}

export async function getGalleryItems(
    organization_id: string,
    params: {
        user: any;
        uploader_id?: string | null;
        order?: "newest" | "oldest";
        query?: string;
        page?: number;
        limit?: number;
        signal?: AbortSignal;
    }
): Promise<{
    items: any[];
    total: number;
    page: number;
    limit: number;
    total_pages: number;
    has_next: boolean;
    has_prev: boolean;
}> {
    const qs = new URLSearchParams();
    if (params.uploader_id) qs.set("uploader_id", params.uploader_id);
    if (params.order) qs.set("order", params.order);
    if (params.query) qs.set("query", params.query);
    if (params.page) qs.set("page", params.page.toString());
    if (params.limit) qs.set("limit", params.limit.toString());

    const url = `/api/organization/${encodeURIComponent(organization_id)}/gallery${qs.toString() ? `?${qs.toString()}` : ""}`;

    const response = await fetchWrapper(url, {
        method: "GET",
        headers: {
            "X-MS-CLIENT-PRINCIPAL-ID": params.user?.id ?? "00000000-0000-0000-0000-000000000000",
            "X-MS-CLIENT-PRINCIPAL-NAME": params.user?.name ?? "anonymous",
            Accept: "application/json"
        },
        signal: params.signal
    });

    if (!response.ok) {
        const bodyText = await response.text().catch(() => "");
        console.error(`Failed to fetch gallery items: ${response.status} ${response.statusText}`, bodyText);
        throw new Error(`Failed to fetch gallery items: ${response.status}`);
    }

    const contentType = response.headers.get("content-type") || "";
    if (!contentType.includes("application/json")) {
        const bodyText = await response.text().catch(() => "");
        console.error("Unexpected non-JSON response from gallery API:", bodyText);
        throw new Error("Invalid response from gallery API (expected JSON)");
    }

    const data = await response.json().catch((err) => {
        console.error("Error parsing gallery JSON response:", err);
        throw new Error("Invalid JSON from gallery API");
    });

    const result = data?.data ?? data ?? {};
    return {
        items: result.items ?? [],
        total: result.total ?? 0,
        page: result.page ?? 1,
        limit: result.limit ?? 10,
        total_pages: result.total_pages ?? 0,
        has_next: result.has_next ?? false,
        has_prev: result.has_prev ?? false
    };
}

export async function fetchReportJobs({
    organization_id,
    user,
    limit = 10,
    status,
}: {
    organization_id: string;
    user: any;
    limit?: number;
    status?: BackendReportStatus;
}): Promise<BackendReportJobDoc[]> {
    const params = new URLSearchParams({
        organization_id,
        limit: String(limit),
    });
    if (status) params.set("status", status);

    const headers: Record<string, string> = {
        "Content-Type": "application/json",
        "X-MS-CLIENT-PRINCIPAL-ID": user?.id ?? "00000000-0000-0000-0000-000000000000",
        "X-MS-CLIENT-PRINCIPAL-NAME": user?.name ?? "anonymous",
    };

    const res = await fetchWrapper(`/api/report-jobs?${params.toString()}`, { method: "GET", headers });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
        const msg = (data && (data.message || data.error)) || `Failed to fetch report jobs (${res.status})`;
        throw new Error(msg);
    }

    return Array.isArray(data) ? data : [];
}


export async function getIndustryByOrganization({ organization_id, user }: { organization_id: string; user?: any }): Promise<{ industry_description?: string } | null> {
    const response = await fetchWrapper(`/api/voice-customer/organizations/${organization_id}/industry`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
            'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
            'X-MS-CLIENT-PRINCIPAL-ORGANIZATION': user?.organizationId ?? '00000000-0000-0000-0000-000000000000',
        },
    });

    if (response.status === 404) return null;
    const res = await response.json();

    if (response.status > 299 || !response.ok) throw new Error('Failed to fetch industry');
    return res.data;
}

export async function upsertIndustry({ organization_id, industry_description, user }: { organization_id: string | number; industry_description: string; user?: any }): Promise<any> {
    const payload = { "industry_description": industry_description };
    const response = await fetchWrapper(`/api/voice-customer/organizations/${organization_id}/industry`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
            'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
            'X-MS-CLIENT-PRINCIPAL-ORGANIZATION': user?.organizationId ?? '00000000-0000-0000-0000-000000000000',
        },
        body: JSON.stringify(payload),
    });

    if (response.status > 299 || !response.ok) throw new Error('Failed to upsert industry');
    return await response.json();
}


export async function createCategory({
    organization_id,
    user,
    name,
    description,
    metadata,
}: {
    organization_id: string;
    user: any;
    name: string;
    description?: string;
    metadata?: object;
}): Promise<Category> {
    const res = await fetchWrapper("/api/categories", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-MS-CLIENT-PRINCIPAL-ID":
                user?.id ?? "00000000-0000-0000-0000-000000000000",
            "X-MS-CLIENT-PRINCIPAL-NAME": user?.name ?? "anonymous",
        },
        body: JSON.stringify({ organization_id, name, description, metadata }),
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) throw new Error(data?.message || data?.error || "Error creating category");
    return data as Category;
}


export async function getCategory(categoryId: string, organizationId: string): Promise<Category> {
    const response = await fetchWrapper(`/api/categories/${categoryId}?organization_id=${organizationId}`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json'
        }
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Error fetching category: ${response.statusText}`);
    }

    return response.json();
}


export async function getCategoriesByOrganization({
    organization_id,
    user,
    limit = 50,
}: {
    organization_id: string;
    user: any;
    limit?: number;
}): Promise<Category[]> {
    const params = new URLSearchParams({
        organization_id,
        limit: String(limit),
    });

    const res = await fetchWrapper(`/api/categories?${params.toString()}`, {
        method: "GET",
        headers: {
            "Content-Type": "application/json",
            "X-MS-CLIENT-PRINCIPAL-ID":
                user?.id ?? "00000000-0000-0000-0000-000000000000",
            "X-MS-CLIENT-PRINCIPAL-NAME": user?.name ?? "anonymous",
        },
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.message || data?.error || "Error fetching categories");
    }
    return Array.isArray(data) ? data : [];
}


export async function deleteCategory({
    category_id,
    organization_id,
    user,
}: {
    category_id: string;
    organization_id: string;
    user: any;
}): Promise<void> {
    const res = await fetchWrapper(
        `/api/categories/${encodeURIComponent(category_id)}?organization_id=${encodeURIComponent(organization_id)}`,
        {
            method: "DELETE",
            headers: {
                "Content-Type": "application/json",
                "X-MS-CLIENT-PRINCIPAL-ID":
                    user?.id ?? "00000000-0000-0000-0000-000000000000",
                "X-MS-CLIENT-PRINCIPAL-NAME": user?.name ?? "anonymous",
            },
        }
    );
    if (res.status !== 204 && !res.ok) {
        const data = await res.json().catch(() => null);
        throw new Error(data?.message || data?.error || "Error deleting category");
    }
}

export async function uploadUserDocument({
    file,
    conversationId,
    user
}: {
    file: File;
    conversationId: string;
    user: any;
}): Promise<{ blob_url: string; blob_name: string; saved_filename: string; original_filename: string }> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('conversation_id', conversationId);

    try {
        const response = await fetchWrapper('/api/upload-user-document', {
            method: 'POST',
            headers: {
                'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
                'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
                'X-MS-CLIENT-PRINCIPAL-ORGANIZATION': user?.organizationId ?? ''
            },
            body: formData
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => null);
            throw new Error(errorData?.error?.message || `Upload failed: ${response.status}`);
        }

        const result = await response.json();
        const payload = result?.data ?? result; //{ data: { ... }, status }
        return payload;
    } catch (error) {
        console.error('Error uploading user document:', error);
        throw error;
    }
}

export async function deleteUserDocument({
    blobName,
    conversationId,
    user
}: {
    blobName: string;
    conversationId: string;
    user: any;
}): Promise<{ message: string }> {
    const res = await fetchWrapper('/api/delete-user-document', {
        method: 'DELETE',
        headers: {
            'Content-Type': 'application/json',
            'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
            'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
            'X-MS-CLIENT-PRINCIPAL-ORGANIZATION': user?.organizationId ?? ''
        },
        body: JSON.stringify({
            blob_name: blobName,
            conversation_id: conversationId
        })
    });

    const data = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(data?.error || data?.message || 'Error deleting user document');
    }
    return data?.data ?? data;
}

export async function listUserDocuments({
    conversationId,
    user
}: {
    conversationId: string;
    user: any;
}): Promise<Array<{ blob_name: string; saved_filename: string; original_filename: string; size?: number; uploaded_at?: string }>> {
    const params = new URLSearchParams({
        conversation_id: conversationId,
    });

    const res = await fetchWrapper(`/api/list-user-documents?${params.toString()}`, {
        method: 'GET',
        headers: {
            'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
            'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
            'X-MS-CLIENT-PRINCIPAL-ORGANIZATION': user?.organizationId ?? ''
        }
    });

    const json = await res.json().catch(() => null);
    if (!res.ok) {
        throw new Error(json?.error?.message || json?.message || 'Error listing user documents');
    }
    const files = json?.data?.files ?? [];
    return Array.isArray(files) ? files : [];
}


export async function getStorageUsageByOrganization(organization_id: string, user?: any) {
    const response = await fetchWrapper(`/api/organizations/${encodeURIComponent(organization_id)}/storage-usage`, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
            'X-MS-CLIENT-PRINCIPAL-ID': user?.id ?? '00000000-0000-0000-0000-000000000000',
            'X-MS-CLIENT-PRINCIPAL-NAME': user?.name ?? 'anonymous',
        },
    });

    if (!response.ok) {
        const error = await response.json();
        throw new Error(error.message || `Error fetching storage usage: ${response.statusText}`);
    }

    return response.json();
}

export async function uploadSharedDocument(file: File) {
    const formdata = new FormData();
    formdata.append("file", file);

    try {
        const response = await fetchWrapper("/api/upload-shared-document", {
            method: "POST",
            body: formdata
        });
        
        if (!response.ok) {
            console.log("Error uploading shared file:", response.statusText);
            if (response.status === 422) {
                throw new Error("File type not allowed. Please upload a valid file.");
            }
            throw new Error(`Server responded with ${response.status}: ${response.statusText}`);
        }
        
        const result = await response.json();
        return result;
    } catch (error) {
        console.error("Error uploading shared file:", error);
        throw error;
    }
}
/* NOTE: Take Into consideration the difference between Fetch and FetchWrapper when adding new API functions
            FetchWrapper includes automatic session validation and retry logic and error handling.
            Use FetchWrapper for all new API calls if you need automatic session management...
            if you're gonna make a lot of recurrent calls to the API in a short time frame. You should use Fetch instead of FetchWrapper
*/

