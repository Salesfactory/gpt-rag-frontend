import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Agent Section Tests", () => {
    beforeEach(() => {
        setupTestUserAndOrg();
        // Start from the web app that triggers the B2C sign-in
        cy.visit("/", {
            onBeforeLoad: (window) => {
                
            }
        });
        // Verify the button is visible
        cy.get("button#headerCollapse").should("be.visible");

        // Click the button
        cy.get("button#headerCollapse").click();
    });

    it('Should verify the visibility and functionality of the "AI Chat" link', () => {
        // Verify the AI Chat link is visible
        cy.get('a[href="#/"]').contains("AI Chat").should("be.visible");

        // Click the AI Chat link and verify it navigates to the correct page
        cy.get('a[href="#/"]').contains("AI Chat").click();

        // Assert the current URL to ensure navigation works
        cy.url().should("include", "#/");

        // Optionally, verify the presence of an element on the AI Chat page
        cy.get('textarea[placeholder="Write your question here"]').should("be.visible");
    });

    it('Should verify the visibility and functionality of the "Notifications" link', () => {
        // Verify the Notifications link is visible
        cy.get('a[href="#/notification-settings"]').contains("Notifications").should("be.visible");

        // Click the Notifications link and verify it navigates to the correct page
        cy.get('a[href="#/notification-settings"]').contains("Notifications").click();

        // Assert the current URL to ensure navigation works
        cy.url().should("include", "#/notification-settings");

        // Optionally, verify the presence of an element on the Notifications page
        //cy.get("h1").contains("Notification Settings").should("be.visible"); // Update as per your page structure
    });
});
