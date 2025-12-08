import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Agent Section Tests", () => {
    beforeEach(() => {
        setupTestUserAndOrg();
    });  

    it('Should fails if the user is registered but can login into his organization ', () => {
        cy.visit("/", {
            onBeforeLoad: (window) => {
                window.localStorage.setItem("finishedOnboarding", "true");
            }
        });
        cy.get('._text1_16056_87').should("not.exist")
    });

})