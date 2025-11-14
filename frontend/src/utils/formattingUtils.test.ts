
import { rawThoughtsToString, extractPreContent, parseMeta, extractContextDocs } from './formattingUtils';

const thoughtWithSubqueries = `
		Rewritten Query: Most used social media platforms
		Content:
		{'subquery_1': {
		'query': 'Identify top platforms',
		'documents': [
			{'title': 'Doc A', 'content': 'A content', 'source': 'https://a.example/docA'},
			{'title': 'Doc B', 'content': 'B content', 'source': 'https://b.example/docB'}
		],
		'web_search_performed': False
		},
		'subquery_2': {
		'query': 'Usage statistics',
		'documents': [
			{'title': 'Doc C', 'content': 'C content', 'source': 'https://c.example/docC'}
		],
		'web_search_performed': True
		}}`;

describe('rawThoughtsToString', () => {
	it('returns the string if value is a string', () => {
		expect(rawThoughtsToString('hello')).toBe('hello');
	});
	it('joins array of strings with newlines', () => {
		expect(rawThoughtsToString(['a', 'b', 'c'])).toBe('a\nb\nc');
	});
	it('stringifies primitive elements inside arrays', () => {
		expect(rawThoughtsToString(['a', 1, 'b', null])).toBe('a\n1\nb');
	});
	it('stringifies structured objects with snake_case keys', () => {
		const result = rawThoughtsToString({
			model_used: 'claude-sonnet-3.5',
			query_category: 'General',
			empty_value: ''
		});
		expect(result).toContain('Model Used: claude-sonnet-3.5');
		expect(result).toContain('Query Category: General');
		expect(result).not.toContain('empty value');
	});
	it('returns empty string for non-string, non-array', () => {
		expect(rawThoughtsToString(123)).toBe('');
		expect(rawThoughtsToString(null)).toBe('');
		expect(rawThoughtsToString(undefined)).toBe('');
	});
});

describe('extractPreContent', () => {
	it('extracts pre-content from a realistic thought with subqueries', () => {
		const pre = extractPreContent(thoughtWithSubqueries);
		expect(pre).toMatch(/Rewritten Query: Most used social media platforms/);
		expect(pre).not.toMatch(/subquery_1/);
		expect(pre).not.toMatch(/documents/);
		expect(pre).not.toMatch(/Content:/);
	});
	it('returns empty string for empty input', () => {
		expect(extractPreContent('')).toBe('');
		expect(extractPreContent(undefined as any)).toBe('');
	});
	it('returns text before "Content:" (case-insensitive)', () => {
		expect(extractPreContent('Header\nContent: body')).toBe('Header\n');
		expect(extractPreContent('Header\ncontent: body')).toBe('Header\n');
		expect(extractPreContent('Header\nCONTENT: body')).toBe('Header\n');
	});
	it('returns full text if "Content:" not found', () => {
		expect(extractPreContent('No content label here')).toBe('No content label here');
	});
});

describe('parseMeta', () => {
	it('extracts commonly used meta fields when present', () => {
		const text = `Model Used: gpt-4\nTool Selected: search\nOriginal Query: hola\nMCP Tools Used: foo\nQuery Category: General\nRewritten Query: hi`;
		const meta = parseMeta(text);
		expect(meta.modelUsed).toBe('gpt-4');
		expect(meta.toolSelected).toBe('search');
		expect(meta.originalQuery).toBe('hola');
		expect(meta.mcpToolsUsed).toBe('foo');
		expect(meta.queryCategory).toBe('General');
		expect(meta.rewrittenQuery).toBe('hi');
	});
	it('returns undefined for fields that do not exist', () => {
		const text = 'Model Used: gpt-4';
		const meta = parseMeta(text);
		expect(meta.modelUsed).toBe('gpt-4');
		expect(meta.toolSelected).toBeUndefined();
		expect(meta.queryCategory).toBeUndefined();
	});
	it('handles alternate labels and mixed case', () => {
		const text = 'last mcp tool used :  data_analyst  / Number of documents retrieved:3';
		const meta = parseMeta(text);
		expect(meta.mcpToolUsed).toBe('data_analyst');
		expect(meta.numberOfDocumentsRetrieved).toBe('3');
	});
});

describe('extractContextDocs', () => {
	it('handles agentic search style objects with content and source', () => {
		const docs = extractContextDocs({
			model_used: 'claude-sonnet',
			context_docs: [
				{ content: 'Example video title will go here for this video', source: 'https://www.wcnc.com/article/news/local/charlotte' },
				{ content: 'In 2023, Charlotte had a population of 886k', source: 'https://datausa.io/profile/geo/charlotte-nc/' }
			]
		} as any);
		expect(docs).toHaveLength(2);
		expect(docs[0]).toEqual({
			content: 'Example video title will go here for this video',
			source: 'https://www.wcnc.com/article/news/local/charlotte'
		});
		expect(docs[1].source).toContain('datausa.io/profile/geo/charlotte-nc');
	});

	it('handles context docs represented as plain strings', () => {
		const docs = extractContextDocs({
			context_docs: [
				"I'll help you create a line chart showing revenue trends...",
				"Here is the graph/visualization link: organization_files/..."
			]
		} as any);
		expect(docs).toHaveLength(2);
		expect(docs[0].content).toContain('line chart');
		expect(docs[1].content).toContain('organization_files');
	});

	it('returns empty array when no context docs exist', () => {
		expect(extractContextDocs(null as any)).toEqual([]);
		expect(extractContextDocs({} as any)).toEqual([]);
	});
});
