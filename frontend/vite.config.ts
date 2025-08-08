import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [react()],
    build: {
        outDir: "../backend/static",
        emptyOutDir: true,
        sourcemap: true
    },
    server: {
        proxy: {
            "/chatgpt": "http://127.0.0.1:8000",
            "/api/stripe": "http://127.0.0.1:8000",
            "/api/chat-history": "http://127.0.0.1:8000",
            "/api/chat-conversation/<chat_id>": "http://127.0.0.1:8000",
            "/api/chat-conversations/<chat_id>": "http://127.0.0.1:8000",
            "/api/create-organization": "http://127.0.0.1:8000",
            "/api/get-speech-token": "http://127.0.0.1:8000",
            "/api/get-storage-account": "http://127.0.0.1:8000",
            "/create-checkout-session": "http://127.0.0.1:8000",
            "/webhook": "http://127.0.0.1:8000",
            "/api/upload-blob": "http://127.0.0.1:8000",
            "/api/get-blob": "http://127.0.0.1:8000",
            "/api/settings": "http://127.0.0.1:8000",
            "/api/feedback": "http://127.0.0.1:8000",
            "/api/getusers": "http://127.0.0.1:8000",
            "/api/deteleuser": "http://127.0.0.1:8000",
            "/api/inviteUser": "http://127.0.0.1:8000",
            "/api/getInvitations": "http://127.0.0.1:8000",
            "/api/createInvitation": "http://127.0.0.1:8000",
            "/api/checkuser": "http://127.0.0.1:8000",
            "/api/get-organization-subscription": "http://127.0.0.1:8000",
            "/api/getUser": "http://127.0.0.1:8000",
            "/api/get-user-organizations": "http://127.0.0.1:8000",
            "/api/get-users-organizations-role": "http://127.0.0.1:8000",
            "/api/conversations": "http://127.0.0.1:8000",
            "/api/chat": "http://127.0.0.1:8000",
            "/api/auth/user": "http://127.0.0.1:8000",
            "/api/prices": "http://127.0.0.1:8000",
            "/api/subscription/<subscriptionId>/financialAssistant": "http://127.0.0.1:8000",
            "^/api/subscriptions/.*?/tiers": {
                target: "http://127.0.0.1:8000",
                changeOrigin: true
            },
            "^/api/subscription/.*?/financialAssistant": {
                target: "http://127.0.0.1:8000/",
                changeOrigin: true
            },
            "/api/reports":"http://localhost:8000/",
            "/api/reports/<report_id>":"http://localhost:8000/",
            "/api/logs":"http://localhost:8000/",
            "/api/companydata": "http://localhost:8000/",
            "/api/voice-customer": "http://localhost:8000/",
            "/api/get-source-documents": "http://127.0.0.1:8000",
            "api/upload-source-document": "http://127.0.0.1:8000"
        },
        host: true
    }
});