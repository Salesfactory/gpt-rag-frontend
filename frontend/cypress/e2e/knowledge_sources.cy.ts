import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Knowledge Sources tests", () => {
    beforeEach(() => {
        setupTestUserAndOrg();
        cy.intercept('GET', '/api/webscraping/get-urls*', {
            statusCode: 200,
            body: {
                data: [
                {
                    "addedBy": {
                    "dateAdded": "2025-07-09T14:56:40.373863+00:00",
                    "userId": "dummy-user-id-123",
                    "userName": "Ethan Winters"
                    },
                    "blobPath": "DummyPath.txt",
                    "contentLength": 50422,
                    "dateAdded": "2025-07-09T14:56:40.373834+00:00",
                    "error": null,
                    "id": "dummy-url-id-1",
                    "lastModified": "2025-07-09T14:56:40.373854+00:00",
                    "organizationId": "dummy-org-id-123",
                    "result": "Success",
                    "status": "Active",
                    "title": "Village of Shadows news",
                    "url": "https://www.google.com/"
                },
                {
                    "addedBy": {
                    "dateAdded": "2025-07-09T14:56:40.373863+00:00",
                    "userId": "dummy-user-id-23",
                    "userName": "Jonathan Joestar"
                    },
                    "blobPath": "DummyPath.txt",
                    "contentLength": 50422,
                    "dateAdded": "2025-07-09T14:56:40.373834+00:00",
                    "error": null,
                    "id": "dummy-url-id-2",
                    "lastModified": "2025-07-09T14:56:40.373854+00:00",
                    "organizationId": "dummy-org-id-123",
                    "result": "Pending",
                    "status": "Processing",
                    "title": "Bizarre Adventure news",
                    "url": "https://www.google.com/"
                },
                {
                    "addedBy": {
                    "dateAdded": "2025-07-09T14:56:40.373863+00:00",
                    "userId": "dummy-user-id-3",
                    "userName": "James Bond"
                    },
                    "blobPath": "DummyPath.txt",
                    "contentLength": 50422,
                    "dateAdded": "2025-07-09T14:56:40.373834+00:00",
                    "error": null,
                    "id": "dummy-url-id-3",
                    "lastModified": "2025-07-09T14:56:40.373854+00:00",
                    "organizationId": "dummy-org-id-123",
                    "result": "Failed",
                    "status": "Error",
                    "title": "Golden Eye news",
                    "url": "https://www.cnn.com/"
                },
                ],
                status: 200
            }
            }).as('getOrganizationUrls');
        cy.intercept('GET', '/api/webscraping/search-urls*', {
            statusCode: 200,
            body: {
                data: [
                {
                    "addedBy": {
                    "dateAdded": "2025-07-09T14:56:40.373863+00:00",
                    "userId": "dummy-user-id-123",
                    "userName": "James Bond"
                    },
                    "blobPath": "DummyPath.txt",
                    "contentLength": 50422,
                    "dateAdded": "2025-07-09T14:56:40.373834+00:00",
                    "error": null,
                    "id": "dummy-url-id-123",
                    "lastModified": "2025-07-09T14:56:40.373854+00:00",
                    "organizationId": "dummy-org-id-123",
                    "result": "Failed",
                    "status": "Error",
                    "title": "Golden Eye news",
                    "url": "https://www.cnn.com/"
                },
                ],
                status: 200
            }
        }).as('searchOrganizationUrls');
        cy.intercept('POST', '/api/webscraping/scrape-url*', {
            statusCode: 200,
            body: {
                "data": {
                    "message": "Attempted to scrape 1 URL(s)",
                    "result": {
                        "blob_storage_enabled": true,
                        "blob_storage_results": [
                            {
                                "blob_path": "this is a path.txt",
                                "content_size_bytes": 50086,
                                "message": "Successfully uploaded to blob storage",
                                "status": "success",
                                "url": "https://www.google.com/"
                            }
                        ],
                        "completed_at": "2025-07-09T16:06:57Z",
                        "crawler_summary": {
                            "activity": "scrape_pages",
                            "closed_reason": null,
                            "config_name": "configscrape",
                            "duration": 0.430341,
                            "end_time": "2025-07-09T16:06:57Z",
                            "failure": 0,
                            "log": null,
                            "new": 0,
                            "processed": 1,
                            "start_time": "2025-07-09T16:06:56Z",
                            "success": 1,
                            "updated": 1
                        },
                        "duration_seconds": 0.51,
                        "message": "Scraped 1 URLs in parallel and uploaded to blob storage",
                        "request_id": "scrapeid1234567890",
                        "results": [
                            {
                                "content": "How to make fresh guacamole at home. Use bread",
                            }
                        ],
                    },
                }
            }
        }).as('scrapeUrls');
        cy.intercept('DELETE', '/api/webscraping/delete-url*', {
            statusCode: 200,
            body: {
                message: "URL deleted successfully"
            }
        }).as('deleteOrganizationUrl');
        cy.intercept('PUT', '/api/webscraping/modify-url*', {
            statusCode: 200,
            body: {
                message: "URL modified successfully"
            }
        }).as('updateOrganizationUrl');
        cy.visit("/", {
            onBeforeLoad: (window) => {
                
            }
        });
        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click({ force: true });
        cy.get('span').contains("Control Center").click();
        cy.get('a[href="#/knowledge-sources"]').contains("Knowledge Sources").should("be.visible");
        cy.get('a[href="#/knowledge-sources"]').contains("Knowledge Sources").click();
        cy.url().should("include", "#/knowledge-sources");
        cy.get("#sidebarCollapse").click();
    });
    

    it('Should verify the visibility and functionality of the "Knowledge Sources Page" link', () => { 
        cy.get('span').contains("Knowledge Sources").should("be.visible");
        cy.get('button').contains("Add URL").should("be.visible");
        cy.get('button').contains("All Status").should("be.visible");
        cy.get('input[placeholder="Enter website URL to scrape (e.g., https://example.com)"]').should('be.visible');
        cy.get('input[placeholder="Search knowledge sources..."]').should('be.visible');
        cy.get('span').contains("URL").should("be.visible");
        cy.get('span').contains("Actions").should("be.visible");
        cy.get('button[title="Refresh source"]').should("be.visible");
        cy.get('button[title="Edit source"]').should("be.visible");
        cy.get('button[title="Delete source"]').should("be.visible");
    });

    it('Should verify the visibility and functionality of the table contents and search of the "Knowledge Sources Page" link', () => { 
        cy.get('span').contains("Knowledge Sources").should("be.visible");
        cy.get('span').should('contain.text', '3 results');
        cy.get('button').contains("All Status").should("be.visible").click();

        // Active Status
        cy.contains('button', 'Active').click({ force: true });
        cy.get('div').should('contain.text', 'Ethan Winters');
        cy.get('span').should('contain.text', '1 result');
        cy.get('button').contains("Active").should("be.visible").click();
        cy.contains('button', 'All Status').click({ force: true });

        // Processing Status
        cy.get('button').contains("All Status").click();
        cy.contains('button', 'Processing').click({ force: true });
        cy.get('div').should('contain.text', 'Jonathan Joestar');
        cy.get('span').should('contain.text', '1 result');
        cy.get('button').contains("Processing").should("be.visible").click();
        cy.contains('button', 'All Status').click({ force: true });

        // Error Status
        cy.get('button').contains("All Status").click();
        cy.contains('button', 'Error').click({ force: true });
        cy.get('div').should('contain.text', 'James Bond');
        cy.get('span').should('contain.text', '1 result');
        cy.get('button').contains("Error").should("be.visible").click();
        cy.contains('button', 'All Status').click({ force: true });

        // Search functionality
        cy.get('input[placeholder="Search knowledge sources..."]').should('be.visible');
        cy.get('input[placeholder="Search knowledge sources..."]').type('cnn');
        cy.get('div').should('contain.text', 'James Bond');
        cy.get('span').should('contain.text', '1 result');
        cy.get('button[title="Clear search"]').should('be.visible').click();
        cy.get('span').should('contain.text', '3 results');

    });

    it('Should verify the functionality of the action buttons for the "Knowledge Sources Page" link', () => {
        // Refresh source
        cy.get('button[title="Refresh source"]').first().click();
        cy.wait('@getOrganizationUrls');
        cy.get('div').should('contain.text', 'Ethan Winters');
        cy.get('span').should('contain.text', '3 results');

        // Edit source
        cy.get('button[title="Edit source"]').first().click();
        cy.get('input[placeholder="Enter website URL to scrape (e.g., https://example.com)"]').should('be.visible');
        cy.get('button').contains("Save").should("be.visible");
        cy.get('button').contains("Cancel").should("be.visible");
        cy.get('button').contains("Cancel").click();
        cy.get('button[title="Edit source"]').first().click();
        cy.get('input[placeholder="Enter URL"]').clear();
        cy.get('input[placeholder="Enter URL"]').type('https://www.youtube.com')
        cy.get('button').contains("Save").click();
        cy.get('div').should('contain.text', 'URL updated. Refresh the source to scrape the new page.');

        // Delete source
        cy.get('button[title="Delete source"]').first().click();
        cy.get('div').should('contain.text', 'This URL has been removed from your knowledge sources');
        cy.contains('span', '2 results', { timeout: 7000 }).should('be.visible');

    });
});
