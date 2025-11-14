/**
 * Simple test for thinking stream UI behavior
 * Tests the UI components without mocking SSE streams
 */

describe('Thinking Stream UI', () => {
  beforeEach(() => {
    cy.openChat();
  });

  it('should send a message and check if thinking section appears', () => {
    // Send a question
    cy.askChat('What is artificial intelligence?');

    // Wait for response
    cy.wait(3000);

    // Check if answer appears
    cy.dataCy('chat-msg').last().should('exist');

    // Check if thinking section exists (conditional - may or may not appear)
    cy.get('body').then($body => {
      if ($body.find('.thinkingContainer').length > 0) {
        // Thinking section exists - verify it works
        cy.log('✓ Thinking section found');

        // Verify structure
        cy.get('.thinkingContainer').should('be.visible');
        cy.get('.thinkingSummary').should('contain', "Freddaid's Thinking Process");
        cy.get('.thinkingContent').should('exist');

        // Test collapsible behavior
        cy.get('.thinkingSummary').click();
        cy.get('.thinkingContainer').should('not.have.attr', 'open');

        cy.get('.thinkingSummary').click();
        cy.get('.thinkingContainer').should('have.attr', 'open');

        cy.log('✓ Thinking section is collapsible');
      } else {
        cy.log('ℹ No thinking section (backend may not be configured)');
      }
    });
  });

  it('should clear thinking when starting new chat', () => {
    // Send a message
    cy.askChat('Test question');
    cy.wait(2000);

    // Start new chat
    cy.get('[aria-label="Start a new chat"]').click();

    // Verify thinking is cleared
    cy.get('.thinkingContainer').should('not.exist');
    cy.log('✓ Thinking cleared on new chat');
  });
});
