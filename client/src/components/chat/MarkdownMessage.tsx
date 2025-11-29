import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { vscDarkPlus, oneLight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import rehypeRaw from 'rehype-raw';
import rehypeSanitize from 'rehype-sanitize';
import { Copy, Check, FileCode, Terminal, Hash } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface MarkdownMessageProps {
  content: string;
  isUser: boolean;
  showLineNumbers?: boolean;
}

const languageAliases: Record<string, string> = {
  js: 'javascript',
  ts: 'typescript',
  jsx: 'javascript',
  tsx: 'typescript',
  py: 'python',
  rb: 'ruby',
  sh: 'bash',
  shell: 'bash',
  zsh: 'bash',
  yml: 'yaml',
  md: 'markdown',
  dockerfile: 'docker',
  makefile: 'makefile',
  sql: 'sql',
  graphql: 'graphql',
  gql: 'graphql',
};

const languageIcons: Record<string, typeof FileCode> = {
  javascript: FileCode,
  typescript: FileCode,
  python: FileCode,
  bash: Terminal,
  shell: Terminal,
  sql: FileCode,
  default: FileCode,
};

function detectLanguage(code: string, hint?: string): string {
  if (hint && hint !== 'text') {
    return languageAliases[hint.toLowerCase()] || hint.toLowerCase();
  }
  
  if (code.includes('import React') || code.includes('useState') || code.includes('useEffect')) {
    return 'typescript';
  }
  if (code.includes('def ') && code.includes(':')) {
    return 'python';
  }
  if (code.includes('SELECT ') || code.includes('INSERT ') || code.includes('CREATE TABLE')) {
    return 'sql';
  }
  if (code.includes('#!/bin/bash') || code.includes('#!/bin/sh') || code.startsWith('$')) {
    return 'bash';
  }
  if (code.includes('function ') || code.includes('const ') || code.includes('let ')) {
    return 'javascript';
  }
  if (code.includes('package ') && code.includes('func ')) {
    return 'go';
  }
  if (code.includes('<!DOCTYPE') || code.includes('<html') || code.includes('<div')) {
    return 'html';
  }
  if (code.includes('{') && (code.includes('color:') || code.includes('display:'))) {
    return 'css';
  }
  
  return 'text';
}

function CodeBlock({ 
  code, 
  language, 
  showLineNumbers = true 
}: { 
  code: string; 
  language: string;
  showLineNumbers?: boolean;
}) {
  const [copied, setCopied] = useState(false);
  const detectedLanguage = detectLanguage(code, language);
  const displayLanguage = detectedLanguage.charAt(0).toUpperCase() + detectedLanguage.slice(1);
  const IconComponent = languageIcons[detectedLanguage] || languageIcons.default;
  
  const copyCode = () => {
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="group relative bg-secondary/20 dark:bg-secondary/30 rounded-lg overflow-hidden my-3 border border-secondary/40 dark:border-secondary/50">
      {/* Header with language and copy button */}
      <div className="flex items-center justify-between bg-secondary/40 dark:bg-secondary/50 px-3 py-2 border-b border-secondary/30">
        <div className="flex items-center gap-2 text-xs text-muted-foreground font-medium">
          <IconComponent className="w-3.5 h-3.5" />
          <span>{displayLanguage}</span>
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={copyCode}
          className="h-6 px-2 text-xs opacity-70 hover:opacity-100 transition-opacity gap-1"
          data-testid="button-copy-code"
        >
          {copied ? (
            <>
              <Check className="w-3 h-3 text-green-500" />
              <span className="text-green-500">Copied!</span>
            </>
          ) : (
            <>
              <Copy className="w-3 h-3" />
              <span>Copy</span>
            </>
          )}
        </Button>
      </div>
      
      {/* Code content */}
      <div className="overflow-x-auto">
        <SyntaxHighlighter
          language={detectedLanguage}
          style={vscDarkPlus}
          showLineNumbers={showLineNumbers && code.split('\n').length > 3}
          lineNumberStyle={{
            minWidth: '2.5em',
            paddingRight: '1em',
            color: 'hsl(var(--muted-foreground))',
            opacity: 0.5,
            fontSize: '11px',
            userSelect: 'none',
          }}
          customStyle={{
            margin: 0,
            padding: '14px 16px',
            fontSize: '13px',
            lineHeight: '1.6',
            backgroundColor: 'transparent',
            fontFamily: 'JetBrains Mono, Menlo, Monaco, monospace',
          }}
          wrapLongLines
        >
          {code.replace(/\n$/, '')}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export function MarkdownMessage({ content, isUser, showLineNumbers = true }: MarkdownMessageProps) {
  if (isUser) {
    return <div className="whitespace-pre-wrap text-base">{content}</div>;
  }

  return (
    <ReactMarkdown
      remarkPlugins={[remarkGfm]}
      rehypePlugins={[rehypeRaw, rehypeHighlight, rehypeSanitize]}
      components={{
        code({ inline, className, children, ...props }) {
          const match = /language-(\w+)/.exec(className || '');
          const language = match ? match[1] : 'text';
          const code = String(children).replace(/\n$/, '');

          if (inline) {
            return (
              <code className="bg-secondary/50 dark:bg-secondary/60 rounded px-1.5 py-0.5 font-mono text-sm text-primary/90">
                {children}
              </code>
            );
          }

          return (
            <CodeBlock 
              code={code} 
              language={language} 
              showLineNumbers={showLineNumbers} 
            />
          );
        },
        p: ({ children }) => <p className="my-2 text-base leading-relaxed">{children}</p>,
        ul: ({ children }) => <ul className="list-disc list-inside my-2 space-y-1 text-base">{children}</ul>,
        ol: ({ children }) => <ol className="list-decimal list-inside my-2 space-y-1 text-base">{children}</ol>,
        li: ({ children }) => <li className="text-base leading-relaxed">{children}</li>,
        blockquote: ({ children }) => (
          <blockquote className="border-l-4 border-primary/40 pl-4 italic my-3 text-muted-foreground text-base bg-secondary/10 py-2 rounded-r-md">
            {children}
          </blockquote>
        ),
        a: ({ href, children }) => (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-primary hover:underline break-all font-medium"
          >
            {children}
          </a>
        ),
        h1: ({ children }) => <h1 className="text-xl font-bold my-3 text-foreground">{children}</h1>,
        h2: ({ children }) => <h2 className="text-lg font-bold my-2.5 text-foreground">{children}</h2>,
        h3: ({ children }) => <h3 className="text-base font-bold my-2 text-foreground">{children}</h3>,
        h4: ({ children }) => <h4 className="text-sm font-bold my-1.5 text-foreground">{children}</h4>,
        table: ({ children }) => (
          <div className="overflow-x-auto my-3 rounded-md border border-secondary/40">
            <table className="w-full border-collapse text-sm">
              {children}
            </table>
          </div>
        ),
        thead: ({ children }) => (
          <thead className="bg-secondary/30">{children}</thead>
        ),
        th: ({ children }) => (
          <th className="border border-secondary/40 px-3 py-2 text-left font-semibold">
            {children}
          </th>
        ),
        td: ({ children }) => (
          <td className="border border-secondary/40 px-3 py-2">{children}</td>
        ),
        hr: () => <hr className="my-4 border-secondary/40" />,
        strong: ({ children }) => <strong className="font-semibold text-foreground">{children}</strong>,
        em: ({ children }) => <em className="italic">{children}</em>,
        pre: ({ children }) => <>{children}</>,
      }}
    >
      {content}
    </ReactMarkdown>
  );
}
