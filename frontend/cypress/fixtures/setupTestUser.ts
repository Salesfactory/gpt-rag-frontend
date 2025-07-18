/// <reference types="cypress" />

export function setupTestUserAndOrg() {
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
    }).as("getUser");

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

    cy.intercept("GET", "/api/get-user-organizations", {
        statusCode: 200,
        body: [
            {
                id: "0aad82ee-52ec-428e-b211-e9cc34b94457",
                name: "Manu dev",
                owner: "f048ece8-4730-40ca-b6e1-8db764717459",
                sessionId: "cs_test_a1DipoQd3hJrgmGaT1Im2AydoNrK0LJ5GNJKwa13AhsV9KU9Pq1SWYrvtE",
                subscriptionStatus: "active",
                subscriptionExpirationDate: 1736348460,
                subscriptionId: "sub_1QeeHXEpF6ccgZLwfCmANnOP"
            }
        ]
    }).as("getUserOrganizations");

    cy.intercept("GET", "/api/get-users-organizations-role*", {
        statusCode: 200,
        body: { role: "admin" }
    });

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
    }).as("getSubscriptionTiers");

    cy.intercept("GET", "/api/chat-history", {
        statusCode: 200,
        body: [
            {
                id: "2d3afddf-8b77-4b53-a415-dcfff81bdb4d",
                start_date: "2025-01-21 09:09:55",
                content: "What is the customer pulse segment?",
                type: "default"
            },
            {
                id: "04ec0c95-8d2d-451e-a192-94541dbd5496",
                start_date: "2025-01-21 13:12:14",
                content: "how the customer pulse segment can help to sell a chopping cart?",
                type: "default"
            }
        ]
    }).as("getChatHistory");

    cy.intercept("GET", "/api/settings", {
        statusCode: 200,
        body: { font_family: "Arial", font_size: "16", model: "gpt-4.1", temperature: 0 }
    }).as("getSettings");

    cy.intercept("POST", "/api/settings", {
        statusCode: 200,
        body: {
            client_principal_id: "b808ad31-2df1-41f8-b077-6f0e28b84f46",
            client_principal_name: "Victor Maldonado",
            font_family: "Arial",
            font_size: "16",
            model: "Claude-4-Sonnet",
            temperature: 0
        }
    }).as("updateSettings");

    cy.intercept("GET", "/api/getusers*", {
        statusCode: 200,
        body: [
            {
                id: "1",
                data: { name: "Albert Wesker", email: "albertumbrella@example.com" },
                role: "admin"
            },
            {
                id: "2",
                data: { name: "Alyx Vance", email: "halflife3isreal@example.com" },
                role: "user"
            },
            {
                id: "3",
                user_new: true,
                nickname: "Carl Johnson",
                data: { email: "grovestreet4life@invited.com" },
                role: "platformAdmin",
                token_expiry: Math.floor(Date.now() / 1000) + 3600
            },
            {
                id: "4",
                user_new: true,
                nickname: "Geralt of Rivia",
                data: { email: "imawitcher@expired.com" },
                role: "user",
                token_expiry: Math.floor(Date.now() / 1000) - 3600
            }
        ]
    });
}
