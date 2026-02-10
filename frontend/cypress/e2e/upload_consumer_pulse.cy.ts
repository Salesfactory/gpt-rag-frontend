/// <reference types="cypress" />
import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Upload Consumer Pulse Data Test Suite", () => {
    beforeEach(() => {
        setupTestUserAndOrg();
    });
    const setupCommonInterceptsForRole = (role: string) => {
        cy.intercept("GET", "/api/auth/user", {
            statusCode: 200,
            body: {
                authenticated: true,
                status: "success",
                user: {
                    email: "test@example.com",
                    id: "test-user-id-123",
                    name: "Test User",
                    organizationId: "test-org-id-456",
                    role: role
                }
            }
        }).as("getUser");

        cy.intercept("GET", "/api/get-organization-subscription*", {
            statusCode: 200,
            body: {
                id: "test-org-id-456",
                name: "Test Organization",
                owner: "test-user-id-123",
                subscriptionStatus: "active",
                subscriptionExpirationDate: 1736348460,
                subscriptionId: "sub_test123"
            }
        }).as("getOrganizationSubscription");

        cy.intercept("GET", "/api/get-user-organizations", {
            statusCode: 200,
            body: [
                {
                    id: "test-org-id-456",
                    name: "Test Organization",
                    owner: "test-user-id-123",
                    subscriptionStatus: "active",
                    subscriptionExpirationDate: 1736348460,
                    subscriptionId: "sub_test123"
                }
            ]
        }).as("getUserOrganizations");

        cy.intercept("GET", "/api/get-users-organizations-role*", {
            statusCode: 200,
            body: { role: role }
        }).as("getUserOrganizationsRole");

        cy.intercept("GET", "/api/subscriptions/sub_test123/tiers", {
            statusCode: 200,
            body: {
                subscriptionData: {
                    current_period_end: 1738940483,
                    items: [
                        {
                            currency: "usd",
                            price_id: "price_test123",
                            price_nickname: "Premium",
                            product_id: "prod_test123",
                            product_name: "AI Assistants",
                            quantity: 1,
                            unit_amount: 1200000
                        }
                    ],
                    status: "active"
                },
                subscriptionId: "sub_test123",
                subscriptionTiers: ["Basic", "Custom", "Premium"]
            }
        }).as("getSubscriptionTiers");

        cy.intercept("GET", "/api/chat-history", {
            statusCode: 200,
            body: []
        }).as("getChatHistory");

        cy.intercept("GET", "/api/settings", {
            statusCode: 200,
            body: { font_family: "Arial", font_size: "16", model: "gpt-4", temperature: 0 }
        }).as("getSettings");

        // Add missing intercepts that the app calls
        cy.intercept("GET", "/api/getusers*", {
            statusCode: 200,
            body: []
        }).as("getUsers");

        cy.intercept("GET", "/api/categories*", {
            statusCode: 200,
            body: []
        }).as("getCategories");

        // Add intercept for organization usage to prevent unhandled promise rejection
        cy.intercept("GET", "/api/organizations/*/get-organization-usage", {
            statusCode: 200,
            body: {
                data: {
                    id: "usage-test-123",
                    organizationId: "test-org-id-456",
                    subscriptionId: "sub_test123",
                    isSubscriptionActive: true,
                    type: "organization_usage",
                    balance: {
                        totalAllocated: 1000,
                        currentUsed: 100
                    },
                    policy: {
                        tierId: "tier_premium",
                        currentSeats: 5,
                        allowedUserIds: [],
                        isSubscriptionActive: true
                    }
                }
            }
        }).as("getOrganizationUsage");
    };

    describe("Access Control Tests", () => {
        it("Should allow platformAdmin to see Consumer Pulse in sidebar and access the page", () => {
            setupCommonInterceptsForRole("platformAdmin");

            // Visit root first to initialize AppContext
            cy.visit("/", {
                onBeforeLoad: (window) => {

                }
            });

            // Wait for initial page load
            cy.get("textarea[placeholder='Ask anything about your marketing data...']", { timeout: 10000 }).should("be.visible");

            // Open the sidebar by clicking the headerCollapse button
            cy.get("#headerCollapse", { timeout: 10000 }).should("be.visible").click();

            // Wait for sidebar to open
            cy.wait(500);

            // Click on "Premium Features" to expand the submenu
            cy.contains("Premium Features").should("be.visible").click();

            // Wait for submenu to expand
            cy.wait(300);

            // Verify that "Consumer Pulse" option is visible for platformAdmin
            cy.contains("Consumer Pulse").should("be.visible");

            // Click on "Consumer Pulse" to navigate to the page
            cy.contains("Consumer Pulse").click();

            // Verify the page loads and main elements are visible
            cy.contains("Upload Consumer Pulse Data", { timeout: 10000 }).should("be.visible");
            cy.contains("Upload files that will be distributed across all organizations").should("be.visible");
        });

        it("Should NOT show Consumer Pulse option to admin users", () => {
            setupCommonInterceptsForRole("admin");

            // Visit root first to initialize AppContext
            cy.visit("/", {
                onBeforeLoad: (window) => {

                }
            });

            // Wait for initial page load
            cy.get("textarea[placeholder='Ask anything about your marketing data...']", { timeout: 10000 }).should("be.visible");

            // Open the sidebar by clicking the headerCollapse button
            cy.get("#headerCollapse", { timeout: 10000 }).should("be.visible").click();

            // Wait for sidebar to open
            cy.wait(500);

            // Try to find "Premium Features" and click if it exists
            cy.get("body").then($body => {
                if ($body.text().includes("Premium Features")) {
                    cy.contains("Premium Features").click();
                    cy.wait(300);
                }
            });

            // Verify that "Consumer Pulse" option is NOT visible for admin
            cy.contains("Consumer Pulse").should("not.exist");
        });

        it("Should NOT show Consumer Pulse option to regular users", () => {
            setupCommonInterceptsForRole("user");

            // Visit root first to initialize AppContext
            cy.visit("/", {
                onBeforeLoad: (window) => {

                }
            });

            // Wait for initial page load
            cy.get("textarea[placeholder='Ask anything about your marketing data...']", { timeout: 10000 }).should("be.visible");

            // Open the sidebar by clicking the headerCollapse button
            cy.get("#headerCollapse", { timeout: 10000 }).should("be.visible").click();

            // Wait for sidebar to open
            cy.wait(500);

            // Try to find "Premium Features" and click if it exists
            cy.get("body").then($body => {
                if ($body.text().includes("Premium Features")) {
                    cy.contains("Premium Features").click();
                    cy.wait(300);
                }
            });

            // Verify that "Consumer Pulse" option is NOT visible for regular user
            cy.contains("Consumer Pulse").should("not.exist");
        });

        it("Should prevent direct URL access for non-platformAdmin users", () => {
            setupCommonInterceptsForRole("admin");

            // Try to navigate directly to the upload consumer pulse page via URL
            cy.visit("/#/upload-consumer-pulse", {
                onBeforeLoad: (window) => {

                }
            });

            // Wait for auth check
            cy.wait("@getUser");

            // Should be redirected or show access denied
            cy.contains("Upload Consumer Pulse Data").should("not.exist");
        });
    });

    describe("UI Elements Display Tests", () => {
        beforeEach(() => {
            setupCommonInterceptsForRole("platformAdmin");
            cy.visit("/", {
                onBeforeLoad: (window) => {

                }
            });

            // Wait for initial page load with more time
            cy.get("textarea[placeholder='Ask anything about your marketing data...']", { timeout: 15000 }).should("be.visible");

            // Navigate through sidebar
            cy.get("#headerCollapse", { timeout: 10000 }).should("be.visible").click();
            cy.wait(500);
            cy.contains("Premium Features").should("be.visible").click();
            cy.wait(300);
            cy.contains("Consumer Pulse").should("be.visible").click();
            cy.contains("Upload Consumer Pulse Data", { timeout: 10000 }).should("be.visible");
        });

        it("Should display the page header with title and subtitle", () => {
            cy.contains("Upload Consumer Pulse Data").should("be.visible");
            cy.contains("Upload files that will be distributed across all organizations").should("be.visible");
        });

        it("Should display the dropzone with upload instructions", () => {
            cy.contains("Drag and drop a file here, or click to select").should("be.visible");
            cy.contains("Supported formats: PDF, CSV, Excel, Word, PowerPoint").should("be.visible");
        });

        it("Should display the upload icon", () => {
            // Check for the dropzone container
            cy.get('[class*="dropzone"]').should("be.visible");
            cy.get('[class*="upload_icon"]').should("exist");
        });
    });

    describe("File Upload Functionality Tests", () => {
        beforeEach(() => {
            setupCommonInterceptsForRole("platformAdmin");
            cy.visit("/", {
                onBeforeLoad: (window) => {

                }
            });

            // Wait for initial page load with more time
            cy.get("textarea[placeholder='Ask anything about your marketing data...']", { timeout: 15000 }).should("be.visible");

            // Navigate through sidebar
            cy.get("#headerCollapse", { timeout: 10000 }).should("be.visible").click();
            cy.wait(500);
            cy.contains("Premium Features").should("be.visible").click();
            cy.wait(300);
            cy.contains("Consumer Pulse").should("be.visible").click();
            cy.contains("Upload Consumer Pulse Data", { timeout: 10000 }).should("be.visible");
        });

        it("Should successfully upload a file and show success message", () => {
            // Mock successful upload response
            cy.intercept("POST", "/api/upload-shared-document", {
                statusCode: 200,
                body: {
                    data: {
                        message: "File uploaded to 3 out of 3 organizations",
                        filename: "test-file.xlsx",
                        total_organizations: 3,
                        successful_uploads: 3,
                        failed_uploads: 0,
                        results: {
                            successful: [
                                { organization_id: "org-1", blob_url: "https://example.com/blob1" },
                                { organization_id: "org-2", blob_url: "https://example.com/blob2" },
                                { organization_id: "org-3", blob_url: "https://example.com/blob3" }
                            ],
                            failed: []
                        }
                    },
                    status: 200
                }
            }).as("uploadSharedDocument");

            // Select and upload file
            cy.get('input[type="file"]').selectFile(
                "./cypress/files/Electric_Vehicle_Population_Data copy.xlsx",
                { force: true }
            );

            // Wait for upload to complete
            cy.wait("@uploadSharedDocument");

            // Verify success message
            cy.contains("Upload Successful!").should("be.visible");

            // Verify "Upload Another File" button is visible
            cy.contains("Upload Another File").should("be.visible");
        });

        it("Should show uploading state during file upload", () => {
            // Mock upload with delay to see uploading state
            cy.intercept("POST", "/api/upload-shared-document", (req) => {
                req.reply({
                    statusCode: 200,
                    body: {
                        data: {
                            total_organizations: 2,
                            successful_uploads: 2,
                            failed_uploads: 0
                        }
                    },
                    delay: 1000 // Add delay to see uploading state
                });
            }).as("uploadSharedDocument");

            // Select file
            cy.get('input[type="file"]').selectFile(
                "./cypress/files/Electric_Vehicle_Population_Data copy.xlsx",
                { force: true }
            );

            // Verify uploading state
            cy.contains("Uploading").should("be.visible");
            cy.get('[class*="spinner"]').should("exist");
        });

        it("Should handle partial upload success (some organizations failed)", () => {
            // Mock partial success response
            cy.intercept("POST", "/api/upload-shared-document", {
                statusCode: 207, // Multi-Status
                body: {
                    data: {
                        message: "File uploaded to 2 out of 3 organizations",
                        filename: "test-file.csv",
                        total_organizations: 3,
                        successful_uploads: 2,
                        failed_uploads: 1,
                        results: {
                            successful: [
                                { organization_id: "org-1", blob_url: "https://example.com/blob1" },
                                { organization_id: "org-2", blob_url: "https://example.com/blob2" }
                            ],
                            failed: [
                                { organization_id: "org-3", error: "Permission denied" }
                            ]
                        }
                    },
                    status: 207
                }
            }).as("uploadSharedDocument");

            // Select and upload file
            cy.get('input[type="file"]').selectFile(
                "./cypress/files/Electric_Vehicle_Population_Data copy.xlsx",
                { force: true }
            );

            cy.wait("@uploadSharedDocument");
        });

        it("Should handle upload error and show error message", () => {
            // Mock error response
            cy.intercept("POST", "/api/upload-shared-document", {
                statusCode: 500,
                body: {
                    error: "Internal Server Error"
                }
            }).as("uploadSharedDocument");

            // Select and upload file
            cy.get('input[type="file"]').selectFile(
                "./cypress/files/Electric_Vehicle_Population_Data copy.xlsx",
                { force: true }
            );

            cy.wait("@uploadSharedDocument");

            // Verify error message
            cy.contains("Upload Failed").should("be.visible");
            cy.contains("Server responded with 500").should("be.visible");

            // Verify "Try Again" button is visible
            cy.contains("Try Again").should("be.visible");
        });

        it("Should handle invalid file type error (422)", () => {
            // Mock invalid file type error
            cy.intercept("POST", "/api/upload-shared-document", {
                statusCode: 422,
                body: {
                    error: "Invalid file type"
                }
            }).as("uploadSharedDocument");

            // Select and upload file
            cy.get('input[type="file"]').selectFile(
                "./cypress/files/Electric_Vehicle_Population_Data copy.xlsx",
                { force: true }
            );

            cy.wait("@uploadSharedDocument");

            // Verify error message
            cy.contains("Upload Failed").should("be.visible");
            cy.contains("File type not allowed").should("be.visible");
        });

        it("Should reset the upload state when clicking 'Upload Another File'", () => {
            // Mock successful upload
            cy.intercept("POST", "/api/upload-shared-document", {
                statusCode: 200,
                body: {
                    data: {
                        total_organizations: 2,
                        successful_uploads: 2,
                        failed_uploads: 0
                    }
                }
            }).as("uploadSharedDocument");

            // Upload file
            cy.get('input[type="file"]').selectFile(
                "./cypress/files/Electric_Vehicle_Population_Data copy.xlsx",
                { force: true }
            );

            cy.wait("@uploadSharedDocument");

            // Verify success message
            cy.contains("Upload Successful!").should("be.visible");

            // Click "Upload Another File"
            cy.contains("Upload Another File").click();

            // Verify we're back to the initial state
            cy.contains("Drag and drop a file here, or click to select").should("be.visible");
            cy.contains("Upload Successful!").should("not.exist");
        });

        it("Should reset the upload state when clicking 'Try Again' after error", () => {
            // Mock error response
            cy.intercept("POST", "/api/upload-shared-document", {
                statusCode: 500,
                body: {
                    error: "Internal Server Error"
                }
            }).as("uploadSharedDocument");

            // Upload file
            cy.get('input[type="file"]').selectFile(
                "./cypress/files/Electric_Vehicle_Population_Data copy.xlsx",
                { force: true }
            );

            cy.wait("@uploadSharedDocument");

            // Verify error message
            cy.contains("Upload Failed").should("be.visible");

            // Click "Try Again"
            cy.contains("Try Again").click();

            // Verify we're back to the initial state
            cy.contains("Drag and drop a file here, or click to select").should("be.visible");
            cy.contains("Upload Failed").should("not.exist");
        });
    });

    describe("Dropzone Interaction Tests", () => {
        beforeEach(() => {
            setupCommonInterceptsForRole("platformAdmin");
            cy.visit("/", {
                onBeforeLoad: (window) => {

                }
            });

            // Wait for initial page load with more time
            cy.get("textarea[placeholder='Ask anything about your marketing data...']", { timeout: 15000 }).should("be.visible");

            // Navigate through sidebar
            cy.get("#headerCollapse", { timeout: 10000 }).should("be.visible").click();
            cy.wait(500);
            cy.contains("Premium Features").should("be.visible").click();
            cy.wait(300);
            cy.contains("Consumer Pulse").should("be.visible").click();
            cy.contains("Upload Consumer Pulse Data", { timeout: 10000 }).should("be.visible");
        });

        it("Should accept file drop via drag and drop", () => {
            // Mock successful upload
            cy.intercept("POST", "/api/upload-shared-document", {
                statusCode: 200,
                body: {
                    data: {
                        total_organizations: 1,
                        successful_uploads: 1,
                        failed_uploads: 0
                    }
                }
            }).as("uploadSharedDocument");

            // Drag and drop file
            cy.get('input[type="file"]').selectFile(
                "./cypress/files/Electric_Vehicle_Population_Data copy.xlsx",
                { force: true, action: "drag-drop" }
            );

            cy.wait("@uploadSharedDocument");

            // Verify upload was triggered
            cy.contains("Upload Successful!").should("be.visible");
        });

        it("Should accept file via click to select", () => {
            // Mock successful upload
            cy.intercept("POST", "/api/upload-shared-document", {
                statusCode: 200,
                body: {
                    data: {
                        total_organizations: 1,
                        successful_uploads: 1,
                        failed_uploads: 0
                    }
                }
            }).as("uploadSharedDocument");

            // Select file via click
            cy.get('input[type="file"]').selectFile(
                "./cypress/files/Electric_Vehicle_Population_Data copy.xlsx",
                { force: true }
            );

            cy.wait("@uploadSharedDocument");

            // Verify upload was triggered
            cy.contains("Upload Successful!").should("be.visible");
        });
    });

    describe("No Organizations Scenario", () => {
        beforeEach(() => {
            setupCommonInterceptsForRole("platformAdmin");
            cy.visit("/", {
                onBeforeLoad: (window) => {

                }
            });

            // Wait for initial page load with more time
            cy.get("textarea[placeholder='Ask anything about your marketing data...']", { timeout: 15000 }).should("be.visible");

            // Navigate through sidebar
            cy.get("#headerCollapse", { timeout: 10000 }).should("be.visible").click();
            cy.wait(500);
            cy.contains("Premium Features").should("be.visible").click();
            cy.wait(300);
            cy.contains("Consumer Pulse").should("be.visible").click();
            cy.contains("Upload Consumer Pulse Data", { timeout: 10000 }).should("be.visible");
        });

        it("Should handle case when no organizations exist", () => {
            // Mock response when no organizations are found
            cy.intercept("POST", "/api/upload-shared-document", {
                statusCode: 404,
                body: {
                    error: "No organizations found to upload to"
                }
            }).as("uploadSharedDocument");

            // Select and upload file
            cy.get('input[type="file"]').selectFile(
                "./cypress/files/Electric_Vehicle_Population_Data copy.xlsx",
                { force: true }
            );

            cy.wait("@uploadSharedDocument");

            // Verify error message
            cy.contains("Upload Failed").should("be.visible");
            cy.contains("404").should("be.visible");
        });
    });
});
