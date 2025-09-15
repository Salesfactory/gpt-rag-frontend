import { Suspense, lazy } from "react";
const MarkdownImpl = lazy(() => import("./MarkdownImpl"));

export default function MarkdownRenderer({ content }: { content: string }) {
  return <Suspense fallback={null}><MarkdownImpl content={content} /></Suspense>;
}
