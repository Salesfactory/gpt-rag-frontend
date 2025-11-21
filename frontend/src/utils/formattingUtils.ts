import DOMPurify from 'dompurify';
import type { ThoughtProcess } from '../api';

// Utility functions for formatting and sanitizing data from the thoughts

// Detects the content type: ‘html’, ‘markdown’, or 'text'
export const detectContentType = (input: string): 'html' | 'markdown' | 'text' => {
  if (!input) return 'text';
  // Detects HTML by tags
  if (/<[a-z][\s\S]*>/i.test(input)) return 'html';
  // Detects Markdown by common patterns
  const mdPatterns = [
    /^\s{0,3}(#{1,6})\s.+/m,
    /\*\*[^*]+\*\*/,
    /\*[^*]+\*/,
    /\[[^\]]+\]\([^\)]+\)/,
    /^\s*[-*+]\s+/m,
    /`[^`]+`/,
    /```[\s\S]*?```/
  ];
  if (mdPatterns.some(re => re.test(input))) return 'markdown';
  return 'text';
};

export interface ContextDoc {
  content: string;
  source?: string;
}

export const rawThoughtsToString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) {
    return value
      .map(entry => {
        if (typeof entry === 'string') return entry;
        if (entry == null) return '';
        if (Array.isArray(entry) || isPlainObject(entry)) {
          return rawThoughtsToString(entry);
        }
        return String(entry);
      })
      .filter(Boolean)
      .join('\n');
  }
  if (isPlainObject(value)) {
    const sections = Object.entries(value)
      .map(([key, val]) => {
        if (isContextDocsKey(key)) return '';
        const formattedValue = formatThoughtValue(val);
        if (!formattedValue) return '';
        const label = mapThoughtKeyToLabel(key);
        return `${label}: ${formattedValue}`.trim();
      })
      .filter(Boolean);
    return sections.join('\n');
  }
  return '';
};

export const extractPreContent = (text: string): string => {
  if (!text) return '';
  const idx = text.search(/\bContent\s*:/i);
  return idx === -1 ? text : text.slice(0, idx);
};

export const parseMeta = (text: string) => {
  const pick = (label: string): string | undefined => {
    const re = new RegExp(label + '\\s*:\\s*([^/\\r\\n]+)', 'i');
    const match = text.match(re);
    return match ? match[1].trim() : undefined;
  };
  const pickAny = (...labels: string[]): string | undefined => {
    for (const label of labels) {
      const match = pick(label);
      if (match) return match;
    }
    return undefined;
  };
  return {
    modelUsed: pickAny('Model\\s*Used'),
    toolSelected: pickAny('Tool\\s*Selected'),
    queryCategory: pickAny('Query\\s*Category'),
    requiredRetrieval: pickAny('Required\\s*Retrieval'),
    numberOfDocumentsRetrieved: pickAny('Number\\s*of\\s*documents\\s*retrieved', 'Context\\s*documents\\s*retrieved'),
    mcpToolUsed: pickAny('MCP\\s*Tool\\s*Used', 'Last\\s*MCP\\s*Tool\\s*Used'),
    mcpToolsUsed: pickAny('MCP\\s*Tools\\s*Used'),
    agentType: pickAny('Agent\\s*Type'),
    contextRetrieved: pickAny('Context\\s*Retrieved\\s*using\\s*the\\s*rewritten\\s*query'),
  };
};

export const toPlainText = (input: string | undefined | null): string => {
  if (!input) return '';
  const contentType = detectContentType(String(input));
  let src = String(input);
  if (contentType === 'html') {
    src = src.replace(/<\s*style\b[^>]*>[\s\S]*?<\s*\/\s*style\s*>/gi, '');
    src = src.replace(/<\s*script\b[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '');
    src = src.replace(/\/\*[\s\S]*?\*\//g, '');
    src = src.replace(/[^\{]+\{[^}]*;[^}]*\}/g, '');
    src = src
      .replace(/<\s*br\s*\/\?\s*>/gi, '\n')
      .replace(/<\s*\/p\s*>/gi, '\n')
      .replace(/<\s*p\b[^>]*>/gi, '');
    let stripped = DOMPurify.sanitize(src, { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
    if (typeof window !== 'undefined') {
      const textarea = document.createElement('textarea');
      textarea.innerHTML = stripped;
      stripped = textarea.value;
    }
    stripped = stripped.replace(/(^|\s)(?!(?:https?:\/\/))(?:www\.|\.)?[a-z0-9-]+(?:\.[a-z0-9-]+)+(?:\/[\w\-./?%&=+#@]*)?/gi, '$1');
    stripped = stripped.replace(/"?>/g, '');
    return stripped.replace(/\u00A0/g, ' ').replace(/\s+\n/g, '\n').trim();
  } else if (contentType === 'markdown') {
    src = src.replace(/^\s{0,3}#{1,6}\s+/gm, '');
    src = src.replace(/\*\*([^*]+)\*\*/g, '$1');
    src = src.replace(/\*([^*]+)\*/g, '$1');
    src = src.replace(/\[([^\]]+)\]\(([^\)]+)\)/g, '$1');
    src = src.replace(/^\s*[-*+]\s+/gm, '');
    src = src.replace(/`([^`]+)`/g, '$1');
    src = src.replace(/```[\s\S]*?```/g, '');
    return src.replace(/\u00A0/g, ' ').replace(/\s+\n/g, '\n').trim();
  } else {
    return src.replace(/\u00A0/g, ' ').replace(/\s+\n/g, '\n').trim();
  }
};

export const sourcePlain = (value: unknown): string => {
  if (value == null) return '';
  let text = DOMPurify.sanitize(String(value), { ALLOWED_TAGS: [], ALLOWED_ATTR: [] });
  if (typeof window !== 'undefined') {
    const textarea = document.createElement('textarea');
    textarea.innerHTML = text;
    text = textarea.value;
  }
  return text.replace(/\u00A0/g, ' ').trim();
};

export const extractContextDocs = (thoughts: ThoughtProcess): ContextDoc[] => {
  if (!thoughts) return [];

  const docs: ContextDoc[] = [];

  const inspect = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      value.forEach(entry => {
        if (isPlainObject(entry) && hasContextDocs(entry)) {
          docs.push(...normalizeContextDocs((entry as any).context_docs));
        } else {
          inspect(entry);
        }
      });
      return;
    }
    if (isPlainObject(value) && hasContextDocs(value)) {
      docs.push(...normalizeContextDocs((value as any).context_docs));
    }
  };

  inspect(thoughts);

  return docs;
};

const CONTEXT_DOC_KEY = 'context_docs';

const THOUGHT_LABEL_OVERRIDES: Record<string, string> = {
  model_used: 'Model Used',
  model: 'Model Used',
  query_category: 'Query Category',
  mcp_tool_used: 'MCP Tool Used',
  last_mcp_tool_used: 'MCP Tool Used',
  mcp_tools_used: 'MCP Tools Used',
  tool_selected: 'Tool Selected',
  context_retrieved: 'Context Retrieved using the rewritten query',
  context_documents_retrieved: 'Number of documents retrieved',
  number_of_documents_retrieved: 'Number of documents retrieved',
  agent_type: 'Agent Type'
};

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function hasContextDocs(value: Record<string, unknown>): boolean {
  return CONTEXT_DOC_KEY in value;
}

function isContextDocsKey(key: string): boolean {
  return key.toLowerCase() === CONTEXT_DOC_KEY;
}

function mapThoughtKeyToLabel(key: string): string {
  const normalized = key.toLowerCase();
  if (THOUGHT_LABEL_OVERRIDES[normalized]) {
    return THOUGHT_LABEL_OVERRIDES[normalized];
  }
  const withSpaces = key
    .replace(/[_-]+/g, ' ')
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .trim();
  if (!withSpaces) {
    return key;
  }
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

function formatThoughtValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' || typeof value === 'boolean') return String(value);
  if (Array.isArray(value)) {
    const joined = value.map(item => formatThoughtValue(item)).filter(Boolean).join(', ');
    return joined;
  }
  if (isPlainObject(value)) {
    if (hasContextDocs(value)) return '';
    const nested = Object.entries(value)
      .map(([key, val]) => {
        const formatted = formatThoughtValue(val);
        if (!formatted) return '';
        return `${mapThoughtKeyToLabel(key)}: ${formatted}`;
      })
      .filter(Boolean)
      .join('; ');
    return nested;
  }
  return String(value);
}

function normalizeContextDocs(value: unknown): ContextDoc[] {
  if (!value) return [];
  if (Array.isArray(value)) {
    return value
      .map(entry => normalizeContextDoc(entry))
      .filter((doc): doc is ContextDoc => !!doc);
  }
  const single = normalizeContextDoc(value);
  return single ? [single] : [];
}

function normalizeContextDoc(value: unknown): ContextDoc | null {
  if (value == null) return null;
  if (typeof value === 'string') {
    const content = value.trim();
    if (!content) return null;
    return { content };
  }
  if (isPlainObject(value)) {
    const content = pickFirstString(value, ['content', 'text', 'body', 'summary', 'value', 'snippet']);
    const source = pickFirstString(value, ['source', 'url', 'link', 'document', 'href']);
    if (!content && !source) return null;
    return {
      content: content || (source ?? ''),
      source: source || undefined
    };
  }
  return { content: String(value) };
}

function pickFirstString(obj: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const val = obj[key];
    if (typeof val === 'string' && val.trim().length > 0) {
      return val.trim();
    }
  }
  return undefined;
}
