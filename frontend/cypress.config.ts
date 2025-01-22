import { defineConfig } from "cypress";

export default defineConfig({
    pageLoadTimeout: 120000, // Increase timeout to 2 minutes
    defaultCommandTimeout: 10000,
    e2e: {
        baseUrl: "http://localhost:5173", // Set the base URL
        setupNodeEvents(on, config) {
            // Node event listeners
        }
    }
});
