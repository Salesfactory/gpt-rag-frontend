import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Chat Settings – Detail Level", () => {
    beforeEach(() => {
        setupTestUserAndOrg();
        cy.window().then(w => w.localStorage.clear());

        cy.intercept("GET", "**/api/settings*", {
            statusCode: 200,
            body: {
                model: "gpt-4.1",
                temperature: 0.2,
                font_size: "16",
                font_family: "Arial",
                detail_level: "balanced"
            }
        }).as("getSettings");

        cy.visit("/");
        cy.get('[data-testid="settings-button"]').should("be.visible").click();
        cy.wait("@getSettings");
        cy.contains("Chat Settings").should("be.visible");
        cy.contains("Detail Level").should("be.visible");
    });

    it("shows Balanced by default (from backend)", () => {
        cy.get('[data-testid="detail-opt-balanced"]').should("have.attr", "aria-pressed", "true");
        cy.get('[data-testid="detail-opt-succinct"]').should("have.attr", "aria-pressed", "false");
        cy.get('[data-testid="detail-opt-detailed"]').should("have.attr", "aria-pressed", "false");
    });

    it("allows switching to Detailed and highlights the correct button", () => {
        cy.get('[data-testid="detail-opt-detailed"]').scrollIntoView().click();
        cy.get('[data-testid="detail-opt-detailed"]').should("have.attr", "aria-pressed", "true");
        cy.get('[data-testid="detail-opt-balanced"]').should("have.attr", "aria-pressed", "false");
        cy.get('[data-testid="detail-opt-succinct"]').should("have.attr", "aria-pressed", "false");
    });

    it("sends correct value to backend and persists to localStorage on save", () => {
        cy.intercept("POST", "**/api/settings*", req => {
            expect(req.body.detail_level).to.eq("detailed");
            req.reply({ statusCode: 200, body: { ...req.body } });
        }).as("postSettings");

        cy.get('[data-testid="detail-opt-detailed"]').click();
        cy.get('[aria-label="Save settings"]').should("be.enabled").click();
        cy.get('[data-testid="confirm-save"]').should("be.visible").click();

        cy.wait("@postSettings");
        cy.get('[data-testid="settings-overlay"]').should("not.exist");

        cy.window().then(w => {
            expect(w.localStorage.getItem("detail_level")).to.eq("detailed");
        });

        cy.contains("Settings saved. Creativity will apply to new messages.").should("be.visible");
    });

    const closeIfOpen = () => {
        cy.get("body").then($body => {
            if ($body.find('[data-testid="settings-overlay"]').length) {
                cy.get('button[aria-label="hide button"]').click({ force: true });
                cy.get('[data-testid="settings-overlay"]').should("not.exist");
            }
        });
    };

    const openSettings = () => {
        closeIfOpen();

        cy.get('[data-testid="settings-button"]').click({ force: true });
        cy.wait("@getSettings");
        cy.contains("Chat Settings").should("be.visible");
        cy.contains("Detail Level").scrollIntoView();
    };

    it("verifies UI→API mapping for all 3 options", () => {
        const cases: Array<{ testid: string; api: "brief" | "balanced" | "detailed" }> = [
            { testid: "detail-opt-succinct", api: "brief" },
            { testid: "detail-opt-balanced", api: "balanced" },
            { testid: "detail-opt-detailed", api: "detailed" }
        ];

        cases.forEach(({ testid, api }) => {
            cy.intercept("POST", "**/api/settings*", req => {
                expect(req.body.detail_level).to.eq(api);
                req.reply({ statusCode: 200, body: { ...req.body } });
            }).as("save-" + api);

            openSettings();

            cy.get(`[data-testid="${testid}"]`).scrollIntoView().click();
            cy.get('[aria-label="Save settings"]').click();
            cy.get('[data-testid="confirm-save"]').should("be.visible").click();

            cy.wait("@save-" + api);

            cy.get('[data-testid="settings-overlay"]').should("not.exist");

            cy.window().then(w => {
                expect(w.localStorage.getItem("detail_level")).to.eq(api);
            });
        });
    });

    it("falls back to Balanced when GET fails (render + default)", () => {
        cy.get('button[aria-label="hide button"]').click();
        cy.window().then(w => w.localStorage.removeItem("detail_level"));

        cy.intercept("GET", "**/api/settings*", { statusCode: 500 }).as("getSettingsFail");

        cy.get('[data-testid="settings-button"]').click();
        cy.wait("@getSettingsFail");

        cy.get('[data-testid="detail-opt-balanced"]').should("have.attr", "aria-pressed", "true");
    });
});
