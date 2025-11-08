import { useEffect, useRef, useState } from 'react';
import { ScratchpadEntry } from '@/hooks/use-websocket-stream';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { ChevronDown, Brain, Zap, FileText, CheckCircle2, Trash2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface ScratchpadDisplayProps {
  entries: ScratchpadEntry[];
  onClear?: () => void;
  sessionId: string;
}

export function ScratchpadDisplay({ entries, onClear, sessionId }: ScratchpadDisplayProps) {
  const [isOpen, setIsOpen] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current && isOpen) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [entries, isOpen]);

  const getEntryIcon = (entryType: string) => {
    switch (entryType) {
      case 'thought':
        return <Brain className="w-4 h-4 text-purple-500" data-testid="icon-thought" />;
      case 'action':
        return <Zap className="w-4 h-4 text-[hsl(50,98%,58%)]" data-testid="icon-action" />;
      case 'note':
        return <FileText className="w-4 h-4 text-blue-500" data-testid="icon-note" />;
      case 'result':
        return <CheckCircle2 className="w-4 h-4 text-[hsl(145,60%,45%)]" data-testid="icon-result" />;
      default:
        return <FileText className="w-4 h-4" data-testid="icon-default" />;
    }
  };

  const getAuthorColor = (author: string) => {
    if (author === 'LomuAI') return 'text-[hsl(50,98%,58%)]';
    if (author.startsWith('Sub-Agent')) return 'text-[hsl(145,60%,45%)]';
    if (author === 'Architect' || author === 'I AM Architect') return 'text-[hsl(32,94%,62%)]';
    return 'text-muted-foreground';
  };

  const sortedEntries = [...entries].sort((a, b) => 
    new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  );

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={setIsOpen}
      className="w-full border border-border rounded-md bg-card"
      data-testid="scratchpad-container"
    >
      <div className="flex items-center justify-between p-3 border-b border-border">
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="sm"
            className="gap-2"
            data-testid="button-toggle-scratchpad"
          >
            <ChevronDown
              className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-0' : '-rotate-90'}`}
              data-testid="icon-chevron"
            />
            <span className="font-medium text-sm">Progress Log</span>
            {entries.length > 0 && (
              <span className="text-xs text-muted-foreground" data-testid="text-entry-count">
                ({entries.length})
              </span>
            )}
          </Button>
        </CollapsibleTrigger>
        {onClear && entries.length > 0 && (
          <Button
            variant="ghost"
            size="icon"
            onClick={onClear}
            className="h-8 w-8"
            data-testid="button-clear-scratchpad"
          >
            <Trash2 className="w-3 h-3" />
          </Button>
        )}
      </div>

      <CollapsibleContent>
        <ScrollArea
          className="h-[400px]"
          data-testid="scratchpad-scroll-area"
        >
          <div ref={scrollRef} className="p-3 space-y-2">
            {entries.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground" data-testid="text-empty-state">
                <Brain className="w-8 h-8 mx-auto mb-2 opacity-50" />
                <p className="text-sm">No progress entries yet</p>
              </div>
            ) : (
              sortedEntries.map((entry, idx) => (
                <div
                  key={`${entry.id}-${idx}`}
                  className="flex gap-2 p-2 rounded-md bg-muted/30 hover-elevate"
                  data-testid={`entry-${entry.id}`}
                >
                  <div className="flex-shrink-0 mt-0.5">
                    {getEntryIcon(entry.entryType)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-xs font-medium ${getAuthorColor(entry.author)}`}
                        data-testid={`text-author-${entry.id}`}
                      >
                        {entry.author}
                      </span>
                      <span className="text-xs text-muted-foreground" data-testid={`text-timestamp-${entry.id}`}>
                        {formatDistanceToNow(new Date(entry.createdAt), { addSuffix: true })}
                      </span>
                    </div>
                    <p className="text-sm text-foreground break-words" data-testid={`text-content-${entry.id}`}>
                      {entry.content}
                    </p>
                    {entry.metadata && Object.keys(entry.metadata).length > 0 && (
                      <div className="mt-1 text-xs text-muted-foreground" data-testid={`text-metadata-${entry.id}`}>
                        {entry.metadata.projectId && (
                          <span>Project: {entry.metadata.projectId}</span>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </ScrollArea>
      </CollapsibleContent>
    </Collapsible>
  );
}
