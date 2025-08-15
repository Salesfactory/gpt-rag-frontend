
import { rawThoughtsToString, extractPreContent, parseMeta } from './formattingUtils';

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
	it('ignores non-string elements in array', () => {
		expect(rawThoughtsToString(['a', 1, 'b', null])).toBe('a\nb');
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
	it('extracts all meta fields if present', () => {
		const text = `Model Used: gpt-4\nTool Selected: search\nOriginal Query: hola\nMCP Tools Used: foo`;
		expect(parseMeta(text)).toEqual({
			modelUsed: 'gpt-4',
			toolSelected: 'search',
			originalQuery: 'hola',
			mcpToolsUsed: 'foo',
		});
	});
	it('returns undefined for missing fields', () => {
		const text = 'Model Used: gpt-4';
		expect(parseMeta(text)).toEqual({
			modelUsed: 'gpt-4',
			toolSelected: undefined,
			originalQuery: undefined,
			mcpToolsUsed: undefined,
		});
	});
	it('handles extra whitespace and case', () => {
		const text = 'model used :  gpt-4  / Tool Selected:search';
		expect(parseMeta(text)).toEqual({
			modelUsed: 'gpt-4',
			toolSelected: 'search',
			originalQuery: undefined,
			mcpToolsUsed: undefined,
		});
	});
});
