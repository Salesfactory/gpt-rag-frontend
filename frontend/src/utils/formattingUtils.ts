import DOMPurify from 'dompurify';

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

export const rawThoughtsToString = (value: unknown): string => {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.filter(x => typeof x === 'string').join('\n');
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
  return {
    modelUsed: pick('Model\\s*Used'),
    toolSelected: pick('Tool\\s*Selected'),
    originalQuery: pick('Original\\s*Query'),
    rewrittenQuery: pick('Rewritten\\s*Query'),
    requiredRetrieval: pick('Required\\s*Retrieval'),
    numberOfDocumentsRetrieved: pick('Number\\s*of\\s*documents\\s*retrieved'),
    mcpToolUsed: pick('MCP\\s*Tool\\s*Used'),
    mcpToolsUsed: pick('MCP\\s*Tools\\s*Used'),
    contextRetrieved: pick('Context\\s*Retrieved\\s*using\\s*the\\s*rewritten\\s*query'),
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
