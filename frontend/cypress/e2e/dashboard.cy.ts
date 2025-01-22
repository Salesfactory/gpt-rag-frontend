describe("Agent Section Tests", () => {

    const WEB_APP_URL = "http://localhost:5173";


    beforeEach(() => {
        // Replace with the URL of your dashboard
        cy.intercept("GET", "/api/auth/user", {
            statusCode: 200,
            body: {
                authenticated: true,
                status: "success",
                user: {
                    email: "manuelcastro@hamalsolutions.com",
                    id: "f048ece8-4730-40ca-b6e1-8db764717459",
                    name: "Manuel Castro",
                    organizationId: "0aad82ee-52ec-428e-b211-e9cc34b94457",
                    role: "platformAdmin"
                }
            }
        }).as("getUser"); // Alias for later reference

        // Intercept the /api/get-organization-subscription API call with specific query parameter
        cy.intercept("GET", "/api/get-organization-subscription*", {
            statusCode: 200,
            body: {
                id: "0aad82ee-52ec-428e-b211-e9cc34b94457",
                name: "Manu dev",
                owner: "f048ece8-4730-40ca-b6e1-8db764717459",
                sessionId: "cs_test_a1DipoQd3hJrgmGaT1Im2AydoNrK0LJ5GNJKwa13AhsV9KU9Pq1SWYrvtE",
                subscriptionStatus: "active",
                subscriptionExpirationDate: 1736348460,
                _rid: "piUFANyBdv5AAAAAAAAAAA==",
                _self: "dbs/piUFAA==/colls/piUFANyBdv4=/docs/piUFANyBdv5AAAAAAAAAAA==/",
                _etag: '"3c01eb3b-0000-0100-0000-677d43240000"',
                _attachments: "attachments/",
                subscriptionId: "sub_1QeeHXEpF6ccgZLwfCmANnOP",
                _ts: 1736262436
            }
        }).as("getOrganizationSubscription");

        // Alias for later reference

        // Intercept the /api/subscriptions/sub_1QeeHXEpF6ccgZLwfCmANnOP/tiers API call
        cy.intercept("GET", "/api/subscriptions/sub_1QeeHXEpF6ccgZLwfCmANnOP/tiers", {
            statusCode: 200,
            body: {
                subscriptionData: {
                    current_period_end: 1738940483,
                    items: [
                        {
                            currency: "usd",
                            price_id: "price_1QFFxYEpF6ccgZLwkInisIKQ",
                            price_nickname: "Premium",
                            product_id: "prod_R05WPWPAgXt6Kj",
                            product_name: "AI Assistants",
                            quantity: 1,
                            unit_amount: 1200000
                        },
                        {
                            currency: "usd",
                            price_id: "price_1QG274EpF6ccgZLw5mfmGyAw",
                            price_nickname: null,
                            product_id: "prod_R8IiGUjCNUuE3c",
                            product_name: "Financial Assistant",
                            quantity: 1,
                            unit_amount: 100000
                        }
                    ],
                    status: "active"
                },
                subscriptionId: "sub_1QeeHXEpF6ccgZLwfCmANnOP",
                subscriptionTiers: ["Premium", "Financial Assistant", "Premium + Financial Assistant"]
            }
        }).as("getSubscriptionTiers"); // Alias for later reference

        // Intercept the /api/chat-history API call
        cy.intercept("GET", "/api/chat-history", {
            statusCode: 200,
            body: [
                {
                    id: "2d3afddf-8b77-4b53-a415-dcfff81bdb4d",
                    start_date: "2025-01-21 09:09:55",
                    content: "hello",
                    type: "default"
                },
                {
                    id: "04ec0c95-8d2d-451e-a192-94541dbd5496",
                    start_date: "2025-01-21 13:12:14",
                    content: "hello",
                    type: "default"
                }
            ]
        }).as("getChatHistory"); // Alias for later reference
        // Start from the web app that triggers the B2C sign-in
        cy.visit(WEB_APP_URL);
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
