import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Upload Resources Test Suite", () => {
    beforeEach(() => {
        setupTestUserAndOrg();
        cy.visit("/");
        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();
        cy.get("span").contains("Premium").click();
        cy.get('a[href="#/upload-resources"]').contains("Upload Resources").should("be.visible");
        cy.get('a[href="#/upload-resources"]').contains("Upload Resources").click();
    });

    it("Should verify the visibilty and functionality of the Main Page Chat", () => {
        cy.get("span").contains("Upload Resources").should("be.visible");
        cy.get("#SearchBox5").should("be.visible");
        cy.get("span").contains("Upload File").should("be.visible");

        cy.get("span").contains("Files");
        cy.get("span").contains("Actions");
    });

    it("Should verify the functionality of the Upload File Button (500 Error Case)", () => {
        cy.intercept("POST", "/api/upload-source-document", {
            statusCode: 500,
            body: {}
        });

        cy.get("span").contains("Upload Resources").should("be.visible");
        cy.get("span").contains("Upload File").should("be.visible").click();

        cy.get("button").contains("Browse Files").should("be.visible");
        cy.get("input[aria-label='Dropzone']").selectFile("./cypress/files/Electric_Vehicle_Population_Data copy.xlsx", {force: true, action: "drag-drop"});

        cy.get("button").contains("Continue Anyway").should("be.visible")
        cy.get("button").contains("Continue Anyway").click()

        cy.contains("Error uploading Electric_Vehicle_Population_Data copy.xlsx. Try again later").should("be.visible");
    });

    it("Should verify the functionality of the Upload File Button (500 Error Case)", () => {
        cy.intercept("POST", "/api/upload-source-document", {
            statusCode: 200,
            body: {
                data: {
                    blob_url:
                        "test_url"
                },
                status: 200
            }
        });

        cy.get("span").contains("Upload Resources").should("be.visible");
        cy.get("span").contains("Upload File").should("be.visible").click();

        cy.get("button").contains("Browse Files").should("be.visible");
        cy.get("input[aria-label='Dropzone']").selectFile("./cypress/files/Electric_Vehicle_Population_Data copy.xlsx", {force: true, action: "drag-drop"});

        cy.get("button").contains("Continue Anyway").should("be.visible")
        cy.get("button").contains("Continue Anyway").click()

        cy.contains("Your files has been uploaded successfully!").should("be.visible");
    });
});
