import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("File Vault Test Suite", () => {
    beforeEach(() => {
        setupTestUserAndOrg();
        cy.visit("/");
        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();
        cy.get("span").contains("Premium").click();
        cy.get('a[href="#/upload-resources"]').contains("File Vault").should("be.visible");
        cy.get('a[href="#/upload-resources"]').contains("File Vault").click();
    });

    it("Should verify the visibilty and functionality of the Main Page Chat", () => {
        cy.get("span").contains("File Vault").should("be.visible");
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

        cy.get("span").contains("File Vault").should("be.visible");
        cy.get("span").contains("Upload File").should("be.visible").click();

        cy.get("button").contains("Browse Files").should("be.visible");
        cy.get("input[aria-label='Dropzone']").selectFile("./cypress/files/Electric_Vehicle_Population_Data copy.xlsx", {force: true, action: "drag-drop"});

        cy.get("button").contains("Continue Anyway").should("be.visible")
        cy.get("button").contains("Continue Anyway").click()

        cy.contains("Error uploading files: Server responded with 500: Internal Server Error").should("be.visible");
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

        cy.get("span").contains("File Vault").should("be.visible");
        cy.get("span").contains("Upload File").should("be.visible").click();

        cy.get("button").contains("Browse Files").should("be.visible");
        cy.get("input[aria-label='Dropzone']").selectFile("./cypress/files/Electric_Vehicle_Population_Data copy.xlsx", {force: true, action: "drag-drop"});

        cy.get("button").contains("Continue Anyway").should("be.visible")
        cy.get("button").contains("Continue Anyway").click()

        cy.contains("Files uploaded successfully!").should("be.visible");
    });
});
