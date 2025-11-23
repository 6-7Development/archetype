import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';

interface MarkdownMessageProps {
  content: string;
  isUser: boolean;
}

export function MarkdownMessage({ content, isUser }: MarkdownMessageProps) {
  if (isUser) {
    // User messages: plain text, no markdown
    return <div className="whitespace-pre-wrap">{content}</div>;
  }

  // AI messages: full markdown support with code highlighting
  return (
    <div className="prose prose-sm dark:prose-invert max-w-none break-words">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeSanitize]}
        components={{
          code({ inline, className, children, ...props }) {
            const match = /language-(\w+)/.exec(className || '');
            const language = match ? match[1] : 'text';

            if (inline) {
              return (
                <code
                  className="bg-secondary/40 rounded px-1.5 py-0.5 font-mono text-xs"
                  {...props}
                >
                  {children}
                </code>
              );
            }

            return (
              <div className="bg-secondary/20 rounded-md overflow-hidden my-2 border border-secondary/50">
                <div className="bg-secondary/30 text-xs text-muted-foreground px-3 py-1.5 font-mono">
                  {language}
                </div>
                <SyntaxHighlighter
                  language={language}
                  style={vscDarkPlus}
                  customStyle={{
                    margin: 0,
                    padding: '12px',
                    fontSize: '12px',
                    lineHeight: '1.5',
                  }}
                  wrapLongLines
                  {...props}
                >
                  {String(children).replace(/\n$/, '')}
                </SyntaxHighlighter>
              </div>
            );
          },
          p: ({ children }) => <p className="my-1.5">{children}</p>,
          ul: ({ children }) => <ul className="list-disc list-inside my-1.5 space-y-0.5">{children}</ul>,
          ol: ({ children }) => <ol className="list-decimal list-inside my-1.5 space-y-0.5">{children}</ol>,
          li: ({ children }) => <li className="text-sm">{children}</li>,
          blockquote: ({ children }) => (
            <blockquote className="border-l-4 border-primary/30 pl-3 italic my-1.5 text-muted-foreground">
              {children}
            </blockquote>
          ),
          a: ({ href, children }) => (
            <a
              href={href}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              {children}
            </a>
          ),
          table: ({ children }) => (
            <div className="overflow-x-auto my-2">
              <table className="border-collapse border border-secondary/50 text-sm">{children}</table>
            </div>
          ),
          th: ({ children }) => (
            <th className="border border-secondary/50 bg-secondary/30 px-2 py-1 text-left">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="border border-secondary/50 px-2 py-1">{children}</td>
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
