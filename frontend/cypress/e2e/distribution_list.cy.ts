import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Agent Section Tests", () => {
    beforeEach(() => {
        setupTestUserAndOrg();
        cy.intercept("GET", /\/api\/getusers\?organizationId=.*/, {
            statusCode: 200,
            body: [
              {
                id: "2476698b-5eac-4016-9bf3-05810031530c",
                active: true,
                data: {
                  name: "Leon S. Kennedy",
                  email: "leonkenedy@gmail.com",
                  organizationId: "0aad82ee-52ec-428e-b211-e9cc34b94457",
                  role: "platformAdmin"
                },
                role: "platformAdmin",
                user_new: false
              },
              {
                id: "8d7b249c-b5b7-4971-ba82-ecaa13dbc7de",
                active: true,
                data: {
                  name: "Ada Wong",
                  email: "ada.wong@gmail.com",
                  organizationId: "0aad82ee-52ec-428e-b211-e9cc34b94457",
                  role: "user"
                },
                role: "user",
                user_new: false
              }
            ]
          }).as("getUsers");
        
        cy.visit("/");
        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();
    });  

    it('Should verify the visibility and functionality of the "Distribution List Page" link', () => {


        //Load the distribution list page
        cy.get('span').contains("Reports").click();
        cy.get('a[href="#/details-settings"]').contains("Sharing & Distribution").should("be.visible");
        cy.get('a[href="#/details-settings"]').contains("Sharing & Distribution").click();


        //Test the filter functionality
        cy.get('button').contains("Filter").click();
        cy.contains('div', 'Platform Admin').click({ force: true });
        cy.get('button').contains("Filter").click();
        cy.contains('div', 'User').click({ force: true });
        cy.get('button').contains("Filter").click();
        cy.contains('div', 'All').click({force: true});


        //Test the search bar functionality
        cy.get('input[placeholder="Search distribution list..."]').should('be.visible');
        cy.get('input[placeholder="Search distribution list..."]').type('Ada');
        cy.get('td').should('contain.text', 'Ada Wong');
        cy.get('input[placeholder="Search distribution list..."]').clear();
    
        //Test Checkbox
        cy.contains('td', 'Ada Wong')
        .parent()
        .within(() => {
        cy.get('input[type="checkbox"]').check().should('be.checked');
        cy.get('input[type="checkbox"]').uncheck().should('not.be.checked');
        });

    });

})