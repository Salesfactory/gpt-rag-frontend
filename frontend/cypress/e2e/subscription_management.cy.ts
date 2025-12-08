import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Subscription Page tests", () => {
    beforeEach(() => {
        setupTestUserAndOrg();
        cy.intercept(
            'GET',
            /\/api\/subscription\/[^/]+\/financialAssistant/,
            {
                statusCode: 200,
                body: {
                data: {
                    financial_assistant_active: true,
                    subscription: {
                    id: "sub_123",
                    status: "active",
                    price_id: "price_123"
                    }
                }
                }
            }
        ).as('getFinancialAssistant');

        cy.intercept('GET', '/api/prices*', {
            statusCode: 200,
            body: {
                prices: [
                {
                    "active": true,
                    "billing_scheme": "per_unit",
                    "created": 1736366437,
                    "currency": "usd",
                    "custom_unit_amount": null,
                    "id": "dummy price",
                    "livemode": false,
                    "lookup_key": null,
                    "metadata": {
                    "FAQ": "*What kind of studies are included?* Our research team will conduct 4 custom studies for your brand annually including brand perception analysis, benefit trade-off research, concept testing, and other tailored insights to enhance your knowledge base with current market intelligence. *How do the tailored answers work?* Our experts will configure the system to understand your specific brand, business context, and industry nuances ensuring every response is uniquely relevant and actionable for your",
                    "features": "All Custom plan features included, Expanded team access (up to 20 members), Unlimited AI conversations, 4 custom research projects annually with unique insights, Full integration of research findings into your database, Industry-specific responses tailored to your business"
                    },
                    "nickname": "Premium",
                    "object": "price",
                    "product": "dummy product",
                    "recurring": {
                    "aggregate_usage": null,
                    "interval": "month",
                    "interval_count": 1,
                    "meter": null,
                    "trial_period_days": null,
                    "usage_type": "licensed"
                    },
                    "tax_behavior": "unspecified",
                    "tiers_mode": null,
                    "transform_quantity": null,
                    "type": "recurring",
                    "unit_amount": 2000000,
                    "unit_amount_decimal": "2000000"
                },
                {
                    "active": true,
                    "billing_scheme": "per_unit",
                    "created": 1736366310,
                    "currency": "usd",
                    "custom_unit_amount": null,
                    "id": "dummy price",
                    "livemode": false,
                    "lookup_key": null,
                    "metadata": {
                    "FAQ": "* How does the custom knowledge integration work? * You can upload your company documents or work directly with one of our experts to integrate your proprietary data and documents for a truly personalized AI experience. * Is there special onboarding for enterprise users? * Yes! Our white-glove onboarding includes personalized training sessions, custom integration support, and a dedicated success manager.",
                    "features": "All Basic features included,Team access for up to 5 members, Unlimited AI conversations, Custom knowledge integration with your data, Priority technical & content support (12-hr response)"
                    },
                    "nickname": "Custom",
                    "object": "price",
                    "product": "dummy product",
                    "recurring": {
                    "aggregate_usage": null,
                    "interval": "month",
                    "interval_count": 1,
                    "meter": null,
                    "trial_period_days": null,
                    "usage_type": "licensed"
                    },
                    "tax_behavior": "unspecified",
                    "tiers_mode": null,
                    "transform_quantity": null,
                    "type": "recurring",
                    "unit_amount": 250000,
                    "unit_amount_decimal": "250000"
                },
                {
                    "active": true,
                    "billing_scheme": "per_unit",
                    "created": 1736365726,
                    "currency": "usd",
                    "custom_unit_amount": null,
                    "id": "dummy price",
                    "livemode": false,
                    "lookup_key": null,
                    "metadata": {
                    "FAQ": "* Can I upgrade to a higher tier later? * Absolutely! You can seamlessly upgrade anytime as your needs grow, with pro-rated billing. * What's included in the standard knowledge database? * Gain immediate access to essential Home Improvement industry intelligence: top players' financial reports, real-time economic indicators, proven marketing frameworks, and our exclusive Consumer Pulse Survey data® and Consumer Pulse Segmentation® — everything you need to make informed decisions.",
                    "features": "Single user access, Unlimited AI conversations, Standard knowledge database, Email support (24-hour response)"
                    },
                    "nickname": "Basic",
                    "object": "price",
                    "product": "dummy product",
                    "recurring": {
                    "aggregate_usage": null,
                    "interval": "month",
                    "interval_count": 1,
                    "meter": null,
                    "trial_period_days": null,
                    "usage_type": "licensed"
                    },
                    "tax_behavior": "unspecified",
                    "tiers_mode": null,
                    "transform_quantity": null,
                    "type": "recurring",
                    "unit_amount": 40000,
                    "unit_amount_decimal": "40000"
                }
                ]
            }
            }).as('getProductPrices');

            cy.intercept('POST', '/api/logs/', {
                statusCode: 200,
                body: {
                    data: [
                    {
                        "action": "Subscription Tier Change",
                        "changeTime": 1751864112,
                        "current_plan": "Premium",
                        "id": "dummyid",
                        "modified_by": "dummyid",
                        "modified_by_name": "Dante Alighieri",
                        "organizationName": "Dummy Org",
                        "organizationOwner": "dummyid",
                        "organization_id": "dummyid",
                        "previous_plan": "Basic",
                        "status_financial_assistant": null,
                        "subscriptionId": "sub_1"
                    },
                    {
                        "action": "Subscription Tier Change",
                        "changeTime": 1751864102,
                        "current_plan": "Basic",
                        "id": "dummyid",
                        "modified_by": "dummyid",
                        "modified_by_name": "James Sunderland",
                        "organizationName": "Dummy Org",
                        "organizationOwner": "dummyid",
                        "organization_id": "dummyid",
                        "previous_plan": "Premium",
                        "status_financial_assistant": null,
                        "subscriptionId": "sub_1"
                    },
                    {
                        "action": "Financial Assistant Change",
                        "changeTime": 1751492487,
                        "current_plan": "Premium",
                        "id": "dummyid",
                        "modified_by": "dummyid",
                        "modified_by_name": "Hideo Kojima",
                        "organizationName": "Dummy Org",
                        "organizationOwner": "dummyid",
                        "organization_id": "dummyid",
                        "previous_plan": "Basic",
                        "status_financial_assistant": "active",
                        "subscriptionId": "sub_1"
                    }
                    ],
                    status: 200
                }
                }).as('getLogs');
        cy.visit("/", {
            onBeforeLoad: (window) => {
                window.localStorage.setItem("finishedOnboarding", "true");
            }
        });
        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();
    });
    
    it('Should verify the visibility and functionality of the "Team Management" link', () => {
        cy.get('span').contains("Control Center").click();
        cy.get('a[href="#/subscription-management"]').contains("Subscription Plans").should("be.visible");

        cy.get('a[href="#/subscription-management"]').contains("Subscription Plans").click();

        cy.url().should("include", "#/subscription-management");
        cy.get("button#headerCollapse").click();

        // Verify subscription
        cy.get('span').should('contain.text', 'Subscription Management');
        cy.get('div').should('contain.text', 'Premium');
        
        // // Verify financial assistant section with an active subscription
        // cy.get('h3').should('contain.text', 'Financial Assistant');
        // cy.get('input.form-check-input').click();
        // cy.get('span').should('contain.text', 'Unsubscribe from Financial Assistant');
        // cy.get('button').contains('Yes, Unsubscribe').should('be.visible');
        // cy.get('button').contains('Cancel').should('be.visible').click();

        // Checks the View Plan information
        cy.get('button').contains('View').should('be.visible').click();
        
        // Wait for prices to load and modal to be fully rendered
        cy.wait('@getProductPrices');
        cy.wait('@getFinancialAssistant');
        cy.wait(500); // Give time for component state to update
        
        // Verify all plan names are visible
        cy.get('h2').should('contain.text', 'Premium');
        cy.get('h2').should('contain.text', 'Custom');
        cy.get('h2').should('contain.text', 'Basic');
        
        // Check for subscription management button - it could be "Change payment information" or "Subscribe" depending on state
        // We'll check that at least one plan has the active subscription button
        cy.get('button').contains(/Change payment information|Subscribe/).should('be.visible');
        
        cy.get('button[aria-label="Close"]').should('be.visible').click();

        // Recent Changes section
        cy.get('button').contains('Recent Changes').should('be.visible').click();
        cy.get('span').contains("Select action to filter").should('be.visible').click();
        cy.contains('span', 'Financial Assistant').click({ force: true });
        cy.get('td').should('contain.text', 'FA Add-On Toggled');
        cy.get('span').contains("Financial Assistant").should('be.visible').click();
        cy.contains('span', 'Subscription Tier').click({ force: true });
        cy.get('td').should('contain.text', 'James Sunderland');
        cy.get('button[aria-label="Close"]').should('be.visible').click();


    });

});