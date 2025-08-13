import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

const updatedData = {
    brandInformation: "Neo Umbrella Inc.",
    industryInformation: "Biotech and Security",
    additionalInstructions: "Focus on B.O.W. containment and antivirus research.",
    segmentSynonyms: "neo umbrella,umbrella new,biotech corp"
};

describe("Agent Section Tests", () => {
    beforeEach(() => {
        setupTestUserAndOrg();
        cy.intercept("PATCH", "/api/organization/*").as("updateOrg");
        cy.visit("/");
        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();
    });

    it('Should verify the visibility and functionality of the "Workspace Governance Page" link', () => {
        // open the workspace governance page
        cy.get("span").contains("Control Center").click();
        cy.get('a[href="#/organization"]').contains("Workspace Governance").should("be.visible");
        cy.get('a[href="#/organization"]').contains("Workspace Governance").click();
        cy.url().should("include", "#/organization");
        cy.get("button#headerCollapse").click();

        //Test for the organization information
        cy.get("span").should("contain.text", "Organization");
        cy.get("span").should("contain.text", "Manu dev");
        cy.get("span").should("contain.text", "0aad82ee-52ec-428e-b211-e9cc34b94457");
        cy.get("span").should("contain.text", "sub_1QeeHXEpF6ccgZLwfCmANnOP");
        cy.get("span").should("contain.text", "active");
        cy.get("span").should("contain.text", "f048ece8-4730-40ca-b6e1-8db764717459");
        cy.get("span").should("contain.text", "1/8/2025");

        // Edit Brand Description
        cy.get("span").should("contain.text", "Business Information");
        cy.contains("label", "Brand Description").parent().find("textarea").clear().type(updatedData.brandInformation);

        // Edit Business Description
        cy.contains("label", "Business Description").parent().find("textarea").clear().type(updatedData.industryInformation);

        // Edit Additional Instructions
        cy.contains("label", "Additional Instructions").parent().find("textarea").clear().type(updatedData.additionalInstructions);

        // Edit Segment Aliases
        cy.contains("label", "Segment Aliases").parent().find("textarea").clear().type(updatedData.segmentSynonyms);

        cy.get("button").contains("Save Changes").click();

        cy.wait("@updateOrg").then(interception => {
            console.log("PATCH response body:", interception.response?.body);
            cy.wrap(interception.response?.statusCode).should("equal", 200);
            cy.wrap(interception.request.body).should("deep.equal", updatedData);
        });
    });
});
