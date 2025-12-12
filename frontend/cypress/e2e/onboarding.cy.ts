import { setupTestUserWithoutOrg } from "../fixtures/setupUserWithoutOrg";

describe("Onboarding Tests", () => {
    beforeEach(() => {
        setupTestUserWithoutOrg();
        cy.visit("/");
        cy.intercept('POST', '/api/create-organization', {
        statusCode: 201,
        body: {
            id: "org_123456",
            name: "Grove Street Families",
            owner: "David Martinez",
            created_at: "2025-07-15T12:00:00Z",
            status: "pending"
        }
        }).as('createOrganization');
        cy.intercept('POST', '/api/create-organization-usage', {
        statusCode: 201,
        body: {
            id: "usage_123456",
            organizationId: "org_123456",
            subscriptionTierId: "free"
        }
        }).as('createOrganizationUsage');
        // Mock Stripe API key endpoint
        cy.intercept('GET', '/api/stripe', {
        statusCode: 200,
        body: {
            functionKey: "pk_test_mock_stripe_key_123456789"
        }
        }).as('getStripeKey');
        // Mock product prices endpoint
        cy.intercept('GET', '/api/prices', {
        statusCode: 200,
        body: {
            prices: [
            {
                id: "price_basic",
                nickname: "Basic",
                unit_amount: 999,
                currency: "usd",
                metadata: {
                features: "Feature 1, Feature 2, Feature 3",
                FAQ: "Question 1?*Answer 1*Question 2?*Answer 2"
                }
            },
            {
                id: "price_premium",
                nickname: "Premium",
                unit_amount: 2999,
                currency: "usd",
                metadata: {
                features: "Feature 1, Feature 2, Feature 3, Feature 4",
                FAQ: "Question 1?*Answer 1*Question 2?*Answer 2"
                }
            },
            {
                id: "price_custom",
                nickname: "Custom",
                unit_amount: 4999,
                currency: "usd",
                metadata: {
                features: "All features, Custom support, Priority access",
                FAQ: "Question 1?*Answer 1*Question 2?*Answer 2"
                }
            }
            ]
        }
        }).as('getPrices');
        cy.url().should("include", "#/onboarding");
    });

    it("Should verify the onboarding popup content", () => {
        // First modal state
        cy.get("h1").contains("Welcome to Freddaid!").should("be.visible");
        cy.get("img[alt='Sales Factory logo']").should("be.visible");
        cy.get("p").contains("Let's set up your new organization so Freddaid can help grow your business.").should("be.visible");
        cy.get("button").contains("Cancel").should("be.visible");
        cy.get("button").contains("Next").should("be.visible");
        cy.get("button").contains("Next").click();

        // Second modal state
        cy.get("h2").contains("Organization Name").should("be.visible");
        cy.get("p").contains("How do you want to name your organization?").should("be.visible");
        cy.get("button").contains("Previous").should("be.visible");
        cy.get("button").contains("Next").should("be.visible");
        cy.get("input[placeholder='Organization Name']").should("be.visible").type("Grove Street Families");
        cy.get("input[value='Grove Street Families']").should("be.visible");
        cy.get("button").contains("Next").click();
        
        // Third modal state
        cy.get("h1").contains("Get a subscription").should("be.visible");
        cy.get("button").contains("Previous").should("be.visible");
        cy.get("button").contains("Subscribe Now!").should("be.visible").click();
        cy.url().should("include", "#/payment");

        cy.get("h1").contains("Subscription Plans").should("be.visible");
        cy.get("h2").contains("Basic").should("be.visible");
        cy.get("h2").contains("Custom").should("be.visible");
        cy.get("h2").contains("Premium").should("be.visible");
    });

    it("Should continue and return between modal states", () => {
        cy.get("button").contains("Next").click();
        cy.get("button").contains("Previous").click();
        cy.get("button").contains("Next").click();
        cy.get("input[placeholder='Organization Name']").type("Grove Street Families");
        cy.get("button").contains("Next").click();
        cy.get("button").contains("Previous").click();
        
    });
});