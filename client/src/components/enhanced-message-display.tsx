import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronRight, Brain, Wrench, CheckCircle2 } from "lucide-react";
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
                <span className="text-purple-700 dark:text-purple-300">{thinkingCount} thought{thinkingCount > 1 ? 's' : ''}</span>
              </span>
            )}
            {actionCount > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                <Wrench className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-blue-700 dark:text-blue-300">{actionCount} action{actionCount > 1 ? 's' : ''}</span>
              </span>
            )}
            {resultCount > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                <span className="text-green-700 dark:text-green-300">{resultCount} result{resultCount > 1 ? 's' : ''}</span>
              </span>
            )}
          </div>
          
          {visibleBlocks.map((block) => {
            const styles = getCategoryStyles(block.category);
            const Icon = styles.icon;
            
            return (
              <Collapsible 
                key={block.id}
                open={expandedBlocks.has(block.id)}
                onOpenChange={() => toggleBlock(block.id)}
              >
                <CollapsibleTrigger className="w-full group">
                  <div className={cn(
                    "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm border transition-all",
                    styles.bg,
                    styles.border,
                    styles.hover
                  )}>
                    <ChevronRight className={cn(
                      "w-4 h-4 transition-transform flex-shrink-0 text-muted-foreground",
                      expandedBlocks.has(block.id) && "rotate-90"
                    )} />
                    
                    <Icon className={cn("w-4 h-4 flex-shrink-0", styles.iconColor)} />
                    
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
            );
          })}
          
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
