import { useState } from "react";
import { Copy, Check, User, ChevronDown, Brain, CheckCircle, AlertCircle, Pin, PinOff, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MarkdownMessage } from "./MarkdownMessage";
import { InlineReasoning, type ReasoningStep } from "@/components/inline-reasoning";
import { ParallelExecutionBadge } from "@/components/parallel-execution-badge";
import { ConsultationCostBadge } from "@/components/consultation-cost-badge";
import { QueenBeeAnimation } from "@/components/queen-bee-animation";
import { cn } from "@/lib/utils";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string;
  reasoning?: ReasoningStep[];
  timestamp?: Date;
  id?: string;
  messageId?: string;
  images?: string[];
  filesChanged?: string[];
  status?: 'success' | 'error' | 'pending';
  tokenUsage?: { input: number; output: number };
  parallelExecution?: {
    tools: Array<{ name: string; duration: number; status: 'completed' | 'running' | 'pending' }>;
    totalDuration: number;
    estimatedSequentialDuration: number;
  };
  isPinned?: boolean;
  [key: string]: any;
}

interface MessageBubbleProps {
  message: Message;
  index: number;
  totalMessages: number;
  onPin?: (messageId: string, isPinned: boolean) => void;
  showAvatar?: boolean;
  compact?: boolean;
  isGenerating?: boolean;
}

export function MessageBubble({ message, index, totalMessages, onPin, showAvatar = true, compact = false, isGenerating = false }: MessageBubbleProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showThinking, setShowThinking] = useState(false);
  const [isPinned, setIsPinned] = useState(message.isPinned || false);

  const isUser = message.role === 'user';
  const isLast = index === totalMessages - 1;
  const hasThinking = message.thinking && message.thinking.trim().length > 0;
  const hasContent = message.content && message.content.trim().length > 0;
  
  if (!isUser && !hasContent && !hasThinking) {
    return null;
  }

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Message copied!", variant: "success" });
  };

  const handlePin = () => {
    const newPinned = !isPinned;
    setIsPinned(newPinned);
    onPin?.(message.id || message.messageId || '', newPinned);
    toast({ 
      title: newPinned ? "Message pinned" : "Message unpinned",
      description: newPinned ? "Find it in your pinned items" : undefined,
      variant: newPinned ? "success" : "default"
    });
  };

  return (
    <div 
      key={message.id || message.messageId} 
      className={cn(
        "flex gap-3 group transition-all duration-200",
        isUser ? 'flex-row-reverse' : 'flex-row',
        compact ? 'pb-2' : 'pb-4',
        isPinned && "bg-amber-50/50 dark:bg-amber-950/20 -mx-2 px-2 py-1 rounded-lg border-l-2 border-amber-400"
      )}
      data-testid={`message-container-${message.id}`}
    >
      {/* Avatar - Enhanced BeeHive themed */}
      {showAvatar && (
        <div 
          className={cn(
            "flex-shrink-0 rounded-full flex items-center justify-center font-medium transition-all shadow-md",
            compact ? "w-7 h-7" : "w-12 h-12",
            isUser 
              ? 'bg-gradient-to-br from-slate-100 to-slate-200 dark:from-slate-700 dark:to-slate-800 text-slate-700 dark:text-slate-300 ring-1 ring-slate-200 dark:ring-slate-600' 
              : 'bg-gradient-to-br from-amber-100 to-amber-200 dark:from-amber-900/50 dark:to-amber-800/50 text-amber-700 dark:text-amber-300 ring-2 ring-amber-400 dark:ring-amber-600'
          )}
          data-testid={`avatar-${message.role}`}
          title={isUser ? 'You' : 'Scout'}
        >
          {isUser ? (
            <User className={cn(compact ? "w-3.5 h-3.5" : "w-5 h-5")} />
          ) : isGenerating ? (
            <QueenBeeAnimation isAnimating size={compact ? "sm" : "md"} />
          ) : (
            <Sparkles className={cn(compact ? "w-3.5 h-3.5" : "w-5 h-5")} />
          )}
        </div>
      )}

      {/* Message Content */}
      <div className={`flex-1 min-w-0 flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-2`}>
        {/* Thinking bubble (collapsible, for assistant only) - always visible inline */}
        {!isUser && hasThinking && (
          <div className="w-full max-w-2xl">
            <button
              onClick={() => setShowThinking(!showThinking)}
              className="w-full flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-50 dark:bg-purple-950/30 hover:bg-purple-100 dark:hover:bg-purple-900/40 transition-colors text-purple-700 dark:text-purple-300 group/thinking font-medium border border-purple-200 dark:border-purple-800/50"
              data-testid={`button-toggle-thinking-${message.id}`}
            >
              <Brain className="w-4 h-4 flex-shrink-0" />
              <span className="text-xs font-semibold">Thinking Process</span>
              <ChevronDown className={`w-3.5 h-3.5 flex-shrink-0 transition-transform ml-auto ${showThinking ? 'rotate-180' : ''}`} />
            </button>
          </div>
        )}
        
        {/* Thinking content (hidden by default) */}
        {!isUser && hasThinking && showThinking && (
          <div 
            className="px-3 py-2 rounded-lg bg-secondary/20 max-w-2xl border border-secondary/30 text-xs leading-relaxed text-foreground"
            data-testid={`thinking-bubble-${message.id}`}
          >
            <MarkdownMessage content={message.thinking || ''} isUser={false} />
          </div>
        )}

        {/* Parallel Execution Visualization */}
        {!isUser && message.parallelExecution && (
          <div className="max-w-2xl">
            <ParallelExecutionBadge
              tools={message.parallelExecution.tools}
              totalDuration={message.parallelExecution.totalDuration}
              estimatedSequentialDuration={message.parallelExecution.estimatedSequentialDuration}
            />
          </div>
        )}

        {/* Inline Reasoning (for assistant messages) */}
        {!isUser && message.reasoning && message.reasoning.length > 0 && (
          <div className="max-w-2xl">
            <InlineReasoning steps={message.reasoning} />
          </div>
        )}

        {/* Main message bubble - Enhanced with BeeHive theming */}
        <div 
          className={cn(
            "max-w-[85%] break-words transition-all shadow-md",
            compact ? "px-3 py-2" : "px-4 py-3",
            isUser
              ? 'bg-gradient-to-br from-blue-600 to-blue-700 dark:from-blue-700 dark:to-blue-800 text-white rounded-2xl rounded-tr-md'
              : 'bg-gradient-to-br from-amber-50 to-amber-100 dark:from-amber-950/40 dark:to-amber-900/30 text-slate-900 dark:text-slate-50 rounded-2xl rounded-tl-md border-2 border-amber-300 dark:border-amber-700/50'
          )}
          data-testid={`message-bubble-${message.id}`}
        >
          {/* Role label for accessibility */}
          <div className={cn(
            "text-[10px] font-bold uppercase tracking-wider mb-1.5 opacity-90",
            isUser ? "text-blue-100" : "text-amber-700 dark:text-amber-200"
          )}>
            {isUser ? "You" : "Scout"}
          </div>
          <div className={cn(
            "leading-relaxed font-medium",
            compact ? "text-sm" : "text-[15px]",
            isUser ? "text-blue-50" : "text-slate-950 dark:text-slate-100"
          )}>
            <MarkdownMessage content={message.content} isUser={isUser} />
          </div>

          {/* Image Rendering */}
          {message.images && message.images.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {message.images.map((imageUrl, idx) => (
                <div 
                  key={idx} 
                  className="rounded-lg border border-current/20 overflow-hidden bg-background/50 cursor-pointer hover:opacity-80 transition-opacity"
                  onClick={() => window.open(imageUrl, '_blank')}
                  data-testid={`message-image-${message.id}-${idx}`}
                >
                  <img 
                    src={imageUrl} 
                    alt={`Message image ${idx + 1}`}
                    className="max-w-xs max-h-64 object-cover"
                  />
                </div>
              ))}
            </div>
          )}

          {/* Token Usage Badge */}
          {!isUser && message.tokenUsage && (
            <div className="mt-2 flex gap-1 text-xs opacity-75">
              <span className="text-muted-foreground">Tokens:</span>
              <span>{message.tokenUsage.input}↓ {message.tokenUsage.output}↑</span>
            </div>
          )}
        </div>

        {/* Status Badges - Show for assistant messages */}
        {!isUser && (message.filesChanged?.length || message.status) && (
          <div className="flex items-center gap-2 flex-wrap">
            {message.status && (
              <Badge 
                variant="outline" 
                className={`gap-1 ${
                  message.status === 'success' ? 'text-green-600' :
                  message.status === 'error' ? 'text-red-600' :
                  'text-blue-600'
                }`}
              >
                {message.status === 'success' && <CheckCircle className="w-3 h-3" />}
                {message.status === 'error' && <AlertCircle className="w-3 h-3" />}
                <span className="text-xs">{message.status}</span>
              </Badge>
            )}
            {message.filesChanged?.length ? (
              <Badge variant="secondary" className="text-xs gap-1">
                <span>{message.filesChanged.length} files</span>
              </Badge>
            ) : null}
          </div>
        )}

        {/* Timestamp + Actions - Enhanced with pin button */}
        <div className={cn(
          "flex items-center gap-1.5 mt-2 px-1",
          isUser ? 'flex-row-reverse' : 'flex-row',
          "text-xs text-muted-foreground/75"
        )}>
          {message.timestamp && (
            <span className="text-[11px] text-muted-foreground/60">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          
          {/* Action buttons - visible on hover */}
          <div className={cn(
            "flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity",
            isPinned && "opacity-100"
          )}>
            {/* Pin button */}
            <Button
              size="icon"
              variant="ghost"
              className={cn(
                "h-6 w-6 rounded-full",
                isPinned ? "text-amber-500 hover:text-amber-600" : "hover:text-amber-500"
              )}
              onClick={handlePin}
              data-testid={`button-pin-message-${message.id}`}
              title={isPinned ? "Unpin message" : "Pin message"}
            >
              {isPinned ? (
                <PinOff className="w-3.5 h-3.5" />
              ) : (
                <Pin className="w-3.5 h-3.5" />
              )}
            </Button>
            
            {/* Copy button */}
            <Button
              size="icon"
              variant="ghost"
              className="h-6 w-6 rounded-full"
              onClick={copyMessage}
              data-testid={`button-copy-message-${message.id}`}
              title="Copy message"
            >
              {copied ? (
                <Check className="w-3.5 h-3.5 text-green-500" />
              ) : (
                <Copy className="w-3.5 h-3.5" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
