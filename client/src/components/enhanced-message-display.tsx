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
      const original = progress.message;
      
      // Categorize ALL messages - nothing should be filtered out
      if (msg.includes('analyzing') || msg.includes('planning') || msg.includes('considering') || msg.includes('evaluating') || msg.includes('reviewing') || msg.includes('assessing') || msg.includes('examining')) {
        blocks.push({
          id: `thinking-${index}`,
          type: 'thinking',
          content: original,
          timestamp: progress.timestamp
        });
      }
      else if (msg.includes('✅') || msg.includes('completed') || msg.includes('finished') || msg.includes('done') || msg.includes('success')) {
        blocks.push({
          id: `result-${index}`,
          type: 'result',
          content: original,
          timestamp: progress.timestamp
        });
      }
      // DEFAULT: Treat as tool action (most progress messages are tool-related)
      else {
        const toolName = extractToolName(original);
        blocks.push({
          id: `tool-${index}`,
          type: 'tool_call',
          content: original,
          toolName,
          timestamp: progress.timestamp
        });
      }
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
    if (lower.includes('executing') || message.includes('🔨')) return 'execute';
    if (lower.includes('consulting i am')) return 'architect_consult';
    if (lower.includes('generating design')) return 'generate_design';
    if (lower.includes('rate limit') || lower.includes('waiting')) return 'wait';
    return 'action';
  };

  const blocks = parseProgressToBlocks();

  return (
    <div className="space-y-3">
      {blocks.length > 0 && (
        <div className="space-y-2">
          {blocks.map((block) => (
            <Collapsible 
              key={block.id}
              open={expandedBlocks.has(block.id)}
              onOpenChange={() => toggleBlock(block.id)}
            >
              <CollapsibleTrigger className="w-full">
                <div className={cn(
                  "flex items-center gap-2 px-3 py-2 rounded-lg text-sm border transition-colors",
                  block.type === 'thinking' && "bg-purple-500/10 border-purple-500/30 hover:bg-purple-500/20",
                  block.type === 'tool_call' && "bg-blue-500/10 border-blue-500/30 hover:bg-blue-500/20",
                  block.type === 'result' && "bg-green-500/10 border-green-500/30 hover:bg-green-500/20"
                )}>
                  <ChevronRight className={cn(
                    "w-4 h-4 transition-transform",
                    expandedBlocks.has(block.id) && "rotate-90"
                  )} />
                  
                  {block.type === 'thinking' && <Brain className="w-4 h-4 text-purple-500" />}
                  {block.type === 'tool_call' && <Wrench className="w-4 h-4 text-blue-500" />}
                  {block.type === 'result' && <CheckCircle2 className="w-4 h-4 text-green-500" />}
                  
                  <span className="font-medium flex-1 text-left">
                    {block.type === 'thinking' && 'Thinking'}
                    {block.type === 'tool_call' && `Tool: ${block.toolName}`}
                    {block.type === 'result' && 'Result'}
                  </span>
                  
                  <span className="text-xs text-muted-foreground">
                    {block.content.length} chars
                  </span>
                </div>
              </CollapsibleTrigger>
              
              <CollapsibleContent>
                <div className="mt-2 ml-6 px-3 py-2 rounded-lg bg-muted/50 border border-border/50">
                  <div className="text-sm text-muted-foreground font-mono whitespace-pre-wrap">
                    {block.content}
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          ))}
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
