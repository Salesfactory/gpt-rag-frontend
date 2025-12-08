import { setupTestUserAndOrg } from "../fixtures/setupTestUser"
describe("Session Monitor Test Suite", () => {
  beforeEach(() => {
    setupTestUserAndOrg()
    cy.visit("/", {
        onBeforeLoad: (window) => {
            window.localStorage.setItem("finishedOnboarding", "true");
        }
    })
  })
    it("should detect session expiration and show modal", () => {
        // Simulate session expiration by manipulating the backend response
        cy.intercept("GET", "/api/auth/session/status", {
            statusCode: 401,
            body: { valid: false },
        }).as("checkSessionStatus")
        // Visit a protected page
        cy.wait(1000) // Wait for any initial requests

        cy.intercept("GET", "/api/settings", {
            statusCode: 401
        })

        cy.get("button[aria-label='Chat Settings']").click()

        cy.contains("Session Expired").should("be.visible")
        cy.contains("Your session has expired due to inactivity. To continue using the application, please refresh your session.").should("be.visible")

    }) 

})