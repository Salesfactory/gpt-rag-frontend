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

    cy.intercept("GET", "/api/auth/session/status", {
            statusCode: 200,
            body: { valid: true },
        }).as("checkSessionStatus")

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

    cy.intercept("GET", "/api/auth/session/status", {
        statusCode: 200,
        body: {
            session: {
                status: "active"
            }
        }
    }).as("getSessionStatus");

    cy.intercept("POST", "/api/user-organization-logs", {
        statusCode: 204,
        body: {}
    }).as("createOrgLog");

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
                        }
                    ],
                    status: "active"
                },
                subscriptionId: "sub_1QeeHXEpF6ccgZLwfCmANnOP",
            subscriptionTiers: ["Premium"]
        }
    }).as("getSubscriptionTiers");

    cy.intercept("GET", "/api/chat-history", {
        statusCode: 200,
        body: [
            {
                id: "2d3afddf-8b77-4b53-a415-dcfff81bdb4d",
                start_date: "2025-01-21 09:09:55",
                content: "What is the customer pulse segment?",
                organization_id: "0aad82ee-52ec-428e-b211-e9cc34b94457",
                type: "default"
            },
            {
                id: "04ec0c95-8d2d-451e-a192-94541dbd5496",
                start_date: "2025-01-21 13:12:14",
                organization_id: "0aad82ee-52ec-428e-b211-e9cc34b94457",
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

    cy.intercept("GET", "/api/settings*", {
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
            model: "Claude-4.5-Sonnet",
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

    cy.intercept("GET", "/api/categories?organization_id=0aad82ee-52ec-428e-b211-e9cc34b94457*", {
        statusCode: 200,
        body: [
            {
                id: "a22515a1-0f54-482a-93cb-d2b6edd7c335",
                organization_id: "0aad82ee-52ec-428e-b211-e9cc34b94457",
                name: "Player",
                created_at: "2025-09-02T18:00:00+00:00",
                updated_at: "2025-09-02T18:00:00+00:00"
            },
            {
                id: "912515a1-0f54-482a-93cb-d2b6edd7b224",
                organization_id: "0aad82ee-52ec-428e-b211-e9cc34b94457",
                name: "smartphones",
                created_at: "2025-09-02T17:46:41.359841+00:00",
                updated_at: "2025-09-02T17:46:41.359841+00:00"
            }
        ]
    }).as("getCategories");

    cy.intercept("GET", "/api/voice-customer/organizations/0aad82ee-52ec-428e-b211-e9cc34b94457/brands", {
        statusCode: 200,
        body: {
            data: [
                {
                    id: "a0dc8c96-0fc8-4549-8d34-328ada5aa64b",
                    name: "Real Madrid",
                    description: "Best Team of the world"
                }
            ],
            status: 200
        }
    });

    cy.intercept("GET", "/api/voice-customer/organizations/0aad82ee-52ec-428e-b211-e9cc34b94457/products", {
        statusCode: 200,
        body: {
            data: [
                {
                    id: "9ded4b25-e177-486c-af51-9bb600440b0a",
                    name: "Kylian Mbappe",
                    category: "Player"
                }
            ],
            status: 200
        }
    });

    cy.intercept("GET", "/api/voice-customer/organizations/0aad82ee-52ec-428e-b211-e9cc34b94457/competitors", {
        statusCode: 200,
        body: {
            data: [
                {
                    id: "e2291c49-d922-46ec-b791-9d677c82eed9",
                    name: "FC Barcelona",
                    industry: "Football"
                }
            ],
            status: 200
        }
    });

    cy.intercept("GET", /\/api\/report-jobs.*/, {
        statusCode: 200,
        body: []
    }).as("getReportJobs");

    cy.intercept("GET", "/api/organizations/*/get-organization-usage", {
        statusCode: 200,
        body: {
            data: {
                id: "usage-123",
                organizationId: "0aad82ee-52ec-428e-b211-e9cc34b94457",
                subscriptionId: "sub_1QeeHXEpF6ccgZLwfCmANnOP",
                isSubscriptionActive: true,
                type: "organization_usage",
                balance: {
                    totalAllocated: 1000,
                    currentUsed: 100
                },
                policy: {
                    tierId: "price_1Qf5FCEpF6ccgZLw4DTmrYHQ",
                    currentSeats: 5,
                    allowedUserIds: [],
                    isSubscriptionActive: true
                }
            }
        }
    }).as("getOrganizationUsage");

    cy.intercept("GET", "/api/subscriptions-tiers/*", {
        statusCode: 200,
        body: {
            "id": "price_1Qf5FCEpF6ccgZLw4DTmrYHQ",
            "tier_id": "tier_basic",
            "tier_name": "Basic Tier",
            "cost": 500,
            "quotas": {
                "totalCreditsAllocated": 1000,
                "totalStorageAllocated": 1000
            },
            "policy": {
                "allowOverdraft": false,
                "maxSeats": 5
            }
        }
    }).as("getSubscriptionTierDetails");

    cy.intercept("POST", "/api/voice-customer/brands", {
        statusCode: 201,
        body: {
            _attachments: "attachments/",
            _etag: '"61027b6d-0000-0100-0000-68839e700001"',
            _rid: "piUFAJPb450ZAAAAAAAAAB==",
            _self: "dbs/piUFAA==/colls/piUFAJPb450=/docs/piUFAJPb450ZAAAAAAAAAB==/",
            _ts: 1753456241,
            createdAt: "2025-07-25T15:10:40.576086+00:00",
            description: "A top level football club",
            id: "b1dc8c96-0fc8-4549-8d34-328ada5aa64c",
            name: "Chelsea FC",
            organizationId: "22552b2f-1e98-4bc0-a252-a782d80201d5",
            updatedAt: "2025-07-25T15:10:40.576124+00:00"
        }
    }).as("addBrand");

    cy.intercept("POST", "/api/voice-customer/products", {
        statusCode: 201,
        body: {
            _attachments: "attachments/",
            _etag: '"19004a4c-0000-0100-0000-68839ea40001"',
            _rid: "piUFAMwF0lwRAAAAAAAAAA==",
            _self: "dbs/piUFAA==/colls/piUFAMwF0lw=/docs/piUFAMwF0lwRAAAAAAAAAA==/",
            _ts: 1753456292,
            brandId: "a0dc8c96-0fc8-4549-8d34-328ada5aa64b",
            category: "Player",
            createdAt: "2025-07-25T15:11:31.903402+00:00",
            description: "A top level football player",
            id: "9ded4b25-e177-486c-af51-9bb600440b0a",
            name: "Lionel Messi",
            organizationId: "22552b2f-1e98-4bc0-a252-a782d80201d5",
            updatedAt: "2025-07-25T15:11:31.903421+00:00"
        }
    }).as("addProduct");

    cy.intercept("POST", "/api/voice-customer/competitors", {
        statusCode: 201,
        body: {
            data: {
                _attachments: "attachments/",
                _etag: '"cf06fafc-0000-0100-0000-6883ab480000"',
                _rid: "piUFAIdpn7QXAAAAAAAAAA==",
                _self: "dbs/piUFAA==/colls/piUFAIdpn7Q=/docs/piUFAIdpn7QXAAAAAAAAAA==/",
                _ts: 1753459528,
                createdAt: "2025-07-25T16:05:28.311778+00:00",
                description: "A top level football club",
                id: "acc26e1b-4c87-4b92-b845-e906814d345a",
                industry: "Football Club",
                name: "Liverpool",
                organization_id: "22552b2f-1e98-4bc0-a252-a782d80201d5",
                updatedAt: "2025-07-25T16:05:28.311808+00:00"
            },
            status: 201
        }
    });

    cy.intercept("GET", "/api/voice-customer/organizations/0aad82ee-52ec-428e-b211-e9cc34b94457/industry", {
        statusCode: 200,
        body: {
            data: {
                industry_description: "The automotive industry comprises a wide range of companies and organizations involved in the design, development, manufacturing, marketing, and selling of motor vehicles."
            },
            status: 200
        }
    }).as("getIndustryByOrganization");

    cy.intercept("GET", "/api/get-source-documents*", {
        statusCode: 203,
        body: {
            data: {
                files: [
                {
                    content_type: "application/octet-stream",
                    created_on: "2025-08-14T02:08:57+00:00",
                    last_modified: "2025-08-14T02:08:57+00:00",
                    metadata: {
                        description:
                            "This dataset (1054 rows  16 columns) contains monthly sales records for Henkel products, including department, product descriptions, categories, brands, order channels, and sales metrics, intended for sales performance analysis and business decision-making. The most common Henkel category is 'Construction Adhesives', and the majority of sales occur via the 'Store' channel; notably, there are 127 records with negative sales amounts. Key columns: OMNI_DEPT_NBR, OMNI_DEPT_DESC, UPC_LONG_DESC, Henkel category, Henkel brand, Order Channel, WM Full Yr Nbr, WM Mth Nm, Sales Amt, Sales Unit Qty.",
                        organization_id: "22552b2f-1e98-4bc0-a252-a782d80201d5"
                    },
                    name: "organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/2025 Sample Test Data (Shopper Behavior) Walmart.xlsx",
                    size: 1444248,
                    url: "https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/2025 Sample Test Data (Shopper Behavior) Walmart.xlsx"
                },
                {
                    content_type: "application/octet-stream",
                    created_on: "2025-08-12T00:07:06+00:00",
                    last_modified: "2025-08-12T00:07:06+00:00",
                    metadata: {
                        description:
                            "The dataset contains 24 rows and 2 columns, with columns: DATABOOK NAVIGATION, Unnamed: 1. It appears to include navigation or section headers for a databook, likely intended to organize topics such as Demographics, AI in Online Shopping, and Summer Home Improvement for further analysis. Notably, the most frequently listed category is 'N', indicating a focus on that topic.",
                        organization_id: "22552b2f-1e98-4bc0-a252-a782d80201d5"
                    },
                    name: "organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/Copy of Pulse 147 Databook.xlsx",
                    size: 382836,
                    url: "https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/Copy of Pulse 147 Databook.xlsx"
                },
                {
                    content_type: "application/octet-stream",
                    created_on: "2025-08-12T00:15:36+00:00",
                    last_modified: "2025-08-12T00:17:49+00:00",
                    metadata: {
                        description:
                            "This dataset contains 28 rows and 17 columns of electric vehicle registration details, with key fields such as VIN (1-10), County, City, State, Model Year, Make, Model, Electric Vehicle Type, Clean Alternative Fuel Vehicle (CAFV) Eligibility, Electric Range. Most vehicles are 'Battery Electric Vehicle (BEV)', with 'TESLA' as a frequent make and 'Kitsap' county commonly represented.",
                        organization_id: "22552b2f-1e98-4bc0-a252-a782d80201d5"
                    },
                    name: "organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/Electric_Veh_Population_Data copy.xlsx",
                    size: 9685,
                    url: "https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/Electric_Vehicle_Population_Data copy.xlsx"
                },
                {
                    content_type: "application/octet-stream",
                    created_on: "2025-08-12T00:08:06+00:00",
                    last_modified: "2025-08-13T19:34:36+00:00",
                    metadata: {
                        description:
                            "This dataset contains 20528 rows and 28 columns of customer review sentences for various products, including sentiment scores, product details, and review metadata; it is intended for analyzing consumer feedback and sentiment trends. Notable patterns include frequent 'Positive' sentiment labels and recurring themes such as 'Fans / Attractors: Customer Satisfaction', with key columns being Sentence, Sentence Sentiment, Sentence Sentiment Label, Review & Rating ID, Date, Rating, Product, Brand, Category, Review Body.",
                        organization_id: "22552b2f-1e98-4bc0-a252-a782d80201d5"
                    },
                    name: "organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/Loctite-GE-OSI 24 month construction adhesive rating & reviews_20250730 JH.xlsx",
                    size: 2382475,
                    url: "https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/Loctite-GE-OSI 24 month construction adhesive rating & reviews_20250730 JH.xlsx"
                },
                {
                    content_type: "application/pdf",
                    created_on: "2025-08-13T17:00:26+00:00",
                    last_modified: "2025-08-13T19:14:54+00:00",
                    metadata: {
                        organization_id: "22552b2f-1e98-4bc0-a252-a782d80201d5"
                    },
                    name: "organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/REPORT1.pdf",
                    size: 58406,
                    url: "https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/REPORT1.pdf"
                },
                {
                    content_type: "application/pdf",
                    created_on: "2025-08-13T17:00:31+00:00",
                    last_modified: "2025-08-13T18:04:43+00:00",
                    metadata: {
                        organization_id: "22552b2f-1e98-4bc0-a252-a782d80201d5"
                    },
                    name: "organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/WfuUsersChats.pdf",
                    size: 266392,
                    url: "https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/WfuUsersChats.pdf"
                },
                {
                    content_type: "application/octet-stream",
                    created_on: "2025-08-12T00:29:30+00:00",
                    last_modified: "2025-08-12T00:29:30+00:00",
                    metadata: {
                        description:
                            "This dataset (10 rows x 14 columns) records time tracking details for Sales Factory AI's Fredd AI project, including the following columns: Date, Client, Project, Project Code, Task, Notes, Hours, Billable?, Invoiced?, Approved?, First Name, Last Name, Employee?, External Reference URL. Most entries are for programming tasks by Victor, with all hours marked as billable but not yet invoiced or approved.",
                        organization_id: "22552b2f-1e98-4bc0-a252-a782d80201d5"
                    },
                    name: "organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/harvest_time_report_from2025-08-01to2025-08-31.csv",
                    size: 2328,
                    url: "https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/harvest_time_report_from2025-08-01to2025-08-31.csv"
                },
                {
                    content_type: "application/pdf",
                    created_on: "2025-08-05T17:28:29+00:00",
                    last_modified: "2025-08-05T17:28:29+00:00",
                    metadata: {
                        organization_id: "22552b2f-1e98-4bc0-a252-a782d80201d5"
                    },
                    name: "organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/linearalgebraanditsapplications.pdf",
                    size: 13633681,
                    url: "https://strag0vm2b2htvuuclm.blob.core.windows.net/documents/organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/linearalgebraanditsapplications.pdf"
                }
            ],
            folders: [],
            current_path: ""
            },
            status: 200
        }
    });
}
