import { defineConfig } from "cypress";
import { build, preview } from "vite";

// This is "cypress open" when developing tests and "cypress run" when just running tests, e.g. CI
const IS_INTERACTIVE = process.env.npm_lifecycle_script?.includes("cypress open");

export default defineConfig({
    e2e: {
        baseUrl: "http://localhost:3000",
        async setupNodeEvents(on) {
            console.log(`Starting Vite server${IS_INTERACTIVE ? " in watch mode" : ""}.`);
            const watcher = await build({ build: { watch: IS_INTERACTIVE ? {} : null } });
            const server = await preview({ preview: { port: 3000, strictPort: true } });

            on("after:run", async () => {
                if ("close" in watcher) {
                    await watcher.close();
                }

                await new Promise((resolve, reject) => {
                    server.httpServer.close(error => (error ? reject(error) : resolve()));
                });
            });
        }
    }
});
