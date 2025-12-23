import { setupTestUserAndOrg } from "../fixtures/setupTestUser";
describe('AnalysisPanel Component', () => {
  beforeEach(() => {
    setupTestUserAndOrg();
    cy.visit('/', {
        onBeforeLoad: (window) => {
            
        }
    });
  });

    it("should verify the visibility and functionality of the Thought process with subquery conversations", () => {
        cy.intercept("GET", "/api/chat-conversation/6e77f115-6df9-40b4-a321-a0a7c700938b", {
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
                            "#### What Is Consumer Pulse Segmentation?  \n**Key Takeaway:**  \nConsumer Pulse Segmentation is a modern, data-driven approach to dividing the consumer market into actionable groups based on demographics, psychographics, financial situations, and behavioral traits.",
                        data_points: "",
                        role: "assistant",
                        thoughts: {
                            model_used: "gpt-4.1",
                            query_category: "General",
                            original_query: "what is the consumer pulse segmentation",
                            rewritten_query: "Definition of consumer pulse segmentation in marketing and advertising industry",
                            mcp_tool_used: "agentic_search",
                            context_docs: [
                                {
                                    content: "Sales Factory Consumer Pulse Segmentation Description\\nSales Factory surveyed 5,600+ US consumers and developed a two-level segmentation solution.",
                                    source: "https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/Segmentation/Consumer%20Pulse%20Segmentation%20Description.docx"
                                },
                                {
                                    content: "Consumer Pulse Segmentation Summary\\nPrimary Consumer Pulse Segments include Aspiring Singles, Affluent & Educated, Stable Strategists.",
                                    source: "https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/Segmentation/Consumer%20Pulse%20Segmentation%20Summary.docx"
                                },
                                {
                                    content: "Consumer Pulse Secondary Segments Experiences Shopping And Wellness analysis provides insights into spending habits.",
                                    source: "https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/Segmentation/Consumer%20Pulse%20Secondary%20Segments%20-%20Experiences%20Shopping%20and%20Wellness%20.docx"
                                }
                            ]
                        }
                    }
                ],
                start_date: "2025-07-08 00:40:09",
                type: "default"
            }
        }).as("getChatConversation");

        cy.get("button[aria-label='Chat History Button']").should("be.visible");
        cy.get("button[aria-label='Chat History Button']").click();

        cy.get("button[aria-label='Select conversation 6e77f115-6df9-40b4-a321-a0a7c700938b']").should("be.visible");
        cy.get("button[aria-label='Select conversation 6e77f115-6df9-40b4-a321-a0a7c700938b']").click();

        cy.get("button[aria-label='Show thought process']").should("be.visible");
        cy.get("button[aria-label='Show thought process']").click();

        cy.contains("Agent Type").should("be.visible");
        cy.contains("agentic_search").should("be.visible");

        cy.contains("Context Documents").should("be.visible");
        cy.contains("Sales Factory Consumer Pulse Segmentation Description").should("be.visible");
        cy.contains("Consumer Pulse Segmentation Summary").should("be.visible");
        cy.contains("Consumer Pulse Secondary Segments Experiences Shopping And Wellness").should("be.visible");
    });

    it("should display the thought process with markdown response", () => {
        cy.intercept("GET", "/api/chat-conversation/83fef006-4b6e-43df-a989-deebcd250cf2", {
            statusCode: 200,
            body: {
                id: "57884bb7-b799-4de1-b589-f55547aba662",
                messages: [
                    {
                        content: "what is the customer pulse segment?",
                        data_points: "",
                        role: "user",
                        thoughts: ""
                    },
                    {
                        content:
                            "#### Key Takeaway:  \n**33.3% of surveyed customers quit due to bad customer service**—a critical insight for marketers aiming to boost retention and brand loyalty.",
                        data_points: "",
                        role: "assistant",
                        thoughts: {
                            model_used: "gpt-4.1",
                            query_category: "General",
                            original_query: "What is the percent of customer quitting due to bad customer service?",
                            rewritten_query: "Percent of customers quitting due to bad customer service in the marketing and advertising industry",
                            mcp_tool_used: "data_analyst",
                            context_docs: [
                                "33.3% of surveyed customers quit due to bad customer service (including service issues, billing issues, or rigid delivery schedule). The pie chart above visualizes this breakdown.",
                                "Here is the graph/visualization link: organization_files/6c33b530-22f6-49ca-831b-25d587056237/generated_images/assistant-KVzD9fH7ghF7fJ3BV7jkTv.png"
                            ]
                        }
                    }
                ],
                start_date: "2025-07-08 00:40:09",
                type: "default"
            }
        }).as("getChatConversation");

        cy.get("button[aria-label='Chat History Button']").should("be.visible");
        cy.get("button[aria-label='Chat History Button']").click();

        cy.get("button[aria-label='Select conversation 83fef006-4b6e-43df-a989-deebcd250cf2']").should("be.visible");
        cy.get("button[aria-label='Select conversation 83fef006-4b6e-43df-a989-deebcd250cf2']").click();

        cy.get("button[aria-label='Show thought process']").should("be.visible");
        cy.get("button[aria-label='Show thought process']").click();

        cy.contains("Agent Type").should("be.visible");
        cy.contains("data_analyst").should("be.visible");

        cy.contains("Context Documents").should("be.visible");
        cy.contains("33.3% of surveyed customers quit due to bad customer service").should("be.visible");
    });
});
