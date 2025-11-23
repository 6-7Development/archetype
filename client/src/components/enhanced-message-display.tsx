import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, Brain, Wrench, CheckCircle2, Loader2 } from "lucide-react"; // Added Loader2
import { useState } from "react";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { cn } from "@/lib/utils";

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
          bg: 'bg-purple-50/50 dark:bg-purple-950/20',
          border: 'border-purple-200/50 dark:border-purple-800/30',
          hover: 'hover:bg-purple-100/50 dark:hover:bg-purple-900/30',
          icon: Brain,
          iconColor: 'text-purple-600 dark:text-purple-400',
          badgeBg: 'bg-purple-500/10',
          badgeBorder: 'border-purple-500/20',
          badgeText: 'text-purple-700 dark:text-purple-300'
        };
      case 'action':
        return {
          bg: 'bg-blue-50/50 dark:bg-blue-950/20',
          border: 'border-blue-200/50 dark:border-blue-800/30',
          hover: 'hover:bg-blue-100/50 dark:hover:bg-blue-900/30',
          icon: Wrench,
          iconColor: 'text-blue-600 dark:text-blue-400',
          badgeBg: 'bg-blue-500/10',
          badgeBorder: 'border-blue-500/20',
          badgeText: 'text-blue-700 dark:text-blue-300'
        };
      case 'result':
        return {
          bg: 'bg-green-50/50 dark:bg-green-950/20',
          border: 'border-green-200/50 dark:border-green-800/30',
          hover: 'hover:bg-green-100/50 dark:hover:bg-green-900/30',
          icon: CheckCircle2,
          iconColor: 'text-green-600 dark:text-green-400',
          badgeBg: 'bg-green-500/10',
          badgeBorder: 'border-green-500/20',
          badgeText: 'text-green-700 dark:text-green-300'
        };
    }
  };

  return (
    <div className="space-y-4">
      {blocks.length > 0 && (
        <div className="space-y-2 pb-3 border-b border-border/50">
          {/* Summary header - Show counts for all categories */}
          <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground flex-wrap">
            {thinkingCount > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/20">
                <Brain className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                {thinkingCount} Thinking
              </span>
            )}
            {actionCount > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                <Wrench className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                {actionCount} Actions
              </span>
            )}
            {resultCount > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                {resultCount} Results
              </span>
            )}
          </div>

          {/* Individual progress blocks */}
          <div className="space-y-2">
            {visibleBlocks.map((block, index) => {
              const { bg, border, hover, icon: Icon, iconColor, badgeBg, badgeBorder, badgeText } = getCategoryStyles(block.category);
              const isLastVisibleBlock = index === visibleBlocks.length - 1;
              const showStreamingIndicator = isStreaming && isLastVisibleBlock; // Only show on the last visible block if streaming

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
                      <Icon className={cn("h-4 w-4", iconColor)} />
                      <span className={cn("font-semibold", badgeText)}>
                        {block.category.charAt(0).toUpperCase() + block.category.slice(1)}
                      </span>
                      {showStreamingIndicator && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> // Streaming indicator
                      )}
                    </div>
                    <ChevronRight className={cn("h-4 w-4 transition-transform", expandedBlocks.has(block.id) && "rotate-90")} />
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
```