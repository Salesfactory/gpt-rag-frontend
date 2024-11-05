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
            "/chatgpt": "http://localhost:8000",
            "/api/stripe": "http://localhost:8000",
            "/api/chat-history": "http://localhost:8000",
            "/api/chat-conversation/<chat_id>": "http://localhost:8000",
            "/api/chat-conversations/<chat_id>": "http://localhost:8000",
            "/api/create-organization": "http://localhost:8000",
            "/api/get-speech-token": "http://localhost:8000",
            "/api/get-storage-account": "http://localhost:8000",
            "/create-checkout-session": "http://localhost:8000",
            "/webhook": "http://localhost:8000",
            "/api/upload-blob": "http://localhost:8000",
            "/api/get-blob": "http://localhost:8000",
            "/api/settings": "http://localhost:8000",
            "/api/feedback": "http://localhost:8000",
            "/api/getusers": "http://localhost:8000",
            "/api/deteleuser": "http://localhost:8000",
            "/api/inviteUser": "http://localhost:8000",
            "/api/getInvitations": "http://localhost:8000",
            "/api/createInvitation": "http://localhost:8000",
            "/api/checkuser": "http://localhost:8000",
            "/api/get-organization-subscription": "http://localhost:8000",
            "/api/getUser": "http://localhost:8000",
            "/api/conversations": "http://localhost:8000",
            "/api/chat": "http://localhost:8000",
            "/api/auth/user": "http://localhost:8000",
            "/api/prices": "http://localhost:8000"
        },
        host: true
    }
});
