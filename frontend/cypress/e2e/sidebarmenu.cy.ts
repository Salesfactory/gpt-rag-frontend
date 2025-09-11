import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Sidebar Menu Tests", () => {
    beforeEach(() => {
        setupTestUserAndOrg();
        cy.visit("/");
        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();
    });

    it("Should verify the sidebar menu contents", () => {
        cy.get("span").contains("Agent").should("be.visible");
        cy.get("span").contains("AI Chat").should("be.visible");
        cy.get("span").contains("Notifications").should("be.visible");
        cy.get("div").contains("Control Center").should("be.visible");
        cy.get("div").contains("Premium Features").should("be.visible");
        cy.get("div").contains("Reports").should("be.visible");
        cy.get("span").contains("Help Center").should("be.visible");

        // Verify the contents of the Control Center
        cy.get("div").contains("Control Center").click();
        cy.get("a[href='#/admin']").contains("Team Management").should("be.visible");
        cy.get("a[href='#/organization']").contains("Workspace Governance").should("be.visible");
        cy.get("a[href='#/knowledge-sources']").contains("Knowledge Sources").should("be.visible");
        cy.get("a[href='#/voice-customer']").contains("Voice of Customer").should("be.visible");
        cy.get("a[href='#/subscription-management']").contains("Subscription Plans").should("be.visible");

        // Verify the contents of the Premium Features
        cy.get("div").contains("Premium Features").click();
        cy.get("a[href='#/upload-resources']").contains("File Vault").should("be.visible");
        cy.get("a[href='#/request-studies']").contains("Request Studies").should("be.visible");

        // Verify the contents of the Reports section
        cy.get("div").contains("Reports").click();
        cy.get("a[href='#/view-reports']").contains("Reports Dashboard").should("be.visible");
        cy.get("a[href='#/view-manage-reports']").contains("Report Creation").should("be.visible");
        cy.get("a[href='#/details-settings']").contains("Sharing & Distribution").should("be.visible");
    });

    it("Should verify the behavior of the highlight", () => {

        // Normal element highlight
        cy.get("span").contains("Notifications").click();

        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();

        cy.get("a[href='#/notification-settings']").contains("Notifications").parent().should('have.css', 'background-color', 'rgb(1, 102, 48)');
        cy.get("span").contains("AI Chat").click();
        cy.get("a[href='#/']").contains("AI Chat").parent().should('have.css', 'background-color', 'rgb(1, 102, 48)');
        cy.get("button#headerCollapse").click();
        cy.get("a[href='#/notification-settings']").contains("Notifications").parent().should('have.css', 'background-color', 'rgba(0, 0, 0, 0)');

        // Subitem element highlight
        cy.get("div").contains("Control Center").click();
        cy.get("div").contains("Control Center").parent().should('have.css', 'background-color', 'rgb(1, 102, 48)');
        cy.get("a[href='#/admin']").contains("Team Management").should("be.visible").click();
        cy.get("a[href='#/admin']").contains("Team Management").parent().should('have.css', 'background-color', 'rgb(1, 102, 48)');
        cy.get("a[href='#/organization']").contains("Workspace Governance").should("be.visible").click();
        cy.get("a[href='#/organization']").contains("Workspace Governance").parent().should('have.css', 'background-color', 'rgb(1, 102, 48)');
        cy.get("a[href='#/admin']").contains("Team Management").parent().should('have.css', 'background-color', 'rgba(0, 0, 0, 0)');

        // Highlight hover
        cy.get("a[href='#/organization']").trigger('mouseover').parent().should('have.css', 'background-color', 'rgb(1, 102, 48)');
    });

});
