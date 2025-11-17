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
    <div className="space-y-3">
      {blocks.length > 0 && (
        <div className="space-y-2">
          {/* Summary header */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground pb-1">
            {thinkingCount > 0 && (
              <span className="flex items-center gap-1">
                <Brain className="w-3 h-3 text-purple-500" />
                {thinkingCount} thinking
              </span>
            )}
            {toolCallCount > 0 && (
              <span className="flex items-center gap-1">
                <Wrench className="w-3 h-3 text-blue-500" />
                {toolCallCount} tool{toolCallCount > 1 ? 's' : ''}
              </span>
            )}
            {resultCount > 0 && (
              <span className="flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3 text-green-500" />
                {resultCount} result{resultCount > 1 ? 's' : ''}
              </span>
            )}
          </div>
          
          {visibleBlocks.map((block) => (
            <Collapsible 
              key={block.id}
              open={expandedBlocks.has(block.id)}
              onOpenChange={() => toggleBlock(block.id)}
            >
              <CollapsibleTrigger className="w-full">
                <div className={cn(
                  "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs border transition-colors",
                  block.type === 'thinking' && "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20",
                  block.type === 'tool_call' && "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20",
                  block.type === 'result' && "bg-green-500/10 border-green-500/30 hover:bg-green-500/20"
                )}>
                  <ChevronRight className={cn(
                    "w-3 h-3 transition-transform flex-shrink-0",
                    expandedBlocks.has(block.id) && "rotate-90"
                  )} />
                  
                  {block.type === 'thinking' && <Brain className="w-3 h-3 text-purple-500 flex-shrink-0" />}
                  {block.type === 'tool_call' && <Wrench className="w-3 h-3 text-blue-500 flex-shrink-0" />}
                  {block.type === 'result' && <CheckCircle2 className="w-3 h-3 text-green-500 flex-shrink-0" />}
                  
                  <span className="font-medium flex-1 text-left truncate">
                    {block.type === 'thinking' && 'Thinking'}
                    {block.type === 'tool_call' && block.toolName}
                    {block.type === 'result' && 'Completed'}
                  </span>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="mt-1 ml-5 px-2.5 py-2 rounded-md bg-muted/50 border border-border/50">
                  <div className="text-xs text-muted-foreground font-mono whitespace-pre-wrap">
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
          "prose prose-invert max-w-none text-sm leading-relaxed",
          isStreaming && "animate-pulse"
        )}>
          <MarkdownRenderer content={content} />
        </div>
      )}
    </div>
  );
}
