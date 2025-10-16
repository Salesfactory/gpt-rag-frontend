import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Modals Test Suite", ()=> {
    beforeEach(() => {
        setupTestUserAndOrg()
        cy.visit("/")
    })

    it("Should verify the visibility of the Profile Modal", () => {
        cy.get("button[aria-label='Profile Card']").should("be.visible")
        cy.get("button[aria-label='Profile Card']").click()

        cy.get("button[aria-label='User profile Button']").should("be.visible")
        cy.get("button[aria-label='User profile Button']").click()

        cy.get("h2").contains("User Profile").should("be.visible")
        cy.get("label").contains("Email Address").should("be.visible")
        cy.get("label").contains("Username").should("be.visible")

        cy.get("button").contains("Save Changes").should("be.visible")
        cy.get("button").contains("Cancel").should("be.visible")
    })

    it("Should verify the functionality of the Profile Modal", () => {
        cy.intercept("PATCH", "/api/user/f048ece8-4730-40ca-b6e1-8db764717459", {
            statusCode: 200,
            body: {
                message: "User data updated successfully"
            }
        })

        cy.get("button[aria-label='Profile Card']").should("be.visible")
        cy.get("button[aria-label='Profile Card']").click()

        cy.get("button[aria-label='User profile Button']").should("be.visible")
        cy.get("button[aria-label='User profile Button']").click()

        cy.get("h2").contains("User Profile").should("be.visible")
        cy.get("label").contains("Email Address").should("be.visible")
        cy.get("label").contains("Username").should("be.visible")

        
        cy.get("input[aria-label='Username Input']").should("be.visible")
        cy.wait(30)
        cy.get("input[aria-label='Username Input']").type(" The Boss")

        cy.get("button").contains("Save Changes").should("be.visible")
        cy.get("button").contains("Save Changes").click()

    })

    it("should verify the visibility of the Organization Modal", () => {
        
        cy.get("button[aria-label='Profile Card']").should("be.visible")
        cy.get("button[aria-label='Profile Card']").click()

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
                subscriptionId: "sub_1QeeHXEpF6ccgZLwfCmANnOP",
            },
            {
                id: "1aad82ee-52ec-428e-b211-e9cc34b94457",
                name: "Open18",
                owner: "f048ece8-4730-40ca-b6e1-8db764717459",
                sessionId: "cs_test_a1DipoQd3hJrgmGaT1Im2AydoNrK0LJ5GNJKwa13AhsV9KU9Pq1SWYrvtE",
                subscriptionStatus: "active",
                subscriptionExpirationDate: 1736348460,
                subscriptionId: "sub_1QeeHXEpF6ccgZLwfCmANdhy",
            }
        ]
    }).as("getUserOrganizations2");

    cy.get("button[aria-label='Organization Button']").should("be.visible")
    cy.get("button[aria-label='Organization Button']").click()

    })
})