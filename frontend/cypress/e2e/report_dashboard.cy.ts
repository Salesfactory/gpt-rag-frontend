/// <reference types="cypress" />
import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe('Reports Dashboard Page', () => {
    const mockReports = [
        {
            name: 'Reports/Curation_Reports/TypeA/Report1.pdf',
            created_on: '2024-06-01T12:00:00Z',
            url: 'https://example.com/report1.pdf',
            status: 'Completed'
        },
        {
            name: 'Reports/Curation_Reports/TypeB/Report2.pdf',
            created_on: '2024-06-02T12:00:00Z',
            url: 'https://example.com/report2.pdf',
            status: 'Pending'
        }
    ];

    beforeEach(() => {
        setupTestUserAndOrg();

        cy.intercept(
            'GET',
            /\/api\/reports\/storage\/files.*/,
            {
                statusCode: 200,
                body: {
                    status: "success",
                    data: mockReports,
                    count: mockReports.length
                }
            }
        ).as('getReports');
        cy.visit("/");
        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();
    });

    it('shows loading state and then displays reports table', () => {

        cy.get('span').contains("Reports").click();
        cy.get('a[href="#/view-reports"]').contains("Reports Dashboard").should("be.visible");
        cy.get('a[href="#/view-reports"]').contains("Reports Dashboard").click();

        cy.url().should("include", "#/view-reports");

        cy.wait('@getReports');
        cy.get('table').should('exist');
        cy.contains('Report ID');
        cy.contains('Title');
        cy.contains('Type');
        cy.contains('Creation Date');
        cy.contains('Status');
        cy.contains('Actions');
        cy.contains('Report1');
        cy.contains('Report2');
    });

    it('shows empty state when no reports', () => {
        cy.intercept(
            'GET',
            /\/api\/reports\/storage\/files.*/,
            {
                statusCode: 200,
                body: {
                    status: "success",
                    data: [],
                    count: 0
                }
            }
        ).as('getReportsEmpty');

        cy.get('span').contains("Reports").click();
        cy.get('a[href="#/view-reports"]').contains("Reports Dashboard").click();
        cy.wait('@getReportsEmpty');
        cy.contains('No reports found.');
    });

});