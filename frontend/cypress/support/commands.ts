/// <reference types="cypress" />

import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

/* ───────────────────────────── Custom commands ─────────────────────────── */

Cypress.Commands.add("openChat", (): Cypress.Chainable<Element> => {
    setupTestUserAndOrg();
    cy.visit("/");
    cy.get("#headerCollapse").click();
    cy.contains("a", /ai chat/i).click();
    return cy.url().should("include", "#/");
});

Cypress.Commands.add("askChat", (message: string): Cypress.Chainable<Element> => {
    cy.get("textarea[placeholder*='Write your question']").type(message);
    cy.get("[aria-label='Ask a question button']").click();
    return cy.get("textarea[placeholder*='Write your question']"); // any element to keep chain
});

/**
 * Shorthand for `[data-cy="value"]`.
 * We keep the return type `Chainable<JQuery<HTMLElement>>` to satisfy TS.
 */
Cypress.Commands.add("dataCy", (value: string): Cypress.Chainable<JQuery<HTMLElement>> => cy.get(`[data-cy="${value}"]`));

/* ──────────────────────────── TS augmentation ──────────────────────────── */
declare global {
    namespace Cypress {
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
        interface Chainable<Subject = any> {
            openChat(): Chainable<Element>;
            askChat(message: string): Chainable<Element>;
            dataCy(value: string): Chainable<JQuery<HTMLElement>>;
        }
    }
}
export {};
