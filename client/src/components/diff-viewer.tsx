import { useMemo } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { cn } from "@/lib/utils";

interface DiffViewerProps {
  diff: string;
  className?: string;
}

interface DiffLine {
  type: 'added' | 'removed' | 'unchanged' | 'header' | 'hunk';
  content: string;
  lineNumber?: number;
  oldLineNumber?: number;
  newLineNumber?: number;
}

export function DiffViewer({ diff, className }: DiffViewerProps) {
  const parsedDiff = useMemo(() => {
    if (!diff) return [];

    const lines = diff.split('\n');
    const parsed: DiffLine[] = [];
    let oldLineNum = 0;
    let newLineNum = 0;

    for (const line of lines) {
      if (line.startsWith('@@')) {
        // Hunk header: @@ -1,3 +1,4 @@
        const match = line.match(/@@ -(\d+),?\d* \+(\d+),?\d* @@/);
        if (match) {
          oldLineNum = parseInt(match[1]);
          newLineNum = parseInt(match[2]);
        }
        parsed.push({
          type: 'hunk',
          content: line,
        });
      } else if (line.startsWith('+++') || line.startsWith('---')) {
        // File headers
        parsed.push({
          type: 'header',
          content: line,
        });
      } else if (line.startsWith('+')) {
        // Added line
        parsed.push({
          type: 'added',
          content: line.slice(1),
          newLineNumber: newLineNum++,
        });
      } else if (line.startsWith('-')) {
        // Removed line
        parsed.push({
          type: 'removed',
          content: line.slice(1),
          oldLineNumber: oldLineNum++,
        });
      } else if (line.startsWith(' ')) {
        // Unchanged line
        parsed.push({
          type: 'unchanged',
          content: line.slice(1),
          oldLineNumber: oldLineNum++,
          newLineNumber: newLineNum++,
        });
      } else {
        // Other lines (diff headers, etc.)
        parsed.push({
          type: 'header',
          content: line,
        });
      }
    }

    return parsed;
  }, [diff]);

  if (!diff || diff.trim() === '') {
    return (
      <div className={cn("flex items-center justify-center p-8 text-muted-foreground", className)}>
        <p className="text-sm">No changes to display</p>
      </div>
    );
  }

  return (
    <ScrollArea className={cn("h-full w-full", className)}>
      <div className="font-mono text-xs">
        {parsedDiff.map((line, index) => (
          <div
            key={index}
            className={cn(
              "flex gap-4 px-4 py-0.5",
              {
                'bg-green-500/10 text-green-600': line.type === 'added',
                'bg-red-500/10 text-red-600': line.type === 'removed',
                'text-foreground': line.type === 'unchanged',
                'bg-muted/50 text-muted-foreground font-semibold': line.type === 'hunk',
                'text-muted-foreground': line.type === 'header',
              }
            )}
            data-testid={`diff-line-${line.type}`}
          >
            {/* Line numbers */}
            <div className="flex gap-2 select-none text-muted-foreground/50 min-w-[80px]">
              <span className="w-8 text-right">
                {line.oldLineNumber !== undefined && line.oldLineNumber}
              </span>
              <span className="w-8 text-right">
                {line.newLineNumber !== undefined && line.newLineNumber}
              </span>
            </div>

            {/* Diff marker */}
            <span className="w-4 select-none">
              {line.type === 'added' && '+'}
              {line.type === 'removed' && '-'}
              {line.type === 'unchanged' && ' '}
            </span>

            {/* Line content */}
            <pre className="flex-1 whitespace-pre-wrap break-all">
              {line.content}
            </pre>
          </div>
        ))}
      </div>
    </ScrollArea>
  );
}
