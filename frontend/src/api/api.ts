import { 
    AskRequest, 
    AskResponse, 
    AskResponseGpt, 
    ChatRequest, 
    ChatRequestGpt, 
    GetSettingsProps, 
    PostSettingsProps 
} from "./models";

const loadModule = async (modulePath : string) => {
    try {
      return (await import(/* @vite-ignore */modulePath))?.default;
    } catch (e) {
        console.log("Error loading " + modulePath, e);
    }
}

export async function getSettings({ user }: GetSettingsProps): Promise<any> {
    const settings = await loadModule("./settings.json");
    const baseUrl = settings?.ENVIRONMENT === "development" ? settings?.LOCAL_API : "";

    const user_id = user ? user.id : "00000000-0000-0000-0000-000000000000";
    const user_name = user ? user.name : "anonymous";
    const url = baseUrl + "/api/settings";
    try {
        const response = await fetch(url, {
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
        console.error("Error fetching settings", error);
        return {};
    }
}

export async function postSettings({ user, temperature, presence_penalty, frequency_penalty } : PostSettingsProps): Promise<any> {
    const settings = await loadModule("./settings.json");
    const baseUrl = settings?.ENVIRONMENT === "development" ? settings?.LOCAL_API : "";
    
    const user_id = user ? user.id : "00000000-0000-0000-0000-000000000000";
    const user_name = user ? user.name : "anonymous";
    const url = baseUrl + "/api/settings";
    try {
        const response = await fetch(url, {
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
    const settings = await loadModule("./settings.json");
    const baseUrl = settings?.ENVIRONMENT === "development" ? settings?.LOCAL_API : "";
    const response = await fetch(baseUrl + "/chatgpt", {
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

export function getCitationFilePath(citation: string): string {
    var storage_account = "please_check_if_storage_account_is_in_frontend_app_settings";
    
    const xhr = new XMLHttpRequest();
    xhr.open("GET", "/api/get-storage-account", false);
    xhr.send();

    if (xhr.status > 299) {
        console.log("Please check if STORAGE_ACCOUNT is in frontend app settings");
        return storage_account
    } else {
        const parsedResponse = JSON.parse(xhr.responseText);
        storage_account = parsedResponse['storageaccount'];
    }
    console.log('storage account:' + storage_account);

    return `https://${storage_account}.blob.core.windows.net/documents/${citation}`;
}