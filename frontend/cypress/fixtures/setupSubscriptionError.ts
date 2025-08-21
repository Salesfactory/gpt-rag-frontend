/// <reference types="cypress" />

export function setupSubscriptionError() {
    cy.intercept("GET", "/api/auth/user", {
        statusCode: 200,
        body: {
            authenticated: true,
            status: "success",
            user: {
                email: "venomsnake@diamondogs.com",
                id: "dummyid",
                name: "John",
                organizationId: "dummyid",
                role: "platformAdmin"
            }
        }
    }).as("getUser");

    cy.intercept("GET", "/api/get-organization-subscription*", {
        statusCode: 200,
        body: {
            id: "dummyid",
            name: "Diamond Dogs",
            owner: "dummyid",
            sessionId: "cs_test_dummy",
            subscriptionStatus: "active",
            subscriptionExpirationDate: 1736348460,
            _rid: "piUFANyBdv5AAAAAAAAAAA==",
            _self: "dbs/piUFAA==/colls/piUFANyBdv4=/docs/piUFANyBdv5AAAAAAAAAAA==/",
            _etag: '"3c01eb3b-0000-0100-0000-677d43240000"',
            _attachments: "attachments/",
            subscriptionId: "sub_dummy",
            _ts: 1736262436
        }
    }).as("getOrganizationSubscription");

    cy.intercept("GET", "/api/get-user-organizations", {
        statusCode: 200,
        body: [
            {
                id: "dummyid",
                name: "Diamond Dogs",
                owner: "dummyid",
                sessionId: "cs_test_dummy",
                subscriptionStatus: "active",
                subscriptionExpirationDate: 1736348460,
                subscriptionId: "sub_dummy"
            }
        ]
    }).as("getUserOrganizations");

    cy.intercept("GET", "/api/get-users-organizations-role*", {
        statusCode: 200,
        body: { role: "admin" }
    });

  
}