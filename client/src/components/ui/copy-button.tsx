/**
 * Copy to Clipboard Button Component
 * ===================================
 * A reusable button that copies text to clipboard with feedback.
 */

import { useState, useCallback } from 'react';
import { Check, Copy, ClipboardCopy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface CopyButtonProps {
  text: string;
  className?: string;
  variant?: 'default' | 'ghost' | 'outline';
  size?: 'sm' | 'default' | 'lg' | 'icon';
  showLabel?: boolean;
  onCopy?: () => void;
}

export function CopyButton({ 
  text, 
  className, 
  variant = 'ghost',
  size = 'icon',
  showLabel = false,
  onCopy,
}: CopyButtonProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      onCopy?.();
      
      setTimeout(() => {
        setCopied(false);
      }, 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  }, [text, onCopy]);

  return (
    <Button
      variant={variant}
      size={size}
      onClick={handleCopy}
      className={cn(
        'transition-all duration-200',
        copied && 'text-green-500 bg-green-500/10',
        className
      )}
      data-testid="button-copy-clipboard"
    >
      {copied ? (
        <>
          <Check className="w-4 h-4" />
          {showLabel && <span className="ml-1">Copied!</span>}
        </>
      ) : (
        <>
          <Copy className="w-4 h-4" />
          {showLabel && <span className="ml-1">Copy</span>}
        </>
      )}
    </Button>
  );
}

/**
 * Code Block with Copy Button
 * Wraps code content with an integrated copy button
 */
interface CodeBlockWithCopyProps {
  code: string;
  language?: string;
  className?: string;
  children?: React.ReactNode;
}

export function CodeBlockWithCopy({ 
  code, 
  language, 
  className,
  children 
}: CodeBlockWithCopyProps) {
  return (
    <div className={cn('relative group', className)}>
      <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
        <CopyButton 
          text={code} 
          variant="outline"
          size="sm"
          className="bg-background/80 backdrop-blur-sm border-border/50 h-7 px-2"
        />
      </div>
      {children || (
        <pre className="p-4 rounded-lg bg-muted overflow-x-auto">
          <code className={language ? `language-${language}` : ''}>
            {code}
          </code>
        </pre>
      )}
    </div>
  );
}
