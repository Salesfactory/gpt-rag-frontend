import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Voice Customer Test Suite", () => {
    beforeEach(() => {
        setupTestUserAndOrg();
    });

    it("should display the voice customer page", () => {
        cy.visit("/voice-customer");
        cy.contains("Voice Customer");
    });
});