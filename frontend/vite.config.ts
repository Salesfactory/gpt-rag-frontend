import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import compression from 'vite-plugin-compression';

// https://vitejs.dev/config/
export default defineConfig({
    plugins: [
        react(),
        // Generate gzipped versions of assets
        compression({
            algorithm: 'gzip',
            ext: '.gz',
            threshold: 1024, // Only compress files larger than 1KB
            deleteOriginFile: false
        }),
        // Generate brotli versions of assets (better compression)
        compression({
            algorithm: 'brotliCompress',
            ext: '.br',
            threshold: 1024,
            deleteOriginFile: false
        })
    ],
    build: {
        outDir: "../backend/static",
        emptyOutDir: true,
        sourcemap: true,
        cssCodeSplit: true,
        rollupOptions: {
            output: {
                manualChunks: {
                    // Separate vendor libraries
                    vendor: ['react', 'react-dom'],
                    // Separate UI components that might not be needed immediately
                    ui: ['@fluentui/react'],
                },
                // Optimize asset file names for better caching
                assetFileNames: (assetInfo) => {
                    const info = assetInfo.name?.split('.') || [];
                    const ext = info[info.length - 1];
                    if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
                        return `assets/images/[name]-[hash][extname]`;
                    } else if (/css/i.test(ext)) {
                        return `assets/css/[name]-[hash][extname]`;
                    }
                    return `assets/[name]-[hash][extname]`;
                },
                chunkFileNames: 'assets/js/[name]-[hash].js',
                entryFileNames: 'assets/js/[name]-[hash].js'
            }
        },
        // Optimize chunk size
        chunkSizeWarningLimit: 1000
    },
    server: {
        proxy: {
            "/stream_chatgpt": "http://127.0.0.1:8000",
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
            "/api/get-source-documents": "http://127.0.0.1:8000/",
            "/api/upload-source-document": "http://127.0.0.1:8000/",
            "/api/organization": "http://127.0.0.1:8000",
            "/api/delete-source-document": "http://127.0.0.1:8000/",
        },
        host: true
    }
});