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
      
      // THINKING: Analysis, planning, evaluation
      if (msg.includes('analyzing') || msg.includes('planning') || msg.includes('considering') || 
          msg.includes('evaluating') || msg.includes('reviewing') || msg.includes('assessing') || 
          msg.includes('examining') || msg.includes('understanding')) {
        blocks.push({
          id: `thinking-${index}`,
          type: 'thinking',
          content: progress.message,
          timestamp: progress.timestamp
        });
      }
      // TOOL CALLS: File operations, searches, tool execution
      else if (msg.includes('🔧') || msg.includes('📖') || msg.includes('✏️') || msg.includes('🔨') ||
               msg.includes('reading') || msg.includes('writing') || msg.includes('modifying') || 
               msg.includes('creating') || msg.includes('deleting') || msg.includes('searching') ||
               msg.includes('executing') || msg.includes('fixing')) {
        const toolName = extractToolName(progress.message);
        blocks.push({
          id: `tool-${index}`,
          type: 'tool_call',
          content: progress.message,
          toolName,
          timestamp: progress.timestamp
        });
      }
      // RESULTS: Completions, successes
      else if (msg.includes('✅') || msg.includes('completed') || msg.includes('finished') || 
               msg.includes('done') || msg.includes('success')) {
        blocks.push({
          id: `result-${index}`,
          type: 'result',
          content: progress.message,
          timestamp: progress.timestamp
        });
      }
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
  
  // Calculate summary stats
  const thinkingCount = blocks.filter(b => b.type === 'thinking').length;
  const toolCallCount = blocks.filter(b => b.type === 'tool_call').length;
  const resultCount = blocks.filter(b => b.type === 'result').length;
  
  // Limit displayed blocks to prevent UI bloat (show max 5 by default)
  const BASE_LIMIT = 5;
  const visibleBlocks = showAllProgress ? blocks : blocks.slice(0, BASE_LIMIT);
  const hasMore = blocks.length > BASE_LIMIT;

  return (
    <div className="space-y-4">
      {blocks.length > 0 && (
        <div className="space-y-2 pb-3 border-b border-border/50">
          {/* Summary header */}
          <div className="flex items-center gap-3 text-xs font-medium text-muted-foreground">
            {thinkingCount > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-purple-500/10 border border-purple-500/20">
                <Brain className="w-3.5 h-3.5 text-purple-600 dark:text-purple-400" />
                <span className="text-purple-700 dark:text-purple-300">{thinkingCount} thinking</span>
              </span>
            )}
            {toolCallCount > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-blue-500/10 border border-blue-500/20">
                <Wrench className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                <span className="text-blue-700 dark:text-blue-300">{toolCallCount} action{toolCallCount > 1 ? 's' : ''}</span>
              </span>
            )}
            {resultCount > 0 && (
              <span className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-green-500/10 border border-green-500/20">
                <CheckCircle2 className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />
                <span className="text-green-700 dark:text-green-300">{resultCount} complete</span>
              </span>
            )}
          </div>
          
          {visibleBlocks.map((block) => (
            <Collapsible 
              key={block.id}
              open={expandedBlocks.has(block.id)}
              onOpenChange={() => toggleBlock(block.id)}
            >
              <CollapsibleTrigger className="w-full group">
                <div className={cn(
                  "flex items-center gap-2.5 px-3 py-2 rounded-md text-sm border transition-all",
                  block.type === 'thinking' && "bg-purple-50/50 dark:bg-purple-950/20 border-purple-200/50 dark:border-purple-800/30 hover:bg-purple-100/50 dark:hover:bg-purple-900/30",
                  block.type === 'tool_call' && "bg-blue-50/50 dark:bg-blue-950/20 border-blue-200/50 dark:border-blue-800/30 hover:bg-blue-100/50 dark:hover:bg-blue-900/30",
                  block.type === 'result' && "bg-green-50/50 dark:bg-green-950/20 border-green-200/50 dark:border-green-800/30 hover:bg-green-100/50 dark:hover:bg-green-900/30"
                )}>
                  <ChevronRight className={cn(
                    "w-4 h-4 transition-transform flex-shrink-0 text-muted-foreground",
                    expandedBlocks.has(block.id) && "rotate-90"
                  )} />
                  
                  {block.type === 'thinking' && <Brain className="w-4 h-4 text-purple-600 dark:text-purple-400 flex-shrink-0" />}
                  {block.type === 'tool_call' && <Wrench className="w-4 h-4 text-blue-600 dark:text-blue-400 flex-shrink-0" />}
                  {block.type === 'result' && <CheckCircle2 className="w-4 h-4 text-green-600 dark:text-green-400 flex-shrink-0" />}
                  
                  <span className="font-medium flex-1 text-left truncate text-foreground">
                    {block.type === 'thinking' && 'Thinking'}
                    {block.type === 'tool_call' && block.toolName}
                    {block.type === 'result' && 'Completed'}
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
