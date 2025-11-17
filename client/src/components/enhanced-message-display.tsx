import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, Brain, Wrench, CheckCircle2 } from "lucide-react";
import { useState } from "react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { cn } from "@/lib/utils";

interface ThinkingBlock {
  id: string;
  type: 'thinking' | 'tool_call' | 'result';
  content: string;
  toolName?: string;
  timestamp: number;
}

interface EnhancedMessageDisplayProps {
  content: string;
  progressMessages?: Array<{ id: string; message: string; timestamp: number }>;
  isStreaming?: boolean;
}

export function EnhancedMessageDisplay({ content, progressMessages = [], isStreaming = false }: EnhancedMessageDisplayProps) {
  const [expandedBlocks, setExpandedBlocks] = useState<Set<string>>(new Set());
  const [showAllProgress, setShowAllProgress] = useState(false);

  const toggleBlock = (id: string) => {
    setExpandedBlocks(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const parseProgressToBlocks = (): ThinkingBlock[] => {
    const blocks: ThinkingBlock[] = [];
    
    progressMessages.forEach((progress, index) => {
      const msg = progress.message.toLowerCase();
      
      // THINKING ONLY: Only show thinking/reasoning inline, NOT tool calls (they're in status bar)
      if (msg.includes('💭') || msg.includes('analyzing') || msg.includes('planning') || 
          msg.includes('considering') || msg.includes('evaluating') || msg.includes('reviewing') || 
          msg.includes('assessing') || msg.includes('examining') || msg.includes('understanding') ||
          msg.includes('thinking') || msg.includes('deciding') || msg.includes('choosing')) {
        blocks.push({
          id: `thinking-${index}`,
          type: 'thinking',
          content: progress.message.replace(/^💭\s*/, ''), // Remove emoji if present
          timestamp: progress.timestamp
        });
      }
      // 🚫 REMOVED: Tool calls and results (they clutter the chat and are already in status bar)
      // NOTE: Messages that don't match are intentionally filtered out to reduce noise
    });

    return blocks;
  };

  const extractToolName = (message: string): string => {
    const lower = message.toLowerCase();
    if (lower.includes('reading') || message.includes('📖')) return 'read_file';
    if (lower.includes('writing') || lower.includes('modifying') || lower.includes('fixing') || message.includes('✏️')) return 'write_file';
    if (lower.includes('creating')) return 'create_file';
    if (lower.includes('deleting')) return 'delete_file';
    if (lower.includes('listing')) return 'list_files';
    if (lower.includes('searching')) return 'search';
    if (lower.includes('executing') || message.includes('🔨')) return 'execute_tool';
    if (lower.includes('consulting i am')) return 'architect_consult';
    if (lower.includes('generating design')) return 'generate_design';
    if (lower.includes('rate limit') || lower.includes('waiting')) return 'wait';
    return 'tool';
  };

  const blocks = parseProgressToBlocks();
  
  // Calculate summary stats (only thinking now)
  const thinkingCount = blocks.length; // All blocks are thinking blocks now
  
  // Limit displayed blocks to prevent UI bloat (show max 5 by default)
  const BASE_LIMIT = 5;
  const visibleBlocks = showAllProgress ? blocks : blocks.slice(0, BASE_LIMIT);
  const hasMore = blocks.length > BASE_LIMIT;

  return (
    <div className="space-y-4">
      {blocks.length > 0 && (
        <div className="space-y-2 pb-3 border-b border-border/50">
          {/* Summary header - Only thinking blocks shown */}
          <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
            <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/20">
              <Brain className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
              <span className="text-purple-700 dark:text-purple-300">{thinkingCount} thought{thinkingCount > 1 ? 's' : ''}</span>
            </span>
          </div>
          
          {visibleBlocks.map((block) => (
            <Collapsible 
              key={block.id}
              open={expandedBlocks.has(block.id)}
              onOpenChange={() => toggleBlock(block.id)}
            >
              <CollapsibleTrigger className="w-full group">
                <div className="flex items-center gap-2.5 px-3 py-2 rounded-md text-sm border transition-all bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/50 dark:border-purple-800/30 hover:bg-purple-100/50 dark:hover:bg-purple-900/30">
                  <ChevronRight className={cn(
                    "w-4 h-4 transition-transform flex-shrink-0 text-muted-foreground",
                    expandedBlocks.has(block.id) && "rotate-90"
                  )} />
                  
                  <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />
                  
                  <span className="font-medium flex-1 text-left truncate text-foreground">
                    {block.content.substring(0, 50)}{block.content.length > 50 ? '...' : ''}
                  </span>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="mt-2 ml-7 px-3 py-2.5 rounded-md bg-muted/30 border border-border/40">
                  <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap">
                    {block.content}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
          
          {hasMore && (
            <button
              onClick={() => setShowAllProgress(!showAllProgress)}
              className="w-full px-2.5 py-1.5 text-xs text-muted-foreground hover:text-foreground border border-dashed rounded-md hover:bg-accent/50 transition-colors"
              data-testid="button-toggle-progress"
            >
              {showAllProgress ? '− Show less' : `+ Show ${blocks.length - BASE_LIMIT} more`}
            </button>
          )}
        </div>
      )}

      {content && (
        <div className={cn(
          "prose dark:prose-invert max-w-none prose-sm prose-neutral",
          "prose-headings:font-semibold prose-headings:text-foreground",
          "prose-p:text-foreground/90 prose-p:leading-relaxed",
          "prose-a:text-primary prose-a:no-underline hover:prose-a:underline",
          "prose-code:text-foreground/90 prose-code:bg-muted prose-code:px-1.5 prose-code:py-0.5 prose-code:rounded",
          "prose-pre:bg-muted prose-pre:border prose-pre:border-border/50",
          "prose-strong:text-foreground prose-strong:font-semibold",
          "prose-ul:text-foreground/90 prose-ol:text-foreground/90",
          isStreaming && "animate-pulse"
        )}>
          <MarkdownRenderer content={content} />
        </div>
      )}
    </div>
  );
}
