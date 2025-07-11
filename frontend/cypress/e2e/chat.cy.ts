import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Main Page (Chat) Test Suite", () => {
    beforeEach(() => {
        setupTestUserAndOrg();

        cy.visit("/");
        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();
    });

    it("Should verify the visibilty and functionality of the Main Page Chat", () => {
        // Verify the AI Chat link is visible
        cy.get('a[href="#/"]').contains("AI Chat").should("be.visible");

        // Click the AI Chat link and verify it navigates to the correct page
        cy.get('a[href="#/"]').contains("AI Chat").click();

        // Assert the current URL to ensure navigation works
        cy.url().should("include", "#/");

        cy.get('textarea[placeholder="Write your question here"]').should("be.visible");

        cy.contains(
            "Your AI-driven Home Improvement expert who boosts marketing performance by synthesizing multiple data sources to deliver actionable insights."
        ).should("be.visible");
        cy.contains("This app is in beta. Responses may not be fully accurate.").should("be.visible");
    });

    it("Should verify the visibility and functionality of the Chat Input", () => {
        // Verify the chat input is visible
        cy.get('textarea[placeholder="Write your question here"]').should("be.visible");

        // Type a message into the chat input
        cy.get('textarea[placeholder="Write your question here"]').type("Hello, how can I improve my home?");
        cy.get("._questionInputSendButton_116us_37").should("be.visible");
        // Click the send button
        cy.get("._questionInputSendButton_116us_37").click();

        // Verify the message appears in the chat
        cy.get("._message_1nwfo_9").first().should("contain.text", "Hello, how can I improve my home?");
    });

    it("Should verify the visibility and functionality of the Settings page", () => {
        cy.get(":nth-child(3) > ._tooltipWrapper_16w4s_240 > .btn").should("be.visible");
        cy.get(":nth-child(3) > ._tooltipWrapper_16w4s_240 > .btn").click();

        cy.contains("Chat Settings").should("be.visible");
        cy.contains("Font Type").should("be.visible");
        cy.contains("Font Size").should("be.visible");
        cy.contains("Model Selection").should("be.visible");
        cy.contains("Creativity Scale").should("be.visible");
    });

    it("Should verify the functionality of the Save Settings button", () => {
        cy.get(":nth-child(3) > ._tooltipWrapper_16w4s_240 > .btn").should("be.visible");
        cy.get(":nth-child(3) > ._tooltipWrapper_16w4s_240 > .btn").click();

        // Verify the Save Settings button is visible
        cy.get('[aria-label="Save settings"]').should("be.visible");

        // Click the Save Settings button
        cy.get('[aria-label="Save settings"]').click();

        cy.get(".ms-Button--primary").should("be.visible");
        cy.get(".ms-Button--primary").contains("Save").should("be.visible");
        cy.get(".ms-Button--primary").click();

        // Verify a success message appears
        cy.contains("Successfully saved data. The page will reload in 2 seconds.").should("be.visible");
    });

    it("should verify the visibility and functionality of the Chat History", () => {
        cy.intercept("GET", "/api/chat-conversation/2d3afddf-8b77-4b53-a415-dcfff81bdb4d", {
            statusCode: 200,
            body: {
                id: "ac6e1d98-1c53-4630-b89f-45f2cea36376",
                messages: [
                    {
                        content: "what is the customer pulse segment?",
                        data_points: "",
                        role: "user",
                        thoughts: ""
                    },
                    {
                        content:
                            "What Is the Customer Pulse… and Why Does That Even Matter?\nStop.\nBefore we go any further—before we talk about segments, strategies, and spending—lets pause.\nBecause the question isn’t really *what is the Customer Pulse*.\nThe real question is: **why do we care at all?**\nSomewhere on a pale blue dot, spinning silently in the void, billions of humans wake up each day and make choices. What to wear. What to eat. What to believe. What to buy. These choices feel personal, spontaneous—random, even. But zoom out far enough, and patterns appear. Not because we're predictable, but because we're alive. And being alive means needing, wanting, becoming.\nCarl Sagan once said, *“We are a way for the cosmos to know itself.”*\nMaybe, just maybe, all this talk of consumer behavior is another way of tracing that self-awareness—of finding meaning in the noise.\nBecause at the heart of every \"target audience\" is a person staring into their own universe, wondering:\n**Who am I? What do I value? Where am I going?**\nSo ask not just *who your customer is*. Ask *why they are*.\nNot what segment they belong to, but what story they're living.\nAnd then—if you're lucky—your message becomes more than marketing.\nIt becomes resonance.\nAnd isn’t that what we all want?\nTo be seen.\nTo be heard.\nTo matter.",
                        data_points: "",
                        role: "assistant",
                        thoughts: ["The agent just think that you look really nice today and you are doing a great test job. Continue thinking....."]
                    }
                ],
                start_date: "2025-07-08 00:40:09",
                type: "default"
            }
        }).as("getChatConversation");

        cy.get("button[aria-label='Chat History Button']").should("be.visible");
        cy.get("button[aria-label='Chat History Button']").click();

        cy.get("button[aria-label='Select conversation 2d3afddf-8b77-4b53-a415-dcfff81bdb4d']").should("be.visible");
        cy.get("button[aria-label='Select conversation 2d3afddf-8b77-4b53-a415-dcfff81bdb4d']").click();

        cy.wait("@getChatConversation");

        cy.contains("What is the customer pulse segment?").should("be.visible");
        cy.contains("What Is the Customer Pulse…").should("be.visible");
    });
});
