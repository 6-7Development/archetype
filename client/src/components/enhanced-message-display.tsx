import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, Brain, Wrench, CheckCircle2, Loader2 } from "lucide-react";
import { useState } from "react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { cn } from "@/lib/utils";
import { BeeStatusIndicator } from "@/components/bee-animations";

interface ProgressBlock {
  id: string;
  category: 'thinking' | 'action' | 'result';
  content: string;
  timestamp: number;
}

interface EnhancedMessageDisplayProps {
  content: string;
  progressMessages?: Array<{ id: string; message: string; timestamp: number; category?: 'thinking' | 'action' | 'result' }>;
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

  const parseProgressToBlocks = (): ProgressBlock[] => {
    const blocks: ProgressBlock[] = [];
    
    progressMessages.forEach((progress) => {
      // If category is explicitly provided, use it directly
      if (progress.category) {
        blocks.push({
          id: progress.id,
          category: progress.category,
          content: progress.message,
          timestamp: progress.timestamp
        });
      } else {
        // Legacy support: infer category from message content (for old messages)
        const msg = progress.message.toLowerCase();
        let category: 'thinking' | 'action' | 'result' = 'action';
        
        if (msg.includes('💭') || msg.includes('analyzing') || msg.includes('planning') || 
            msg.includes('considering') || msg.includes('evaluating') || msg.includes('reviewing')) {
          category = 'thinking';
        } else if (msg.includes('✅') || msg.includes('success') || msg.includes('completed') || msg.includes('done')) {
          category = 'result';
        }
        
        blocks.push({
          id: progress.id,
          category,
          content: progress.message,
          timestamp: progress.timestamp
        });
      }
    });

    return blocks;
  };

  const blocks = parseProgressToBlocks();
  
  // Calculate summary stats
  const thinkingCount = blocks.filter(b => b.category === 'thinking').length;
  const actionCount = blocks.filter(b => b.category === 'action').length;
  const resultCount = blocks.filter(b => b.category === 'result').length;
  
  // Limit displayed blocks to prevent UI bloat (show max 5 by default)
  const BASE_LIMIT = 5;
  const visibleBlocks = showAllProgress ? blocks : blocks.slice(0, BASE_LIMIT);
  const hasMore = blocks.length > BASE_LIMIT;

  const getCategoryStyles = (category: 'thinking' | 'action' | 'result') => {
    switch (category) {
      case 'thinking':
        return {
          bg: 'bg-honey/5 dark:bg-honey/10',
          border: 'border-honey/20 dark:border-honey/30',
          hover: 'hover:bg-honey/10 dark:hover:bg-honey/15',
          icon: Brain,
          iconColor: 'text-honey',
          badgeBg: 'bg-honey/10',
          badgeBorder: 'border-honey/20',
          badgeText: 'text-honey',
          beeStatus: 'thinking' as const,
        };
      case 'action':
        return {
          bg: 'bg-mint/5 dark:bg-mint/10',
          border: 'border-mint/20 dark:border-mint/30',
          hover: 'hover:bg-mint/10 dark:hover:bg-mint/15',
          icon: Wrench,
          iconColor: 'text-mint',
          badgeBg: 'bg-mint/10',
          badgeBorder: 'border-mint/20',
          badgeText: 'text-mint',
          beeStatus: 'executing' as const,
        };
      case 'result':
        return {
          bg: 'bg-mint/5 dark:bg-mint/10',
          border: 'border-mint/20 dark:border-mint/30',
          hover: 'hover:bg-mint/10 dark:hover:bg-mint/15',
          icon: CheckCircle2,
          iconColor: 'text-mint',
          badgeBg: 'bg-mint/10',
          badgeBorder: 'border-mint/20',
          badgeText: 'text-mint',
          beeStatus: 'success' as const,
        };
    }
  };

  return (
    <div className="space-y-4">
      {blocks.length > 0 && (
        <div className="space-y-2 pb-3 border-b border-border/50">
          {/* Summary header - Show counts with BeeStatusIndicator */}
          <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground flex-wrap">
            {thinkingCount > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-honey/10 border border-honey/20">
                <BeeStatusIndicator status="thinking" size="xs" />
                <span className="text-honey">{thinkingCount} Thinking</span>
              </span>
            )}
            {actionCount > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-mint/10 border border-mint/20">
                <BeeStatusIndicator status="executing" size="xs" />
                <span className="text-mint">{actionCount} Actions</span>
              </span>
            )}
            {resultCount > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-mint/10 border border-mint/20">
                <BeeStatusIndicator status="success" size="xs" />
                <span className="text-mint">{resultCount} Results</span>
              </span>
            )}
          </div>

          {/* Individual progress blocks */}
          <div className="space-y-2">
            {visibleBlocks.map((block, index) => {
              const { bg, border, hover, badgeText, beeStatus } = getCategoryStyles(block.category);
              const isLastVisibleBlock = index === visibleBlocks.length - 1;
              const showStreamingIndicator = isStreaming && isLastVisibleBlock;

              return (
                <Collapsible
                  key={block.id}
                  open={expandedBlocks.has(block.id)}
                  onOpenChange={() => toggleBlock(block.id)}
                  className={cn(
                    "rounded-lg border p-3 transition-all duration-200",
                    bg,
                    border,
                    hover
                  )}
                >
                  <CollapsibleTrigger className="flex w-full items-center justify-between text-sm font-medium">
                    <div className="flex items-center gap-2">
                      <BeeStatusIndicator 
                        status={showStreamingIndicator ? 'working' : beeStatus} 
                        size="sm" 
                      />
                      <span className={cn("font-semibold", badgeText)}>
                        {block.category.charAt(0).toUpperCase() + block.category.slice(1)}
                      </span>
                    </div>
                    <ChevronRight className={cn("h-4 w-4 transition-transform text-muted-foreground", expandedBlocks.has(block.id) && "rotate-90")} />
                  </CollapsibleTrigger>
                  <CollapsibleContent className="pt-2 text-sm text-muted-foreground">
                    <MarkdownRenderer content={block.content} />
                  </CollapsibleContent>
                </Collapsible>
              );
            })}

            {hasMore && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAllProgress(true)}
                className="w-full justify-center text-muted-foreground"
              >
                Show All {blocks.length} Progress Steps
              </Button>
            )}
          </div>
        </div>
      )}

      {/* Main message content */}
      <MarkdownRenderer content={content} />
    </div>
  );
}