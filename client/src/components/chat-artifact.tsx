import { useState } from "react";
import { Copy, Check, FileCode, Terminal, FileText, File } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Light as SyntaxHighlighter } from 'react-syntax-highlighter';
import { atomOneDark } from 'react-syntax-highlighter/dist/esm/styles/hljs';

// Import commonly used languages for smaller bundle
import javascript from 'react-syntax-highlighter/dist/esm/languages/hljs/javascript';
import typescript from 'react-syntax-highlighter/dist/esm/languages/hljs/typescript';
import python from 'react-syntax-highlighter/dist/esm/languages/hljs/python';
import java from 'react-syntax-highlighter/dist/esm/languages/hljs/java';
import cpp from 'react-syntax-highlighter/dist/esm/languages/hljs/cpp';
import css from 'react-syntax-highlighter/dist/esm/languages/hljs/css';
import xml from 'react-syntax-highlighter/dist/esm/languages/hljs/xml'; // HTML
import json from 'react-syntax-highlighter/dist/esm/languages/hljs/json';
import bash from 'react-syntax-highlighter/dist/esm/languages/hljs/bash';
import sql from 'react-syntax-highlighter/dist/esm/languages/hljs/sql';

// Register languages
SyntaxHighlighter.registerLanguage('javascript', javascript);
SyntaxHighlighter.registerLanguage('typescript', typescript);
SyntaxHighlighter.registerLanguage('python', python);
SyntaxHighlighter.registerLanguage('java', java);
SyntaxHighlighter.registerLanguage('cpp', cpp);
SyntaxHighlighter.registerLanguage('css', css);
SyntaxHighlighter.registerLanguage('html', xml);
SyntaxHighlighter.registerLanguage('xml', xml);
SyntaxHighlighter.registerLanguage('json', json);
SyntaxHighlighter.registerLanguage('bash', bash);
SyntaxHighlighter.registerLanguage('sh', bash);
SyntaxHighlighter.registerLanguage('sql', sql);

export interface Artifact {
  id: string;
  type: "code" | "file" | "diff" | "terminal";
  title?: string;
  content: string;
  language?: string;
  metadata?: {
    lineCount?: number;
    fileSize?: number;
    timestamp?: Date;
    [key: string]: any;
  };
}

export interface ChatArtifactProps {
  artifact: Artifact;
  onOpenInEditor?: (filePath: string) => void;
  onCopy?: (content: string) => void;
  className?: string;
}

// Language display names
const LANGUAGE_NAMES: Record<string, string> = {
  javascript: "JavaScript",
  typescript: "TypeScript",
  python: "Python",
  java: "Java",
  cpp: "C++",
  c: "C",
  csharp: "C#",
  go: "Go",
  rust: "Rust",
  php: "PHP",
  ruby: "Ruby",
  swift: "Swift",
  kotlin: "Kotlin",
  dart: "Dart",
  css: "CSS",
  html: "HTML",
  xml: "XML",
  json: "JSON",
  yaml: "YAML",
  sql: "SQL",
  bash: "Bash",
  sh: "Shell",
  powershell: "PowerShell",
};

function getLanguageIcon(language?: string) {
  if (!language) return <FileText className="w-4 h-4" />;
  
  const lang = language.toLowerCase();
  
  if (lang === 'bash' || lang === 'sh' || lang === 'powershell') {
    return <Terminal className="w-4 h-4" />;
  }
  
  return <FileCode className="w-4 h-4" />;
}

function getLanguageDisplayName(language?: string): string {
  if (!language) return "Text";
  return LANGUAGE_NAMES[language.toLowerCase()] || language.toUpperCase();
}

export function ChatArtifact({ 
  artifact, 
  onOpenInEditor, 
  onCopy,
  className 
}: ChatArtifactProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(artifact.content);
      setCopied(true);
      onCopy?.(artifact.content);
      
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const handleOpenInEditor = () => {
    if (artifact.title && onOpenInEditor) {
      onOpenInEditor(artifact.title);
    }
  };

  // For MVP, we're only implementing code type
  if (artifact.type === "code") {
    return (
      <Card 
        className={cn(
          "overflow-hidden border-border bg-card",
          className
        )}
        data-testid={`artifact-code-${artifact.id}`}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-4 py-2 bg-muted/50 border-b border-border">
          <div className="flex items-center gap-2 min-w-0">
            {getLanguageIcon(artifact.language)}
            {artifact.title ? (
              <span className="text-sm font-medium truncate" data-testid="artifact-title">
                {artifact.title}
              </span>
            ) : null}
            <Badge 
              variant="secondary" 
              className="text-xs shrink-0"
              data-testid="artifact-language-badge"
            >
              {getLanguageDisplayName(artifact.language)}
            </Badge>
            {artifact.metadata?.lineCount && (
              <span className="text-xs text-muted-foreground shrink-0">
                {artifact.metadata.lineCount} lines
              </span>
            )}
          </div>
          
          <div className="flex items-center gap-1 shrink-0">
            {artifact.title && onOpenInEditor && (
              <Button
                variant="ghost"
                size="sm"
                onClick={handleOpenInEditor}
                className="h-8 px-2 text-xs"
                data-testid="button-open-in-editor"
              >
                <File className="w-3 h-3 mr-1" />
                Open
              </Button>
            )}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleCopy}
              className="h-8 px-2 text-xs"
              data-testid="button-copy-code"
            >
              {copied ? (
                <>
                  <Check className="w-3 h-3 mr-1 text-fresh-mint" />
                  <span className="text-fresh-mint">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="w-3 h-3 mr-1" />
                  Copy
                </>
              )}
            </Button>
          </div>
        </div>

        {/* Code Content */}
        <div 
          className="relative overflow-x-auto" 
          data-testid="artifact-code-content"
        >
          <SyntaxHighlighter
            language={artifact.language || 'text'}
            style={atomOneDark}
            customStyle={{
              margin: 0,
              padding: '1rem',
              background: 'hsl(222, 13%, 15%)', // Dark background even in light mode
              fontSize: '0.875rem',
              lineHeight: '1.5',
              fontFamily: "'JetBrains Mono', monospace",
            }}
            showLineNumbers={false}
            wrapLines={true}
            wrapLongLines={true}
          >
            {artifact.content}
          </SyntaxHighlighter>
        </div>
      </Card>
    );
  }

  // Placeholder for other artifact types (file, diff, terminal)
  return (
    <Card className={cn("p-4", className)}>
      <div className="text-sm text-muted-foreground">
        Artifact type "{artifact.type}" not yet implemented
      </div>
    </Card>
  );
}
