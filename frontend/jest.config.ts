// jest.config.ts
import type { Config } from "jest";

const config: Config = {
    testEnvironment: "jsdom",
    setupFilesAfterEnv: ["<rootDir>/src/setupTests.ts"],
    moduleNameMapper: {
        "^@/(.*)$": "<rootDir>/src/$1"
    },
    transform: {
        "^.+\\.tsx?$": ["ts-jest", { tsconfig: "./tsconfig.json" }]
    }
};
export default config;
