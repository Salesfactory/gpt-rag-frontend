import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Main Page (Chat) Test Suite", () => {
        beforeEach(() => {
            setupTestUserAndOrg()
            cy.visit("/");
            cy.get("button#headerCollapse").should("be.visible");
            cy.get("button#headerCollapse").click();
    });

    it("Should verify the visibilty and functionality of the Main Page Chat",  () => {
        // Verify the AI Chat link is visible
        cy.get('a[href="#/"]').contains("AI Chat").should("be.visible");

        // Click the AI Chat link and verify it navigates to the correct page
        cy.get('a[href="#/"]').contains("AI Chat").click();

        // Assert the current URL to ensure navigation works
        cy.url().should("include", "#/");

        cy.get('textarea[placeholder="Write your question here"]').should("be.visible");
        
        cy.contains("Your AI-driven Home Improvement expert who boosts marketing performance by synthesizing multiple data sources to deliver actionable insights.").should("be.visible")
        cy.contains("This app is in beta. Responses may not be fully accurate.").should("be.visible")

    })

    it("Should verify the visibility and functionality of the Chat Input", () => {
        // Verify the chat input is visible
        cy.get('textarea[placeholder="Write your question here"]').should("be.visible");

        // Type a message into the chat input
        cy.get('textarea[placeholder="Write your question here"]').type("Hello, how can I improve my home?");
        cy.get('._questionInputSendButton_116us_37').should("be.visible");
        // Click the send button
        cy.get('._questionInputSendButton_116us_37').click();

        // Verify the message appears in the chat
        cy.get('._message_1nwfo_9').first().should("contain.text", "Hello, how can I improve my home?");
    });

    it("Should verify the visibility and functionality of the Settings page", () => {
        cy.get(':nth-child(3) > ._tooltipWrapper_16w4s_240 > .btn').should("be.visible")
        cy.get(':nth-child(3) > ._tooltipWrapper_16w4s_240 > .btn').click();

        cy.contains("Chat Settings").should("be.visible");
        cy.contains("Font Type").should("be.visible");
        cy.contains("Font Size").should("be.visible");
        cy.contains("Model Selection").should("be.visible");
        cy.contains("Creativity Scale").should("be.visible");
        
    })

    it("Should verify the functionality of the Save Settings button", () => {
        cy.get(':nth-child(3) > ._tooltipWrapper_16w4s_240 > .btn').should("be.visible")
        cy.get(':nth-child(3) > ._tooltipWrapper_16w4s_240 > .btn').click();

        // Verify the Save Settings button is visible
        cy.get('[aria-label="Save settings"]').should("be.visible");

        // Click the Save Settings button
        cy.get('[aria-label="Save settings"]').click();

        cy.get('.ms-Button--primary').should("be.visible");
        cy.get('.ms-Button--primary').contains("Save").should("be.visible");
        cy.get('.ms-Button--primary').click();

        // Verify a success message appears
        cy.contains("Successfully saved data. The page will reload in 2 seconds.").should("be.visible");
    })

})