import DOMPurify from 'dompurify';

// Utility functions for formatting and sanitizing data from the thoughts

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
    mcpToolsUsed: pick('MCP\\s*Tools\\s*Used'),
  };
};

export const toPlainText = (html: string | undefined | null): string => {
  if (!html) return '';
  let src = String(html);
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
