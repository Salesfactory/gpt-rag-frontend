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
                organization_id: '0aad82ee-52ec-428e-b211-e9cc34b94457',
                type: "default"
            },
            {
                id: "04ec0c95-8d2d-451e-a192-94541dbd5496",
                start_date: "2025-01-21 13:12:14",
                organization_id: '0aad82ee-52ec-428e-b211-e9cc34b94457',
                content: "how the customer pulse segment can help to sell a chopping cart?",
                type: "default"
            },
            {
                id: "6e77f115-6df9-40b4-a321-a0a7c700938b",
                start_date: "2025-01-21 15:15:00",
                organization_id: '0aad82ee-52ec-428e-b211-e9cc34b94457',
                content: "What is the customer pulse segmentation?",
                type: "default"
            },
            {
                id: "83fef006-4b6e-43df-a989-deebcd250cf2",
                start_date: "2025-01-21 15:15:00",
                organization_id: '0aad82ee-52ec-428e-b211-e9cc34b94457',
                content: "What is the percent of customer quitting due to bad customer service? please generate a graph to visualize the result",
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

    cy.intercept("GET", "/api/voice-customer/organizations/0aad82ee-52ec-428e-b211-e9cc34b94457/brands", {
        statusCode: 200,
        body: {
            "data": [
                {
                    "_attachments": "attachments/",
                    "_etag": "\"61027b6d-0000-0100-0000-68839e700000\"",
                    "_rid": "piUFAJPb450ZAAAAAAAAAA==",
                    "_self": "dbs/piUFAA==/colls/piUFAJPb450=/docs/piUFAJPb450ZAAAAAAAAAA==/",
                    "_ts": 1753456240,
                    "createdAt": "2025-07-25T15:10:39.576086+00:00",
                    "description": "Best Team of the world",
                    "id": "a0dc8c96-0fc8-4549-8d34-328ada5aa64b",
                    "name": "Real Madrid",
                    "organizationId": "22552b2f-1e98-4bc0-a252-a782d80201d5",
                    "updatedAt": "2025-07-25T15:10:39.576124+00:00"
                }
            ],
            "status": 200
        }
    })

    cy.intercept("GET", "/api/voice-customer/organizations/0aad82ee-52ec-428e-b211-e9cc34b94457/products", {
        statusCode: 200,
        body: {
            "data": [
                {
                    "_attachments": "attachments/",
                    "_etag": "\"19004a4c-0000-0100-0000-68839ea40000\"",
                    "_rid": "piUFAMwF0lwRAAAAAAAAAA==",
                    "_self": "dbs/piUFAA==/colls/piUFAMwF0lw=/docs/piUFAMwF0lwRAAAAAAAAAA==/",
                    "_ts": 1753456292,
                    "brandId": "a0dc8c96-0fc8-4549-8d34-328ada5aa64b",
                    "category": "Player",
                    "createdAt": "2025-07-25T15:11:31.903402+00:00",
                    "description": "A mid level player",
                    "id": "9ded4b25-e177-486c-af51-9bb600440b0a",
                    "name": "Kylian Mbappe",
                    "organizationId": "22552b2f-1e98-4bc0-a252-a782d80201d5",
                    "updatedAt": "2025-07-25T15:11:31.903421+00:00"
                }
            ],
            "status": 200
        }
    })

    cy.intercept("GET", "/api/voice-customer/organizations/0aad82ee-52ec-428e-b211-e9cc34b94457/competitors", {
        statusCode: 200,
        body: {
            "data": [
                {
                    "_attachments": "attachments/",
                    "_etag": "\"ca06a92d-0000-0100-0000-68839ecd0000\"",
                    "_rid": "piUFAIdpn7QWAAAAAAAAAA==",
                    "_self": "dbs/piUFAA==/colls/piUFAIdpn7Q=/docs/piUFAIdpn7QWAAAAAAAAAA==/",
                    "_ts": 1753456333,
                    "brands": [
                        {
                            "_attachments": "attachments/",
                            "_etag": "\"a6037715-0000-0100-0000-68839ece0000\"",
                            "_rid": "piUFAILPYeciAAAAAAAAAA==",
                            "_self": "dbs/piUFAA==/colls/piUFAILPYec=/docs/piUFAILPYeciAAAAAAAAAA==/",
                            "_ts": 1753456334,
                            "brand_id": "a0dc8c96-0fc8-4549-8d34-328ada5aa64b",
                            "competitor_id": "e2291c49-d922-46ec-b791-9d677c82eed9",
                            "id": "80488059-89c1-43df-a989-806e6ac1e2d7"
                        }
                    ],
                    "createdAt": "2025-07-25T15:12:12.666829+00:00",
                    "description": "A mid level football club",
                    "id": "e2291c49-d922-46ec-b791-9d677c82eed9",
                    "industry": "Football",
                    "name": "FC Barcelona",
                    "organization_id": "22552b2f-1e98-4bc0-a252-a782d80201d5",
                    "updatedAt": "2025-07-25T15:12:12.666857+00:00"
                }
            ],
            "status": 200
        }


    })

    cy.intercept("POST", "/api/voice-customer/brands", {
        statusCode: 201,
        body: {
            "_attachments": "attachments/",
            "_etag": "\"61027b6d-0000-0100-0000-68839e700001\"",
            "_rid": "piUFAJPb450ZAAAAAAAAAB==",
            "_self": "dbs/piUFAA==/colls/piUFAJPb450=/docs/piUFAJPb450ZAAAAAAAAAB==/",
            "_ts": 1753456241,
            "createdAt": "2025-07-25T15:10:40.576086+00:00",
            "description": "A top level football club",
            "id": "b1dc8c96-0fc8-4549-8d34-328ada5aa64c",
            "name": "Chelsea FC",
            "organizationId": "22552b2f-1e98-4bc0-a252-a782d80201d5",
            "updatedAt": "2025-07-25T15:10:40.576124+00:00"
        }
    }).as("addBrand");

    cy.intercept("POST", "/api/voice-customer/products", {
        statusCode: 201,
        body: {
            "_attachments": "attachments/",
            "_etag": "\"19004a4c-0000-0100-0000-68839ea40001\"",
            "_rid": "piUFAMwF0lwRAAAAAAAAAA==",
            "_self": "dbs/piUFAA==/colls/piUFAMwF0lw=/docs/piUFAMwF0lwRAAAAAAAAAA==/",
            "_ts": 1753456292,
            "brandId": "a0dc8c96-0fc8-4549-8d34-328ada5aa64b",
            "category": "Player",
            "createdAt": "2025-07-25T15:11:31.903402+00:00",
            "description": "A top level football player",
            "id": "9ded4b25-e177-486c-af51-9bb600440b0a",
            "name": "Lionel Messi",
            "organizationId": "22552b2f-1e98-4bc0-a252-a782d80201d5",
            "updatedAt": "2025-07-25T15:11:31.903421+00:00"
        }
    }).as("addProduct");

    cy.intercept("POST", "/api/voice-customer/competitors", {
        statusCode: 201,
        body: {
            "data": {
                "_attachments": "attachments/",
                "_etag": "\"cf06fafc-0000-0100-0000-6883ab480000\"",
                "_rid": "piUFAIdpn7QXAAAAAAAAAA==",
                "_self": "dbs/piUFAA==/colls/piUFAIdpn7Q=/docs/piUFAIdpn7QXAAAAAAAAAA==/",
                "_ts": 1753459528,
                "createdAt": "2025-07-25T16:05:28.311778+00:00",
                "description": "A top level football club",
                "id": "acc26e1b-4c87-4b92-b845-e906814d345a",
                "industry": "Football Club",
                "name": "Liverpool",
                "organization_id": "22552b2f-1e98-4bc0-a252-a782d80201d5",
                "updatedAt": "2025-07-25T16:05:28.311808+00:00"
            },
            "status": 201
        }

    })
}
