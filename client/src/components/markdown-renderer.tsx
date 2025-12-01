import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeSanitize, { defaultSchema } from 'rehype-sanitize';
import { cn } from "@/lib/utils";
import { useState, useCallback } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";

interface MarkdownRendererProps {
  content: string;
  className?: string;
}

function CodeBlockWithCopy({ children }: { children: any }) {
  const [copied, setCopied] = useState(false);
  
  const handleCopy = useCallback(() => {
    const codeContent = extractTextFromChildren(children);
    navigator.clipboard.writeText(codeContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [children]);
  
  return (
    <div className="relative group">
      <pre className="rounded-md bg-muted p-4 overflow-x-auto my-2 pr-12">
        {children}
      </pre>
      <Button
        size="icon"
        variant="ghost"
        className="absolute top-2 right-2 h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity bg-background/80 hover:bg-background"
        onClick={handleCopy}
        data-testid="button-copy-code"
      >
        {copied ? (
          <Check className="h-3.5 w-3.5 text-green-500" />
        ) : (
          <Copy className="h-3.5 w-3.5" />
        )}
      </Button>
    </div>
  );
}

function extractTextFromChildren(children: any): string {
  if (typeof children === 'string') return children;
  if (Array.isArray(children)) {
    return children.map(extractTextFromChildren).join('');
  }
  if (children?.props?.children) {
    return extractTextFromChildren(children.props.children);
  }
  return '';
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
    <div className={cn("prose max-w-none", className)}>
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
        // Custom styling for pre blocks with copy button
        pre({ children }: any) {
          return <CodeBlockWithCopy>{children}</CodeBlockWithCopy>;
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
