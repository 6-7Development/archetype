import { useState } from "react";
import { Copy, Check, User, ChevronDown, Brain, CheckCircle, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { MarkdownMessage } from "./MarkdownMessage";
import { InlineReasoning, type ReasoningStep } from "@/components/inline-reasoning";
import { ParallelExecutionBadge } from "@/components/parallel-execution-badge";
import { ConsultationCostBadge } from "@/components/consultation-cost-badge";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  thinking?: string; // Internal monologue/thought block
  reasoning?: ReasoningStep[]; // IDE-style reasoning steps
  timestamp?: Date;
  id?: string;
  messageId?: string;
  images?: string[];
  filesChanged?: string[]; // Files modified in this response
  status?: 'success' | 'error' | 'pending'; // Operation status
  tokenUsage?: { input: number; output: number }; // Token consumption
  parallelExecution?: { // FAST mode execution data
    tools: Array<{ name: string; duration: number; status: 'completed' | 'running' | 'pending' }>;
    totalDuration: number;
    estimatedSequentialDuration: number;
  };
  [key: string]: any;
}

interface MessageBubbleProps {
  message: Message;
  index: number;
  totalMessages: number;
}

export function MessageBubble({ message, index, totalMessages }: MessageBubbleProps) {
  const { toast } = useToast();
  const [copied, setCopied] = useState(false);
  const [showThinking, setShowThinking] = useState(false);

  const isUser = message.role === 'user';
  const isLast = index === totalMessages - 1;
  const hasThinking = message.thinking && message.thinking.trim().length > 0;
  const hasContent = message.content && message.content.trim().length > 0;
  
  // Skip rendering empty assistant messages (these are placeholder messages)
  if (!isUser && !hasContent && !hasThinking) {
    return null;
  }

  const copyMessage = () => {
    navigator.clipboard.writeText(message.content);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
    toast({ title: "Message copied!" });
  };

  return (
    <div 
      key={message.id || message.messageId} 
      className={`flex gap-2.5 group ${isUser ? 'flex-row-reverse' : 'flex-row'} pb-1`}
      data-testid={`message-container-${message.id}`}
    >
      {/* Avatar */}
      <div 
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium transition-all ${
          isUser 
            ? 'bg-primary/15 text-primary' 
            : 'bg-secondary/20 text-secondary-foreground'
        }`}
        data-testid={`avatar-${message.role}`}
        title={isUser ? 'You' : 'Hexad'}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <span className="font-bold text-xs">AI</span>
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 min-w-0 flex flex-col ${isUser ? 'items-end' : 'items-start'} gap-2`}>
        {/* Thinking bubble (collapsible, for assistant only) */}
        {!isUser && hasThinking && (
          <button
            onClick={() => setShowThinking(!showThinking)}
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-secondary/30 hover:bg-secondary/40 transition-colors text-foreground max-w-2xl group/thinking font-medium"
            data-testid={`button-toggle-thinking-${message.id}`}
          >
            <Brain className="w-3.5 h-3.5 flex-shrink-0" />
            <span className="text-xs">Thinking...</span>
            <ChevronDown className={`w-3 h-3 flex-shrink-0 transition-transform ${showThinking ? 'rotate-180' : ''}`} />
          </button>
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

        {/* Main message bubble */}
        <div 
          className={`px-3 py-2 max-w-2xl break-words transition-all ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-lg rounded-tr-sm'
              : 'bg-secondary/50 text-foreground font-medium rounded-lg rounded-tl-sm'
          }`}
          data-testid={`message-bubble-${message.id}`}
        >
          <div className="text-sm leading-relaxed">
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

        {/* Timestamp + Actions - Always visible but subtle */}
        <div className={`flex items-center gap-1 mt-1.5 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'} text-xs text-muted-foreground/75`}>
          {message.timestamp && (
            <span className="text-xs text-muted-foreground/70">
              {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
            </span>
          )}
          <Button
            size="icon"
            variant="ghost"
            className="h-5 w-5 opacity-0 group-hover:opacity-100 transition-opacity hover:opacity-100"
            onClick={copyMessage}
            data-testid={`button-copy-message-${message.id}`}
            title="Copy message"
          >
            {copied ? (
              <Check className="w-3 h-3 text-green-600" />
            ) : (
              <Copy className="w-3 h-3" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
