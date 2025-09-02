import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Voice Customer Test Suite", () => {
    beforeEach(() => {
        setupTestUserAndOrg();
        cy.visit("/");
        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();
        cy.get("span").contains("Control Center").click();
        cy.get('a[href="#/voice-customer"]').contains("Voice of Customer").should("be.visible");
        cy.get('a[href="#/voice-customer"]').contains("Voice of Customer").click();
        cy.get("button#headerCollapse").click();
    });

    it("should display the voice customer page", () => {
        cy.url().should("include", "#/voice-customer");
        cy.get("h3").contains("Brands").should("be.visible");
        cy.get("h3").contains("Products").should("be.visible");
        cy.get("h3").contains("Competitors").should("be.visible");

        cy.get("h3").contains("Report Generation Status");

        cy.get("h4").contains("Real Madrid").should("be.visible");
        cy.get("h4").contains("Kylian Mbappe").should("be.visible");
        cy.get("h4").contains("FC Barcelona").should("be.visible");
    });

    it("Should verify the functionality of the brand creation", () => {
        cy.url().should("include", "#/voice-customer");
        cy.get('[aria-label="create-brands-button"]').should("be.visible");
        cy.get('[aria-label="create-brands-button"]').click();

        cy.intercept("GET", "/api/voice-customer/organizations/0aad82ee-52ec-428e-b211-e9cc34b94457/brands", {
            statusCode: 200,
            body: {
                data: [
                    {
                        _attachments: "attachments/",
                        _etag: '"61027b6d-0000-0100-0000-68839e700000"',
                        _rid: "piUFAJPb450ZAAAAAAAAAA==",
                        _self: "dbs/piUFAA==/colls/piUFAJPb450=/docs/piUFAJPb450ZAAAAAAAAAA==/",
                        _ts: 1753456240,
                        createdAt: "2025-07-25T15:10:39.576086+00:00",
                        description: "Best Team of the world",
                        id: "a0dc8c96-0fc8-4549-8d34-328ada5aa64b",
                        name: "Real Madrid",
                        organizationId: "22552b2f-1e98-4bc0-a252-a782d80201d5",
                        updatedAt: "2025-07-25T15:10:39.576124+00:00"
                    },
                    {
                        _attachments: "attachments/",
                        _etag: '"61027b6d-0000-0100-0000-68839e700001"',
                        _rid: "piUFAJPb450ZAAAAAAAAAB==",
                        _self: "dbs/piUFAA==/colls/piUFAJPb450=/docs/piUFAJPb450ZAAAAAAAAAB==/",
                        _ts: 1753456241,
                        createdAt: "2025-07-25T15:10:40.576086+00:00",
                        description: "A top level football club",
                        id: "b1dc8c96-0fc8-4549-8d34-328ada5aa64c",
                        name: "Chelsea FC",
                        organizationId: "22552b2f-1e98-4bc0-a252-a782d80201d5",
                        updatedAt: "2025-07-25T15:10:40.576124+00:00"
                    }
                ],
                status: 200
            }
        }).as("getBrands");

        cy.contains("Add Brand to Track").should("be.visible");
        cy.get('input[placeholder="Enter brand name"]').should("be.visible");
        cy.get('input[placeholder="Enter brand name"]').type("Chelsea FC");
        cy.get("textarea[placeholder='Brief description of the brand']").should("be.visible");
        cy.get("textarea[placeholder='Brief description of the brand']").type("A top level football club");
        cy.get("button[aria-label='add-brand-button']").should("be.visible");
        cy.get("button[aria-label='add-brand-button']").click();
        cy.wait("@getBrands");

        cy.get("h4").contains("Chelsea FC").should("be.visible");
    });

    it("Should verify the functionality of the product creation", () => {
        cy.url().should("include", "#/voice-customer");
        cy.get('[aria-label="create-products-button"]').should("be.visible");
        cy.get('[aria-label="create-products-button"]').click();

        cy.contains("Add Product to Track").should("be.visible");
        cy.get('input[placeholder="Enter product name"]').should("be.visible");
        cy.get('input[placeholder="Enter product name"]').type("Lionel Messi");
        cy.get("input[placeholder='Enter product category']").should("be.visible");
        cy.get("input[placeholder='Enter product category']").type("Forward");
        cy.get("select[aria-label='brand-select']").should("be.visible");

        cy.intercept("GET", "/api/voice-customer/organizations/0aad82ee-52ec-428e-b211-e9cc34b94457/products", {
            statusCode: 200,
            body: {
                data: [
                    {
                        _attachments: "attachments/",
                        _etag: '"19004a4c-0000-0100-0000-68839ea40000"',
                        _rid: "piUFAMwF0lwRAAAAAAAAAA==",
                        _self: "dbs/piUFAA==/colls/piUFAMwF0lw=/docs/piUFAMwF0lwRAAAAAAAAAA==/",
                        _ts: 1753456292,
                        brandId: "a0dc8c96-0fc8-4549-8d34-328ada5aa64b",
                        category: "Player",
                        createdAt: "2025-07-25T15:11:31.903402+00:00",
                        description: "A mid level player",
                        id: "9ded4b25-e177-486c-af51-9bb600440b0a",
                        name: "Kylian Mbappe",
                        organizationId: "22552b2f-1e98-4bc0-a252-a782d80201d5",
                        updatedAt: "2025-07-25T15:11:31.903421+00:00"
                    },
                    {
                        _attachments: "attachments/",
                        _etag: '"19004a4c-0000-0100-0000-68839ea40001"',
                        _rid: "piUFAMwF0lwRAAAAAAAAAA==",
                        _self: "dbs/piUFAA==/colls/piUFAMwF0lw=/docs/piUFAMwF0lwRAAAAAAAAAA==/",
                        _ts: 1753456292,
                        brandId: "a0dc8c96-0fc8-4549-8d34-328ada5aa64b",
                        category: "Player",
                        createdAt: "2025-07-25T15:11:31.903402+00:00",
                        description: "A top level football player",
                        id: "9ded4b25-e177-486c-af51-9bb600440b0a",
                        name: "Lionel Messi",
                        organizationId: "22552b2f-1e98-4bc0-a252-a782d80201d5",
                        updatedAt: "2025-07-25T15:11:31.903421+00:00"
                    }
                ],
                status: 200
            }
        }).as("getProducts2");

        cy.get("select[aria-label='brand-select']").select("Real Madrid");
        cy.get("textarea[placeholder='Brief description of the product']").should("be.visible");
        cy.get("textarea[placeholder='Brief description of the product']").type("A top level football player");
        cy.get("button[aria-label='add-product-button']").should("be.visible");
        cy.get("button[aria-label='add-product-button']").click();

        cy.wait("@getProducts2");
        cy.get("h4").contains("Lionel Messi").should("be.visible");
    });

    it("Should verify the functionality of the competitor creation", () => {
        cy.url().should("include", "#/voice-customer");
        cy.get('[aria-label="create-competitors-button"]').should("be.visible");
        cy.get('[aria-label="create-competitors-button"]').click();

        cy.contains("Add Competitor to Track").should("be.visible");
        cy.get('input[placeholder="Enter competitor name"]').should("be.visible");
        cy.get('input[placeholder="Enter competitor name"]').type("Liverpool FC");
        cy.get("input[placeholder='Enter industry']").should("be.visible");
        cy.get("input[placeholder='Enter industry']").type("Football Club");

        cy.intercept("GET", "/api/voice-customer/organizations/0aad82ee-52ec-428e-b211-e9cc34b94457/competitors", {
            statusCode: 200,
            body: {
                data: [
                    {
                        _attachments: "attachments/",
                        _etag: '"ca06a92d-0000-0100-0000-68839ecd0000"',
                        _rid: "piUFAIdpn7QWAAAAAAAAAA==",
                        _self: "dbs/piUFAA==/colls/piUFAIdpn7Q=/docs/piUFAIdpn7QWAAAAAAAAAA==/",
                        _ts: 1753456333,
                        brands: [
                            {
                                _attachments: "attachments/",
                                _etag: '"a6037715-0000-0100-0000-68839ece0000"',
                                _rid: "piUFAILPYeciAAAAAAAAAA==",
                                _self: "dbs/piUFAA==/colls/piUFAILPYec=/docs/piUFAILPYeciAAAAAAAAAA==/",
                                _ts: 1753456334,
                                brand_id: "a0dc8c96-0fc8-4549-8d34-328ada5aa64b",
                                competitor_id: "e2291c49-d922-46ec-b791-9d677c82eed9",
                                id: "80488059-89c1-43df-a989-806e6ac1e2d7"
                            }
                        ],
                        createdAt: "2025-07-25T15:12:12.666829+00:00",
                        description: "A mid level football club",
                        id: "e2291c49-d922-46ec-b791-9d677c82eed9",
                        industry: "Football",
                        name: "FC Barcelona",
                        organization_id: "22552b2f-1e98-4bc0-a252-a782d80201d5",
                        updatedAt: "2025-07-25T15:12:12.666857+00:00"
                    },
                    {
                        _attachments: "attachments/",
                        _etag: '"cf06fafc-0000-0100-0000-6883ab480000"',
                        _rid: "piUFAIdpn7QXAAAAAAAAAA==",
                        _self: "dbs/piUFAA==/colls/piUFAIdpn7Q=/docs/piUFAIdpn7QXAAAAAAAAAA==/",
                        _ts: 1753459528,
                        brands: [
                            {
                                _attachments: "attachments/",
                                _etag: '"aa03be44-0000-0100-0000-6883ab4b0000"',
                                _rid: "piUFAILPYecjAAAAAAAAAA==",
                                _self: "dbs/piUFAA==/colls/piUFAILPYec=/docs/piUFAILPYecjAAAAAAAAAA==/",
                                _ts: 1753459531,
                                brand_id: "a0dc8c96-0fc8-4549-8d34-328ada5aa64b",
                                competitor_id: "acc26e1b-4c87-4b92-b845-e906814d345a",
                                id: "d0c0838f-7bb4-492e-8ace-66b0eaf06b28"
                            }
                        ],
                        createdAt: "2025-07-25T16:05:28.311778+00:00",
                        description: "A top level football club",
                        id: "acc26e1b-4c87-4b92-b845-e906814d345a",
                        industry: "Football Club",
                        name: "Liverpool FC",
                        organization_id: "22552b2f-1e98-4bc0-a252-a782d80201d5",
                        updatedAt: "2025-07-25T16:05:28.311808+00:00"
                    }
                ],
                status: 200
            }
        }).as("getCompetitors");

        cy.get("textarea[placeholder='Brief description of the competitor']").should("be.visible");
        cy.get("textarea[placeholder='Brief description of the competitor']").type("A top level football club");

        cy.get("button[aria-label='add-competitor-button']").should("be.visible");
        cy.get("button[aria-label='add-competitor-button']").click();

        cy.wait("@getCompetitors");
        cy.get("h4").contains("Liverpool FC").should("be.visible");
    
    })

    it("Should display report jobs in the Report Generation Status section", () => {
        // Mock backend response for report jobs
        cy.intercept('GET', /\/api\/report-jobs.*/, {
            statusCode: 200,
            body: [
                {
                    id: "job-1",
                    organization_id: "org-123",
                    report_name: "Brand Analysis",
                    type: "brand_analysis",
                    status: "COMPLETED",
                    progress: 100,
                    created_at: "2025-08-25T18:20:31Z",
                    updated_at: "2025-08-26T19:10:00Z",
                    params: { target: "Apple" }
                },
                {
                    id: "job-2",
                    organization_id: "org-123",
                    report_name: "Brand Analysis",
                    type: "brand_analysis",
                    status: "RUNNING",
                    progress: 65,
                    created_at: "2025-08-25T18:20:31Z",
                    updated_at: "2025-08-26T19:10:00Z",
                    params: { target: "Microsoft" }
                },
                {
                    id: "job-3",
                    organization_id: "org-123",
                    report_name: "Brand Analysis",
                    type: "competitor_analysis",
                    status: "QUEUED",
                    progress: 65,
                    created_at: "2025-08-25T18:20:31Z",
                    updated_at: "2025-08-26T19:10:00Z",
                    params: { target: "Microsoft" }
                },
                {
                    id: "job-4",
                    organization_id: "org-123",
                    report_name: "Brand Analysis",
                    type: "product_analysis",
                    status: "FAILED",
                    progress: 65,
                    created_at: "2025-08-25T18:20:31Z",
                    updated_at: "2025-08-27T19:10:00Z",
                    params: { target: "Microsoft" }
                }
            ]
        }).as('fetchReportJobs');

        cy.reload();

        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();
        cy.get('span').contains("Control Center").click();
        cy.get('a[href="#/voice-customer"]').contains("Voice of Customer").should("be.visible");
        cy.get('a[href="#/voice-customer"]').contains("Voice of Customer").click();
        cy.get("button#headerCollapse").click();
        cy.contains("Report Generation Status").should("be.visible");

        cy.wait('@fetchReportJobs');

        cy.contains("Brand Analysis").should("exist");
        cy.contains("Completed").should("exist");
        cy.contains("Pending").should("exist");
        cy.contains("In Progress").should("exist");
        cy.contains("Failed").should("exist");

        cy.contains("Apple").should("exist");
        cy.contains("Microsoft").should("exist");

        cy.contains("2025-08-25").should("exist");
        cy.contains("2025-08-26").should("exist");
        cy.contains("2025-08-27").should("exist");
    });
    
    it("Should display the error message when the fetch statuses failed", () => {
        cy.intercept('GET', /\/api\/report-jobs.*/, {
            statusCode: 500,
            body: { error: "Failed to fetch report jobs" }
        }).as('fetchReportJobsError');

        cy.reload();

        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();
        cy.get('span').contains("Control Center").click();
        cy.get('a[href="#/voice-customer"]').contains("Voice of Customer").should("be.visible");
        cy.get('a[href="#/voice-customer"]').contains("Voice of Customer").click();
        cy.get("button#headerCollapse").click();
        cy.contains("Report Generation Status").should("be.visible");

        cy.wait('@fetchReportJobsError');

        cy.contains("Failed to fetch report jobs").should("be.visible");
    });

    it('Should show the spinner when reports are loading', () => {
        
        cy.intercept('GET', /\/api\/report-jobs.*/, (req) => {
        return new Promise((resolve) => {
            setTimeout(() => {
            resolve(req.reply({ statusCode: 200, body: [] }));
            }, 1000);
        });
        }).as('fetchReportJobsLoading');
        cy.reload();

        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();
        cy.get('span').contains("Control Center").click();
        cy.get('a[href="#/voice-customer"]').contains("Voice of Customer").should("be.visible");
        cy.get('a[href="#/voice-customer"]').contains("Voice of Customer").click();
        cy.get("button#headerCollapse").click();
        cy.contains("Report Generation Status").should("be.visible");

        cy.get('[data-testid="reports-loading"]').should('be.visible');

        cy.wait(1000);

        // Verify when there is no jobs found
        cy.contains("No reports found").should("be.visible");
    });
    
});
