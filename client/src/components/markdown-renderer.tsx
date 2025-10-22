import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { cn } from "@/lib/utils";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

export function MarkdownRenderer({ content, className }: MarkdownRendererProps) {
  // Custom sanitize schema that preserves className for syntax highlighting
  // while still protecting against XSS attacks
  const sanitizeSchema = {
    ...defaultSchema,
    attributes: {
      ...defaultSchema.attributes,
      code: [
        ...(defaultSchema.attributes?.code || []),
        ['className', /^language-/] // Allow className starting with "language-" for syntax highlighting
      ],
      span: [
        ...(defaultSchema.attributes?.span || []),
        ['className'] // Allow className for syntax highlighting spans
      ],
      pre: [
        ...(defaultSchema.attributes?.pre || []),
        ['className'] // Allow className for pre blocks
      ]
    }
  };

  return (
    <div className={cn("prose dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[
          rehypeHighlight, // First: add syntax highlighting classes
          [rehypeSanitize, sanitizeSchema] // Then: sanitize while preserving highlighting classes
        ]}
        components={{
        // Custom styling for code blocks
        code({ node, inline, className, children, ...props }: any) {
          return inline ? (
            <code className="px-1.5 py-0.5 rounded bg-muted text-sm font-mono" {...props}>
              {children}
            </code>
          ) : (
            <code className={className} {...props}>
              {children}
            </code>
          );
        },
        // Custom styling for pre blocks
        pre({ children }: any) {
          return (
            <pre className="rounded-md bg-muted p-4 overflow-x-auto my-2">
              {children}
            </pre>
          );
        },
        // Headings
        h1({ children }: any) {
          return <h1 className="text-2xl font-semibold mt-4 mb-2">{children}</h1>;
        },
        h2({ children }: any) {
          return <h2 className="text-xl font-semibold mt-3 mb-2">{children}</h2>;
        },
        h3({ children }: any) {
          return <h3 className="text-lg font-semibold mt-2 mb-1">{children}</h3>;
        },
        // Lists
        ul({ children }: any) {
          return <ul className="list-disc list-inside my-2 space-y-1">{children}</ul>;
        },
        ol({ children }: any) {
          return <ol className="list-decimal list-inside my-2 space-y-1">{children}</ol>;
        },
        // Links
        a({ children, href }: any) {
          return (
            <a 
              href={href} 
              className="text-primary hover:underline" 
              target="_blank" 
              rel="noopener noreferrer"
            >
              {children}
            </a>
          );
        },
        // Blockquotes
        blockquote({ children }: any) {
          return (
            <blockquote className="border-l-4 border-primary pl-4 italic my-2">
              {children}
            </blockquote>
          );
        },
        // Paragraphs
        p({ children }: any) {
          return <p className="my-2 leading-relaxed">{children}</p>;
        },
      }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
