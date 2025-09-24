import { setupTestUserAndOrg } from "../fixtures/setupTestUser";

describe("Agent Section Tests", () => {
    beforeEach(() => {
        setupTestUserAndOrg();
        cy.intercept('GET', '/api/getusers*', {
            statusCode: 200,
            body: [
                {
                    id: '1',
                    data: { name: 'Albert Wesker', email: 'albertumbrella@example.com' },
                    role: 'admin',
                    user_account_created: true
                },
                {
                    id: '2',
                    data: { name: 'Alyx Vance', email: 'halflife3isreal@example.com' },
                    role: 'user',
                    user_account_created: true
                },
                {
                    id: '3',
                    user_new: true,
                    nickname: 'Carl Johnson',
                    data: { email: 'grovestreet4life@invited.com' },
                    role: 'platformAdmin',
                    token_expiry: Math.floor(Date.now() / 1000) + 3600,
                    user_account_created: true
                },
                {
                    id: '4',
                    user_new: true,
                    nickname: 'Geralt of Rivia',
                    data: { email: 'imawitcher@expired.com' },
                    role: 'user',
                    token_expiry: Math.floor(Date.now() / 1000) - 3600,
                    user_account_created: true
                },
                {
                    id: '5',
                    user_new: true,
                    nickname: 'Adamska',
                    data: { email: 'rocelot@noaccount.com' },
                    role: 'user',
                    user_account_created: false
                }
            ]
            }).as('getUsers');
        cy.visit("/");
        cy.get("button#headerCollapse").should("be.visible");
        cy.get("button#headerCollapse").click();
    });    

   it('Should verify the visibility and functionality of the "Team Management" link', () => {

        cy.get('span').contains("Control Center").click();
        cy.get('a[href="#/admin"]').contains("Team Management").should("be.visible");

        cy.get('a[href="#/admin"]').contains("Team Management").click();

        cy.url().should("include", "#/admin");
        cy.wait('@getUsers');

        cy.get("button#headerCollapse").click();

        cy.get('button').contains("Create User").should("be.visible");
        cy.get('button').contains("All Roles").should("be.visible");

        //Table content check
        cy.get('span').should('contain.text', 'Albert Wesker');
        cy.get('span').should('contain.text', 'Admin');
        cy.get('span').should('contain.text', 'Active');

        // Check for invited user without account created
        cy.get('span').should('contain.text', 'Adamska');
        cy.get('span').should('contain.text', 'No Account');

        //Test for the Create User Modal
        cy.get('button').contains("Create User").click();
        cy.get('button').contains("Send Invitation").should("be.visible");
        cy.get('button').contains("Cancel").should("be.visible");
        cy.get('button').contains("Send Invitation").click();
        cy.get('div').should('contain.text', 'Please fill in all fields');
        cy.get('button').contains("Cancel").click();

        //Edit User Modal check
        cy.get('button[aria-label="Edit user"]').first().click();
        cy.get('button').contains("Reset Password").should("be.visible");
        cy.get('button').contains("Cancel").click();

        //Delete User Modal check
        cy.get('button[aria-label="Delete user"]').first().click();
        cy.get('button').contains("Yes, Delete").should("be.visible");
        cy.get('button').contains("Cancel").click();

        //Search functionality check
        cy.get('input[placeholder="Search Users..."]').should('be.visible');
        cy.get('input[placeholder="Search Users..."]').type('Alyx');
        cy.get('span').should('contain.text', 'Alyx Vance');
        cy.get('button[aria-label="Clear search"]').should('be.visible').click();

        //Role filter check
        cy.get('button').contains("All Roles").click();
        cy.contains('div', 'Platform Admin').click({ force: true });
        cy.get('span').should('contain.text', 'Platform Admin');
        cy.get('button').contains("Platform Admin").click();
        cy.contains('div', 'All Roles').click({ force: true });
        cy.get('span').should('contain.text', 'Albert Wesker');
    });
});
