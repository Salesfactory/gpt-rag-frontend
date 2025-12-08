/// <reference types="cypress" />

export function setupTestUserWithoutOrg() {
    cy.intercept("GET", "/api/auth/user", {
        statusCode: 200,
        body: {
            authenticated: true,
            status: "success",
            user: {
                email: "davidmartinez@nightcity.com",
                id: "dummyid",
                name: "David Martinez",
                organizationId: null,
                role: "platformAdmin"
            }
        }
    }).as("getUser");

    cy.intercept('GET', '/api/get-organization-subscription*', {
    statusCode: 200,
    body: {
        id: "org_123456",
        name: "Grove Street Families",
        owner: "David Martinez",
    }
    }).as('getOrgSubscription');

    cy.intercept("GET", "/api/stripe", {
        statusCode: 200,
        body: {
            key: "dummy_stripe_key"
        }
    }).as("getApiKeyPayment");

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
}
