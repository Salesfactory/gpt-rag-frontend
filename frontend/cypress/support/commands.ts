/// <reference types="cypress" />

import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

/* ───────────────────────────── Custom commands ─────────────────────────── */

// Update the command implementations:
Cypress.Commands.add("goHome", () => {
    cy.url().should("include", "#/");
});

Cypress.Commands.add("focusChatInput", () => {
    cy.get("textarea[placeholder*='Write your question']");
});

Cypress.Commands.add("openChat", () => {
    setupTestUserAndOrg();
    cy.visit("/", {
        onBeforeLoad: (window) => {
            window.localStorage.setItem("finishedOnboarding", "true");
        }
    });
    cy.get("#headerCollapse").click();
    cy.contains("a", /ai chat/i).click();
    cy.url().should("include", "#/");
});

Cypress.Commands.add("askChat", (message: string) => {
    cy.get("textarea[placeholder*='Write your question']").type(message);
    cy.get("[aria-label='Ask a question button']").click();
    cy.get("textarea[placeholder*='Write your question']"); // any element to keep chain
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
            goHome(): Chainable<void>;
            focusChatInput(): Chainable<void>;
        }
    }
}
export {};
