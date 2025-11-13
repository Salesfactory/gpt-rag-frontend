/// <reference types="cypress" />
export {};

/**
 * Helper to stub a streaming response with thinking markers
 *
 * The backend sends thinking content wrapped in __THINKING__ markers like:
 * __THINKING__{"type":"thinking","content":"Claude is thinking...","timestamp":123}__THINKING__
 */
function stubStreamWithThinking(alias: string, body: string) {
    cy.intercept("POST", "/stream_chatgpt", {
        statusCode: 200,
        headers: { "content-type": "text/event-stream" },
        body
    }).as(alias);

    // Mock other required API calls
    cy.intercept('GET', '/api/get-storage-account', { statusCode: 200, body: {} });
    cy.intercept('GET', '/api/get-blob', { statusCode: 200, body: {} });
    cy.intercept('GET', '/api/settings', { statusCode: 200, body: {} });
    cy.intercept('GET', '/api/get-user-organizations', { statusCode: 200, body: {} });
    cy.intercept('GET', '/api/chat-history', { statusCode: 200, body: {} });
    cy.intercept('GET', '/api/getusers*', { statusCode: 200, body: {} });
}

describe("Thinking Streaming - Thinking Marker Parsing", () => {
    beforeEach(() => cy.openChat());

    it("should parse and display thinking content from __THINKING__ markers", () => {
        const thinkingMarker = '__THINKING__{"type":"thinking","content":"Analyzing the user\'s question...","timestamp":1234567890}__THINKING__';
        const responseBody = `{"conversation_id":"test-thinking-1"}${thinkingMarker}Here is the final answer.`;

        stubStreamWithThinking("thinkingMarker", responseBody);

        cy.askChat("Test thinking");
        cy.wait("@thinkingMarker");

        // Verify thinking container exists with correct data-cy attribute
        cy.dataCy("chat-msg")
            .find('[data-cy="thinking-container"]')
            .should('exist')
            .should('have.class', /thinkingContainer/);

        // Verify thinking content is displayed inside the thinking container
        cy.dataCy("thinking-container")
            .should('contain.text', "Analyzing the user's question...")
            .should('contain.text', "Freddaid's Thinking Process");

        // Verify the main answer is also displayed (outside the details element)
        cy.dataCy("chat-msg")
            .should('contain.text', 'Here is the final answer.');
    });

    it("should accumulate multiple thinking chunks in the same response", () => {
        const thinking1 = '__THINKING__{"type":"thinking","content":"First thought: ","timestamp":1}__THINKING__';
        const thinking2 = '__THINKING__{"type":"thinking","content":"Second thought: ","timestamp":2}__THINKING__';
        const thinking3 = '__THINKING__{"type":"thinking","content":"Third thought.","timestamp":3}__THINKING__';
        const responseBody = `{"conversation_id":"test-accumulate"}${thinking1}${thinking2}${thinking3}Final answer here.`;

        stubStreamWithThinking("accumulateThinking", responseBody);

        cy.askChat("Multiple thoughts");
        cy.wait("@accumulateThinking");

        // All thinking content should be accumulated in the details element
        cy.dataCy("chat-msg")
            .find('details')
            .should('contain.text', 'First thought: ')
            .and('contain.text', 'Second thought: ')
            .and('contain.text', 'Third thought.');
    });

    it("should handle data analyst content messages in thinking section", () => {
        const dataAnalystMarker = '__THINKING__{"type":"data_analyst_content","content":"Running data analysis...","timestamp":123}__THINKING__';
        const responseBody = `{"conversation_id":"test-data-analyst"}${dataAnalystMarker}Analysis complete.`;

        stubStreamWithThinking("dataAnalystThinking", responseBody);

        cy.askChat("Analyze data");
        cy.wait("@dataAnalystThinking");

        // Data analyst content should appear in thinking container
        cy.dataCy("chat-msg")
            .find('details')
            .should('contain.text', 'Running data analysis...');
    });

    it("should display thinking container with correct summary text", () => {
        const thinkingMarker = '__THINKING__{"type":"thinking","content":"Processing...","timestamp":123}__THINKING__';
        const responseBody = `{"conversation_id":"test-summary"}${thinkingMarker}Done.`;

        stubStreamWithThinking("thinkingSummary", responseBody);

        cy.askChat("Test summary");
        cy.wait("@thinkingSummary");

        // Verify summary text is correct
        cy.dataCy("chat-msg")
            .find('details summary')
            .should('contain.text', "Freddaid's Thinking Process");
    });
});

describe("Thinking Streaming - UI Interaction", () => {
    beforeEach(() => cy.openChat());

    it("should allow expanding and collapsing the thinking container", () => {
        const thinkingMarker = '__THINKING__{"type":"thinking","content":"Thinking content here","timestamp":123}__THINKING__';
        const responseBody = `{"conversation_id":"test-collapse"}${thinkingMarker}Answer.`;

        stubStreamWithThinking("expandCollapse", responseBody);

        cy.askChat("Test expand/collapse");
        cy.wait("@expandCollapse");

        // Initially should be visible (open during generation)
        cy.dataCy("thinking-container")
            .should('exist');

        // Click summary to collapse
        cy.dataCy("thinking-container")
            .find('summary')
            .click();

        // Content should be collapsed
        cy.dataCy("thinking-container")
            .should('not.have.attr', 'open');

        // Click summary to expand again
        cy.dataCy("thinking-container")
            .find('summary')
            .click();

        // Content should be expanded again
        cy.dataCy("thinking-container")
            .should('have.attr', 'open');
    });

    it("should not display thinking container when there is no thinking content", () => {
        const responseBody = `{"conversation_id":"test-no-thinking"}Simple answer without any thinking.`;

        stubStreamWithThinking("noThinking", responseBody);

        cy.askChat("No thinking");
        cy.wait("@noThinking");

        // Thinking container should not exist
        cy.dataCy("thinking-container")
            .should('not.exist');

        // Answer should still be displayed
        cy.dataCy("chat-msg")
            .should('contain.text', 'Simple answer without any thinking.');
    });

    it("should not display thinking container for empty thinking content", () => {
        const emptyThinking = '__THINKING__{"type":"thinking","content":"","timestamp":123}__THINKING__';
        const responseBody = `{"conversation_id":"test-empty-thinking"}${emptyThinking}Answer here.`;

        stubStreamWithThinking("emptyThinking", responseBody);

        cy.askChat("Empty thinking");
        cy.wait("@emptyThinking");

        // Thinking container should not exist for empty content
        cy.dataCy("thinking-container")
            .should('not.exist');
    });

    it("should not display thinking container for whitespace-only thinking content", () => {
        const whitespaceThinking = '__THINKING__{"type":"thinking","content":"   \\n  \\t  ","timestamp":123}__THINKING__';
        const responseBody = `{"conversation_id":"test-whitespace"}${whitespaceThinking}Answer.`;

        stubStreamWithThinking("whitespaceThinking", responseBody);

        cy.askChat("Whitespace thinking");
        cy.wait("@whitespaceThinking");

        // Thinking container should not exist for whitespace-only content
        cy.dataCy("thinking-container")
            .should('not.exist');
    });
});

describe("Thinking Streaming - Progress and Thinking Coexistence", () => {
    beforeEach(() => cy.openChat());

    it("should display both progress state and thinking content", () => {
        const progressMarker = '__PROGRESS__{"type":"progress","message":"Searching documents...","step":"search","progress":50,"timestamp":1}__PROGRESS__';
        const thinkingMarker = '__THINKING__{"type":"thinking","content":"Evaluating search results...","timestamp":2}__THINKING__';
        const responseBody = `{"conversation_id":"test-progress-thinking"}${progressMarker}${thinkingMarker}Final answer.`;

        stubStreamWithThinking("progressAndThinking", responseBody);

        cy.askChat("Progress and thinking");
        cy.wait("@progressAndThinking");

        // Progress should be displayed
        cy.dataCy("chat-msg")
            .should('contain.text', 'Searching documents...');

        // Thinking should also be displayed
        cy.dataCy("chat-msg")
            .find('details')
            .should('contain.text', 'Evaluating search results...');
    });

    it("should clear progress state when actual content arrives but keep thinking", () => {
        const progressMarker = '__PROGRESS__{"type":"progress","message":"Processing...","timestamp":1}__PROGRESS__';
        const thinkingMarker = '__THINKING__{"type":"thinking","content":"Thinking deeply...","timestamp":2}__THINKING__';
        const responseBody = `{"conversation_id":"test-clear-progress"}${progressMarker}${thinkingMarker}Content starts here.`;

        stubStreamWithThinking("clearProgress", responseBody);

        cy.askChat("Clear progress");
        cy.wait("@clearProgress");

        // Final answer should be visible
        cy.dataCy("chat-msg")
            .should('contain.text', 'Content starts here.');

        // Thinking should remain visible
        cy.dataCy("chat-msg")
            .find('details')
            .should('contain.text', 'Thinking deeply...');
    });
});

describe("Thinking Streaming - Integration with Citations and Thoughts", () => {
    beforeEach(() => cy.openChat());

    it("should display thinking content alongside citations", () => {
        const thinkingMarker = '__THINKING__{"type":"thinking","content":"Analyzing cited documents...","timestamp":1}__THINKING__';
        const responseBody = `{"conversation_id":"test-citations","thoughts":["doc analysis"]}${thinkingMarker}The company was founded in 2010 [[1]](Company.pdf).`;

        stubStreamWithThinking("thinkingWithCitations", responseBody);

        cy.askChat("Citations and thinking");
        cy.wait("@thinkingWithCitations");

        // Thinking content should be visible
        cy.dataCy("chat-msg")
            .find('details')
            .should('contain.text', 'Analyzing cited documents...');

        // Citations should be visible
        cy.dataCy("sources-section")
            .should('be.visible')
            .should('contain.text', 'Company.pdf');

        // Thought process button should be enabled
        cy.get("button[title='Show thought process']")
            .should('be.visible')
            .and('not.be.disabled');
    });

    it("should handle mixed content: thinking, progress, citations, and final answer", () => {
        const progressMarker = '__PROGRESS__{"type":"progress","message":"Searching...","progress":30}__PROGRESS__';
        const thinkingMarker1 = '__THINKING__{"type":"thinking","content":"Step 1: Retrieve documents. "}__THINKING__';
        const thinkingMarker2 = '__THINKING__{"type":"thinking","content":"Step 2: Analyze content."}__THINKING__';
        const responseBody = `{"conversation_id":"test-mixed","thoughts":["analysis"]}${progressMarker}${thinkingMarker1}${thinkingMarker2}Analysis shows [[1]](Report.pdf) key findings.`;

        stubStreamWithThinking("mixedContent", responseBody);

        cy.askChat("Mixed content");
        cy.wait("@mixedContent");

        // All elements should be present
        cy.dataCy("chat-msg").within(() => {
            // Thinking content (accumulated)
            cy.get('details').should('contain.text', 'Step 1: Retrieve documents. Step 2: Analyze content.');

            // Final answer
            cy.contains('Analysis shows').should('be.visible');
        });

        // Citations
        cy.dataCy("sources-section")
            .should('contain.text', 'Report.pdf');

        // Thought process button
        cy.get("button[title='Show thought process']")
            .should('not.be.disabled');
    });
});

describe("Thinking Streaming - New Chat Behavior", () => {
    beforeEach(() => cy.openChat());

    it("should clear thinking content when starting a new chat", () => {
        // First message with thinking
        const thinking1 = '__THINKING__{"type":"thinking","content":"First chat thinking"}__THINKING__';
        const response1 = `{"conversation_id":"chat-1"}${thinking1}First answer.`;

        stubStreamWithThinking("firstChat", response1);

        cy.askChat("First question");
        cy.wait("@firstChat");

        // Verify thinking is displayed
        cy.dataCy("chat-msg")
            .find('details')
            .should('contain.text', 'First chat thinking');

        // Click new chat button
        cy.get('button[aria-label="Start a new chat"]').click();

        // Verify chat is cleared
        cy.dataCy("chat-msg").should('not.exist');

        // Ask a new question without thinking
        const response2 = `{"conversation_id":"chat-2"}Second answer without thinking.`;
        stubStreamWithThinking("secondChat", response2);

        cy.askChat("Second question");
        cy.wait("@secondChat");

        // Verify no thinking container from previous chat
        cy.dataCy("chat-msg")
            .find('details')
            .should('not.exist');

        // Verify new answer is displayed
        cy.dataCy("chat-msg")
            .should('contain.text', 'Second answer without thinking.');
    });
});

describe("Thinking Streaming - Data Analyst Mode", () => {
    beforeEach(() => cy.openChat());

    it("should display data analyst content in thinking section when data analyst mode is active", () => {
        const dataAnalystContent = '__THINKING__{"type":"data_analyst_content","content":"Executing SQL query: SELECT * FROM users..."}__THINKING__';
        const responseBody = `{"conversation_id":"test-da-mode"}${dataAnalystContent}Query results: 1000 users found.`;

        stubStreamWithThinking("dataAnalystMode", responseBody);

        // Note: Data analyst mode button should be visible
        // The test assumes the button is available in the UI
        cy.get('[data-testid="data-analyst-button"]').should('exist');

        cy.askChat("Analyze user data");
        cy.wait("@dataAnalystMode");

        // Data analyst content should be in thinking section
        cy.dataCy("chat-msg")
            .find('details')
            .should('contain.text', 'Executing SQL query');

        // Final answer should be displayed
        cy.dataCy("chat-msg")
            .should('contain.text', 'Query results: 1000 users found.');
    });

    it("should accumulate both thinking and data analyst content", () => {
        const thinking = '__THINKING__{"type":"thinking","content":"Planning query... "}__THINKING__';
        const dataAnalyst = '__THINKING__{"type":"data_analyst_content","content":"Running query... "}__THINKING__';
        const responseBody = `{"conversation_id":"test-both"}${thinking}${dataAnalyst}Done.`;

        stubStreamWithThinking("bothTypes", responseBody);

        cy.askChat("Both types");
        cy.wait("@bothTypes");

        // Both should be accumulated in thinking container
        cy.dataCy("chat-msg")
            .find('details')
            .should('contain.text', 'Planning query... ')
            .and('contain.text', 'Running query...');
    });
});

describe("Thinking Streaming - Edge Cases", () => {
    beforeEach(() => cy.openChat());

    it("should handle malformed thinking markers gracefully", () => {
        // Malformed marker (invalid JSON)
        const malformed = '__THINKING__{invalid json}__THINKING__';
        const responseBody = `{"conversation_id":"test-malformed"}${malformed}Answer despite malformed marker.`;

        stubStreamWithThinking("malformedMarker", responseBody);

        cy.askChat("Malformed thinking");
        cy.wait("@malformedMarker");

        // Should not break, answer should still display
        cy.dataCy("chat-msg")
            .should('contain.text', 'Answer despite malformed marker.');

        // Malformed content should not appear
        cy.dataCy("chat-msg")
            .should('not.contain.text', 'invalid json');
    });

    it("should handle thinking markers without required fields", () => {
        const incompleteMarker = '__THINKING__{"type":"thinking"}__THINKING__';
        const responseBody = `{"conversation_id":"test-incomplete"}${incompleteMarker}Answer.`;

        stubStreamWithThinking("incompleteMarker", responseBody);

        cy.askChat("Incomplete thinking");
        cy.wait("@incompleteMarker");

        // Should handle gracefully - no thinking container for empty content
        cy.dataCy("chat-msg")
            .find('details')
            .should('not.exist');

        // Answer should still display
        cy.dataCy("chat-msg")
            .should('contain.text', 'Answer.');
    });

    it("should handle very long thinking content", () => {
        const longThinking = "This is a very long thinking process that goes on and on and on. ".repeat(50);
        const thinkingMarker = `__THINKING__{"type":"thinking","content":"${longThinking}"}__THINKING__`;
        const responseBody = `{"conversation_id":"test-long"}${thinkingMarker}Short answer.`;

        stubStreamWithThinking("longThinking", responseBody);

        cy.askChat("Long thinking");
        cy.wait("@longThinking");

        // Long thinking content should be displayed
        cy.dataCy("chat-msg")
            .find('details')
            .should('contain.text', 'This is a very long thinking process');

        // Should be able to collapse it
        cy.dataCy("chat-msg")
            .find('details summary')
            .click();

        cy.dataCy("chat-msg")
            .find('details')
            .should('not.have.attr', 'open');
    });

    it("should strip thinking markers from the final answer text", () => {
        const thinkingMarker = '__THINKING__{"type":"thinking","content":"Internal thought"}__THINKING__';
        const responseBody = `{"conversation_id":"test-strip"}${thinkingMarker}Final answer text.`;

        stubStreamWithThinking("stripMarkers", responseBody);

        cy.askChat("Strip markers");
        cy.wait("@stripMarkers");

        // Main answer should not contain marker syntax
        cy.dataCy("chat-msg")
            .should('not.contain.text', '__THINKING__');

        // Thinking content should be in details element only
        cy.dataCy("chat-msg")
            .find('details')
            .should('contain.text', 'Internal thought');

        // Final answer should be clean
        cy.dataCy("chat-msg")
            .should('contain.text', 'Final answer text.');
    });
});
