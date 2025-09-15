import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import rehypeSanitize from "rehype-sanitize";
// import rehype-raw
// import rehypeRaw from "rehype-raw";

export default function MarkdownImpl({ content }: { content: string }) {
  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeSanitize]}
    >
      {content}
    </ReactMarkdown>
  );
}
