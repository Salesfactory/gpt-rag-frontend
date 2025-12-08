import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("File Vault Test Suite", () => {
    beforeEach(() => {
        setupTestUserAndOrg();
        cy.visit("/", {
            onBeforeLoad: (window) => {
                window.localStorage.setItem("finishedOnboarding", "true");
            }
        });
        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();
        cy.get("span").contains("Premium").click();
        cy.get('a[href="#/upload-resources"]').contains("File Vault").should("be.visible");
        cy.get('a[href="#/upload-resources"]').contains("File Vault").click();
    });

    it("Should verify the visibilty and functionality of the Main Page Chat", () => {
        cy.get("span").contains("File Vault").should("be.visible");
        cy.get("#SearchBox10").should("be.visible");
        cy.get("span").contains("Upload File").should("be.visible");
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

    it("Should verify the file retrieval and download functionality", () => {
        // Mock the SAS URL generation endpoint
        cy.intercept("POST", "/api/generate-sas-url", {
            statusCode: 200,
            body: {
                sas_url: "https://example.com/download-file-sas-url"
            }
        }).as("generateSasUrl");

        // Verify that files are retrieved and displayed
        // "2025 Sample Test Data (Shopper Behavior) Walmart.xlsx" is in the mock data in setupTestUserAndOrg
        cy.contains("2025 Sample Test Data (Shopper Behavior) Walmart.xlsx").should("be.visible");
        
        // "Electric_Veh_Population_Data copy.xlsx" is also in the mock data
        cy.contains("Electric_Veh_Population_Data copy.xlsx").should("be.visible");

        // Stub window.open to verify download behavior
        cy.window().then((win) => {
            cy.stub(win, "open").as("windowOpen");
        });

        // Find the download button for the first file and click it
        // We look for the row containing the file name, then find the download button within it
        cy.contains("div", "2025 Sample Test Data (Shopper Behavior) Walmart.xlsx")
            .parents('div[draggable="true"]') // Navigate up to the file row container
            .find('button[title="Download"]')
            .click();

        // Verify the API call was made
        cy.wait("@generateSasUrl").its("request.body").should("include", {
            blob_name: "organization_files/22552b2f-1e98-4bc0-a252-a782d80201d5/2025 Sample Test Data (Shopper Behavior) Walmart.xlsx"
        });

        // Verify window.open was called with the SAS URL
        cy.get("@windowOpen").should("have.been.calledWith", "https://example.com/download-file-sas-url", "_blank");
    });
});
