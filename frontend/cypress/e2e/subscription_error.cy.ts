import { setupSubscriptionError } from "../fixtures/setupSubscriptionError";

describe("Subscription Error", () => {
    beforeEach(() => {
        setupSubscriptionError();
    });

    it("Should display subscription error message when the subscriptionid is invalid or null", () => {
        cy.intercept("GET", "/api/subscriptions/sub_dummy/tiers", {
        statusCode: 400,
        body: {
            error: "Invalid subscription ID provided."
        }
        });
        cy.visit("/");
        cy.url().should("include", "#/subscription-error");
        cy.contains("Subscription Error");
        cy.contains("Please contact Technical Support to resolve this issue.");
        cy.contains("Invalid subscription ID provided.");
    });

    it("Should display subscription error message when Authentication with Stripe's API failed", () => {
        cy.intercept("GET", "/api/subscriptions/sub_dummy/tiers", {
        statusCode: 401,
        body: {
            error: "Authentication with Stripe's API failed."
        }
        });
        cy.visit("/");
        cy.url().should("include", "#/subscription-error");
        cy.contains("Subscription Error");
        cy.contains("Please contact Technical Support to resolve this issue.");
        cy.contains("Authentication with Stripe's API failed.");
    });

    it("Should display subscription error message when Authentication with Stripe's API failed", () => {
        cy.intercept("GET", "/api/subscriptions/sub_dummy/tiers", {
        statusCode: 502,
        body: {
            error: "Network communication with Stripe failed."
        }
        });
        cy.visit("/");
        cy.url().should("include", "#/subscription-error");
        cy.contains("Subscription Error");
        cy.contains("Please contact Technical Support to resolve this issue.");
        cy.contains("Network communication with Stripe failed.");
    });
});
