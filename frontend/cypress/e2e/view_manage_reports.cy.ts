import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Subscription Page tests", () => {
    beforeEach(() => { 
        setupTestUserAndOrg();
        cy.visit("/");
        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();
        cy.get('span').contains("Reports").click();
        cy.get('a[href="#/view-manage-reports"]').contains("Report Creation").should("be.visible");
        cy.get('a[href="#/view-manage-reports"]').contains("Report Creation").click();
        cy.url().should("include", "#/view-manage-reports");
        cy.get("button#headerCollapse").click();
    })

    it("Should verify the visibility of the 'Report Creation' page", () => {
        cy.get('h3').contains("Curation Reports").should("be.visible");
        cy.get('h3').contains("Summarization Reports").should("be.visible");
        cy.get('h3').contains("Summarization Report Templates").should("be.visible");
    });

    it("Should verify the visibility and functionality of the Curation Reports section", () => {
        cy.intercept('GET', '/api/reports*', {
            statusCode: 200,
            body: [
                {
                    "category": "Ecommerce",
                    "createAt": "2025-02-16T21:06:58.350320+00:00",
                    "id": "id1",
                    "name": "Report about bread",
                    "status": "archived",
                    "type": "curation",
                    "updatedAt": "2025-02-16T21:06:58.351075+00:00"
                },
                {
                    "category": "Ecommerce",
                    "createAt": "2025-02-16T21:06:58.350320+00:00",
                    "id": "id2",
                    "name": "Report about cats",
                    "status": "active",
                    "type": "curation",
                    "updatedAt": "2025-02-16T21:06:58.351075+00:00"
                },
                {
                    "category": "Ecommerce",
                    "createAt": "2025-02-16T21:06:58.350320+00:00",
                    "id": "id3",
                    "name": "Report about moths",
                    "status": "active",
                    "type": "curation",
                    "updatedAt": "2025-02-16T21:06:58.351075+00:00"
                },
            ]
        }).as('getFilteredReports');
        cy.get('h3').contains("Curation Reports").click();
        cy.get('button[title="Add a New Report"]').should("be.visible");

        // Table content check
        cy.get('td').should('contain.text', 'Report about bread');
        cy.get('td').should('contain.text', 'Report about cats');
        cy.get('td').should('contain.text', 'Report about moths');
        cy.get('td').should('contain.text', 'Ecommerce');
        cy.get('div').should('contain.text', 'active');
        cy.get('div').should('contain.text', 'archived');

        // Test for the Delete Report Modal
        cy.get('button[title="Delete Report"]').should("be.visible");
        cy.get('button[title="Delete Report"]').first().click();
        cy.get('label').contains('Are you sure you want to delete "Report about bread"?').should("be.visible");
        cy.get('button[title="Cancel"]').should("be.visible");
        cy.get('button[title="Confirm"]').should("be.visible");
        cy.get('button[title="Cancel"]').click();


        // Test for the create new report button
        cy.get('button[title="Return to Report Management"]').should("be.visible");
        cy.get('button[title="Add a New Report"]').click();
        cy.get('button[title="Return to Curation Reports"]').should("be.visible");
        cy.url().should("include", "#/create-curation-report");

        cy.get('label').contains("Report Name").should("be.visible");
        cy.get('input[type="text"]').should("be.visible");
        cy.get('input[type="text"]').type("Test Report");
        cy.get('input[value="Test Report"]').should("be.visible");
        cy.get('button[title="Cancel"]').should("be.visible");
        cy.get('button[title="Cancel"]').click();
        cy.get('button[title="Confirm"]').should("be.visible");
        cy.get('input[value="Test Report"]').should("not.exist");
        cy.get('label').contains("Curation Report Category").should("be.visible");
        cy.get('span').contains("Select a Curation Report Category").should("be.visible");
        cy.get('span').contains("Select a Curation Report Category").click();
        cy.get('span').contains("Ecommerce").should("be.visible");
        cy.get('span').contains("Weekly Economic").should("be.visible");
        cy.get('span').contains("Monthly Economic").should("be.visible");
        cy.get('span').contains("Ecommerce").click({ force: true });
        cy.get('span').contains("Ecommerce").should("be.visible");
        cy.get('span').contains("Select a Curation Report Category").should("not.exist");
        cy.get('span').contains("All fields are required (*)").should("be.visible");
        cy.get('input[type="text"]').type("Test Report");
        cy.get('button[title="Confirm"]').click();
        cy.get('label').contains('Are you sure you want to create the report "Test Report" ?').should("be.visible");
        cy.get('button[title="Cancel"]').should("be.visible");

        cy.get('button[title="Return to Curation Reports"]').click();
    });

    it("Should verify the visibility and functionality of the Summarization Reports section", () => {
        cy.intercept('GET', '/api/reports*', {
            statusCode: 200,
            body: [
                {
                    "companyTickers": "TGT",
                    "createAt": "2024-12-23T22:09:06.685702Z",
                    "id": "2956ed3b-295b-401a-99d0-23f1464919eb",
                    "name": "TGT + 8-K",
                    "reportTemplate": "8-K",
                    "status": "archived",
                    "type": "companySummarization",
                    "updatedAt": "2024-12-23T22:09:06.685702Z"
                },
                {
                    "companyTickers": "HD",
                    "createAt": "2024-12-23T22:13:45.115144Z",
                    "id": "b604b3a7-0299-483d-9629-8451bafe7ce2",
                    "name": "HD + DEF 14A",
                    "reportTemplate": "DEF 14A",
                    "status": "active",
                    "type": "companySummarization",
                    "updatedAt": "2024-12-23T22:13:45.115144Z"
                },
            ]
        }).as('getFilteredReports');
        cy.get('h3').contains("Summarization Reports").click();
        cy.get('button[title="Create Summarization Report"]').should("be.visible");

        // Table content check
        cy.get('td').should('contain.text', 'TGT');
        cy.get('td').should('contain.text', 'HD');
        cy.get('td').should('contain.text', '8-K');
        cy.get('td').should('contain.text', 'DEF 14A');


        // Test for the Delete Report Modal
        cy.get('button[title="Delete Report"]').should("be.visible");
        cy.get('button[title="Delete Report"]').first().click();
        cy.get('label').contains('Are you sure you want to delete TGT + 8-K?').should("be.visible");
        cy.get('button[title="Cancel"]').should("be.visible");
        cy.get('button[title="Confirm"]').should("be.visible");
        cy.get('button[title="Cancel"]').click();

        // Test for the create new report button
        cy.get('button[title="Return to Report Management"]').should("be.visible");
        cy.get('button[title="Create Summarization Report"]').click();
        cy.get('button[title="Return to Summarization Reports"]').should("be.visible");
        cy.url().should("include", "#/create-summarization-report");

        cy.get('label').contains("Stock Ticker").should("be.visible");
        cy.get('input[type="text"]').should("be.visible");
        cy.get('input[type="text"]').type("TGT");
        cy.get('input[value="TGT"]').should("be.visible");
        cy.get('button[title="Cancel"]').should("be.visible");
        cy.get('button[title="Cancel"]').click();
        cy.get('button[title="Confirm"]').should("be.visible");
        cy.get('input[value="TGT"]').should("not.exist");
        cy.get('label').contains("Report Type").should("be.visible");
        cy.get('span').contains("Select a Summarization Report Type").should("be.visible");
        cy.get('span').contains("Select a Summarization Report Type").click();
        cy.get('span').contains("8-K").should("be.visible");
        cy.get('span').contains("DEF 14A").should("be.visible");
        cy.get('span').contains("8-K").click({ force: true });
        cy.get('span').contains("8-K").should("be.visible");
        cy.get('span').contains("Select a Summarization Report Type").should("not.exist");
        cy.get('span').contains("All fields are required (*)").should("be.visible");
        cy.get('input[type="text"]').type("TGT");
        cy.get('button[title="Confirm"]').click();
        cy.get('label').contains('Are you sure you want to create the report "TGT + 8-K" ?').should("be.visible");
        cy.get('button[title="Cancel"]').should("be.visible");
        cy.get('button[title="Return to Summarization Reports"]').click();
    });

    it("Should verify the visibility and functionality of the Summarization Report Templates section", () => {
        cy.intercept('GET', '/api/reports/summarization/templates*', {
            statusCode: 200,
            body: [
                {
                    "createdAt": "2024-12-23T22:09:06.685702Z",
                    "companyName": "Umbrella Corporation",
                    "id": "template1",
                    "companyTicker": "8-K Template",
                    "templateType": "summarization",
                    "status": "active",
                },
                {
                    "createAt": "2024-12-23T22:13:45.115144Z",
                    "companyName": "Umbrella Corporation",
                    "id": "template1",
                    "companyTicker": "8-K Template",
                    "templateType": "summarization",
                    "status": "active",
                },
            ]
        }).as('getSummarizationTemplates');
        cy.intercept('GET', '/api/companydata*', {
            statusCode: 200,
            body: [
                {
                    data: "Target Corporation",
                },     
            ]
        }).as('getCompanyData');


        cy.get('h3').contains("Summarization Report Templates").click();
        cy.get('button[title="Add a New Report"]').should("be.visible");
        cy.url().should("include", "#/report-templates");

        // Test for the create new template button
        cy.get('button[title="Return to Report Management"]').should("be.visible");
        cy.get('button[title="Add a New Report"]').click();
        cy.get('button[title="Return to Report Templates"]').should("be.visible");
        cy.url().should("include", "#/create-template-report");

        cy.get('label').contains("Template type").should("be.visible");
        cy.get('span').contains("Select a Template Name").should("be.visible");
        cy.get('span').contains("Select a Template Name").click();
        cy.get('span').contains("8-K").should("be.visible");
        cy.get('span').contains("DEF 14A").should("be.visible");
        cy.get('span').contains("8-K").click({ force: true });
        cy.get('span').contains("8-K").should("be.visible");
        cy.get('span').contains("Select a Template Name").should("not.exist");
        cy.get('input[type="text"]').should("be.visible");
        cy.get('input[type="text"]').type("New Template");
        cy.get('input[value="New Template"]').should("be.visible");
        cy.get('button[title="Cancel"]').should("be.visible");
        cy.get('button[title="Cancel"]').click();
        cy.get('span').contains("All fields are required (*)").should("be.visible");
        cy.get('input[type="text"]').type("New Template");
    });
});