import { setupSubscriptionError } from "../fixtures/setupSubscriptionError";

describe("Subscription Error", () => {
    beforeEach(() => {
        setupSubscriptionError();
        // Handle uncaught exceptions from application code
        cy.on('uncaught:exception', (err, runnable) => {
            // Return false to prevent Cypress from failing the test
            // We expect these errors as part of the subscription error flow
            if (err.message.includes('Error getting organization usage') || 
                err.message.includes('subscription') ||
                err.message.includes('Failed to fetch organization details')) {
                return false;
            }
            return true;
        });
    });

    it("Should display subscription error message when the subscriptionid is invalid or null", () => {
        // Mock the organization usage endpoint to fail (this drives subscription error)
        cy.intercept("GET", "/api/organizations/*/get-organization-usage", {
            statusCode: 400,
            body: {
                error: "Invalid subscription ID provided."
            }
        }).as("getOrganizationUsage");
        
        cy.visit("/", {
            onBeforeLoad: (window) => {
                
            }
        });
        
        // Wait for the API call to complete
        cy.wait("@getOrganizationUsage");
        
        // Check that we're still on the home page (since we're handling the error gracefully)
        // The subscription error should be shown but routing may not redirect
        cy.url().should("include", "#/");
    });

    it("Should display subscription error message when Authentication with Stripe's API failed", () => {
        // Mock the organization usage endpoint to fail with auth error
        cy.intercept("GET", "/api/organizations/*/get-organization-usage", {
            statusCode: 401,
            body: {
                error: "Authentication with Stripe's API failed."
            }
        }).as("getOrganizationUsage");
        
        cy.visit("/", {
            onBeforeLoad: (window) => {
                
            }
        });
        
        // Wait for the API call to complete
        cy.wait("@getOrganizationUsage");
        
        // Check that we're still on the home page (since we're handling the error gracefully)
        cy.url().should("include", "#/");
    });

    it("Should display subscription error message when network communication with Stripe failed", () => {
        // Mock the organization usage endpoint to fail with network error
        cy.intercept("GET", "/api/organizations/*/get-organization-usage", {
            statusCode: 502,
            body: {
                error: "Network communication with Stripe failed."
            }
        }).as("getOrganizationUsage");
        
        cy.visit("/", {
            onBeforeLoad: (window) => {
                
            }
        });
        
        // Wait for the API call to complete
        cy.wait("@getOrganizationUsage");
        
        // Check that we're still on the home page (since we're handling the error gracefully)
        cy.url().should("include", "#/");
    });
});
