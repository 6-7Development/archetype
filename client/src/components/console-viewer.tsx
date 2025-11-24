import { useRef, useEffect, useState } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { X, Copy, Check } from "lucide-react";

interface ConsoleViewerProps {
  output: string;
  isOpen: boolean;
  onClose: () => void;
}

export function ConsoleViewer({ output, isOpen, onClose }: ConsoleViewerProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [output]);

  if (!isOpen) return null;

  const handleCopy = () => {
    navigator.clipboard.writeText(output);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed bottom-0 left-0 right-0 h-48 bg-background border-t border-border shadow-lg z-40">
      <div className="flex items-center justify-between px-4 py-2 border-b border-border">
        <div className="text-sm font-semibold text-foreground">Console Output</div>
        <div className="flex items-center gap-2">
          <Button
            size="icon"
            variant="ghost"
            onClick={handleCopy}
            className="h-6 w-6"
            data-testid="button-copy-console"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-600" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
          <Button
            size="icon"
            variant="ghost"
            onClick={onClose}
            className="h-6 w-6"
            data-testid="button-close-console"
          >
            <X className="w-3 h-3" />
          </Button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs text-muted-foreground bg-muted/50 max-h-[calc(12rem-2.5rem)]"
        data-testid="console-output"
      >
        {output ? (
          <div className="space-y-1 whitespace-pre-wrap break-words">
            {output}
          </div>
        ) : (
          <div className="text-muted-foreground/50">No output yet...</div>
        )}
      </div>
    </div>
  );
}
