import { useRef, useEffect, useState } from "react";
import { EnhancedMessageDisplay } from "@/components/enhanced-message-display";
import { ScratchpadDisplay } from "@/components/scratchpad-display";
import { StatusStrip, BillingMetrics } from "@/components/agent/StatusStrip";
import { RunProgressTable } from "@/components/run-progress-table";
import { AgentProgress, type ProgressStep, type ProgressMetrics } from "@/components/agent-progress";
import { WorkflowTaskDisplay } from "@/components/workflow-task-display";
import { ValidationMetadataDisplay } from "@/components/agent/ValidationMetadataDisplay";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Loader2, Copy, Check, User } from "lucide-react";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import type { RunState, RunPhase } from "@shared/agentEvents";
import type { ScratchpadEntry } from "@/hooks/use-websocket-stream";

// ✅ FIX GAP #7: Import ScratchpadEntry type for proper typing

export interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  id?: string;
  messageId?: string;
  source?: string;
  progressSteps?: ProgressStep[];
  checkpoint?: {
    complexity: string;
    cost: number;
    estimatedTime: string;
    actions: string[];
  };
  isSummary?: boolean;
  images?: string[];
  progressMessages?: Array<{ 
    id: string; 
    message: string; 
    timestamp: number;
    category?: 'thinking' | 'action' | 'result';
  }>;
  // ✅ GAP #4: Add validation metadata field for display
  validationMetadata?: {
    valid?: boolean;
    truncated?: boolean;
    warnings?: string[];
    schemaValidated?: boolean;
  };
}

interface StreamState {
  currentFile?: {
    action: string;
    filename: string;
    language: string;
  } | null;
  fileSummary?: {
    filesChanged: number;
    linesAdded: number;
    linesRemoved?: number;
  } | null;  // ✅ FIX: Allow null from WebSocket data
  currentThought?: string;
  // ✅ FIX #7: Use actual ScratchpadEntry[] type instead of simplified shape
  scratchpad?: ScratchpadEntry[];
  // Allow spread of WebSocket StreamState
  [key: string]: any;
}

interface ChatMessagesProps {
  messages: Message[];
  isGenerating: boolean;
  runState: RunState | null;
  onImageZoom?: (imageUrl: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
  messagesEndRef?: React.RefObject<HTMLDivElement>;
  
  // Additional props for overlays and status
  currentPhase?: RunPhase;
  phaseMessage?: string;
  currentProgress?: ProgressStep[];
  currentMetrics?: ProgressMetrics;
  agentTasks?: Array<{ id: string; title: string; status: string }>;
  streamState?: StreamState;
  billingMetrics?: BillingMetrics;
  scratchpadEntries?: ScratchpadEntry[];
  sessionId?: string;
  onClearScratchpad?: () => void;
}

export function ChatMessages({ 
  messages, 
  isGenerating, 
  runState,
  onImageZoom,
  scrollRef,
  messagesEndRef,
  currentPhase = 'complete',
  phaseMessage = '',
  currentProgress = [],
  currentMetrics = {},
  agentTasks = [],
  streamState = {},
  billingMetrics,
  scratchpadEntries = [],
  sessionId = '',
  onClearScratchpad,
}: ChatMessagesProps) {
  const localScrollRef = useRef<HTMLDivElement>(null);
  const localMessagesEndRef = useRef<HTMLDivElement>(null);
  const [copiedChatHistory, setCopiedChatHistory] = useState(false);
  const { toast } = useToast();
  
  const activeScrollRef = scrollRef || localScrollRef;
  const activeMessagesEndRef = messagesEndRef || localMessagesEndRef;

  useEffect(() => {
    activeMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeMessagesEndRef]);

  const handleCopyChatHistory = () => {
    const chatHistory = messages
      .filter(m => !m.isSummary)
      .map(m => `${m.role === 'user' ? 'USER' : 'LOMU AI'}:\n${m.content}\n`)
      .join('\n---\n\n');
    navigator.clipboard.writeText(chatHistory);
    setCopiedChatHistory(true);
    setTimeout(() => setCopiedChatHistory(false), 2000);
    toast({ title: "✅ Chat copied!" });
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Unified Workflow Display - Replaces StatusStrip + RunProgressTable + AgentProgress */}
      {(isGenerating || currentProgress.length > 0 || runState) && (
        <div className="px-3 md:px-6 pt-3 md:pt-4 pb-2 md:pb-3 bg-card border-b border-border">
          <WorkflowTaskDisplay
            phase={currentPhase}
            currentMessage={phaseMessage}
            steps={currentProgress}
            metrics={currentMetrics}
            isGenerating={isGenerating}
            runState={runState}
            isCompact={typeof window !== 'undefined' && window.innerWidth < 768}
          />
        </div>
      )}

      {/* Copy Chat History Button */}
      {messages.length > 1 && (
        <div className="px-4 py-2 border-b border-border bg-muted/20 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={handleCopyChatHistory}
            className="h-7 gap-1.5"
            data-testid="button-copy-chat"
          >
            {copiedChatHistory ? (
              <>
                <Check className="h-3.5 w-3.5" />
                <span className="text-xs">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                <span className="text-xs">Copy Chat</span>
              </>
            )}
          </Button>
        </div>
      )}

      {/* Messages Area */}
      <div
        ref={activeScrollRef}
        className="flex-1 min-h-0 overflow-y-auto px-3 md:px-6 py-4 md:py-6 space-y-4 md:space-y-6"
        data-testid="chat-messages-container"
      >
        {messages.filter((msg) => {
          // Always show user messages
          if (msg.role === 'user') return true;
          // Show assistant messages if they have content
          if (msg.content.trim().length > 0) return true;
          // Show empty assistant messages if we're generating (streaming)
          if (isGenerating && msg.role === 'assistant') return true;
          return false;
        }).map((message, index) => (
          <div
            key={message.id || message.messageId || index}
            className={cn(
              "flex gap-3",
              message.role === 'user' ? 'justify-end' : 'justify-start'
            )}
          >
            {/* Assistant Avatar */}
            {message.role === 'assistant' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-semibold text-sm">
                AI
              </div>
            )}

            {/* Message Content */}
            <div className={cn(
              "flex-1 max-w-[85%]",
              message.role === 'user' && 'max-w-[75%]'
            )}>
              {/* User messages: simple card */}
              {message.role === 'user' ? (
                <Card className="bg-primary/5 border-primary/20">
                  <CardContent className="p-3 md:p-4">
                    <div className="flex items-start gap-2">
                      <User className="w-5 h-5 mt-0.5 flex-shrink-0 text-primary" />
                      <div className="flex-1">
                        <p className="text-sm md:text-base whitespace-pre-wrap break-words">{message.content}</p>
                        
                        {/* User-attached images */}
                        {message.images && message.images.length > 0 && (
                          <div className="mt-3 flex flex-wrap gap-2">
                            {message.images.map((imageUrl, imgIndex) => (
                              <img
                                key={imgIndex}
                                src={imageUrl}
                                alt={`Attached ${imgIndex + 1}`}
                                className="max-w-xs max-h-64 rounded border border-border cursor-pointer hover-elevate"
                                onClick={() => onImageZoom?.(imageUrl)}
                                data-testid={`user-image-${index}-${imgIndex}`}
                              />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                /* Assistant messages: enhanced display */
                <div className="space-y-3">
                  {/* Checkpoint display (if present) */}
                  {message.checkpoint && (
                    <Card className="bg-yellow-50/50 border-yellow-200/50 dark:border-yellow-800/30">
                      <CardContent className="p-4">
                        <div className="flex items-start gap-2">
                          <div className="text-xl">⚠️</div>
                          <div className="flex-1 space-y-2">
                            <h4 className="font-semibold text-sm md:text-base">Checkpoint Required</h4>
                            <p className="text-sm md:text-base text-muted-foreground">
                              Complexity: <span className="font-medium">{message.checkpoint.complexity}</span> |
                              Estimated Cost: <span className="font-medium">${message.checkpoint.cost.toFixed(2)}</span> |
                              Time: <span className="font-medium">{message.checkpoint.estimatedTime}</span>
                            </p>
                            <div className="text-sm">
                              <p className="font-medium mb-1">Planned Actions:</p>
                              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground">
                                {message.checkpoint.actions.map((action, i) => (
                                  <li key={i}>{action}</li>
                                ))}
                              </ul>
                            </div>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {/* Main content with progress */}
                  <EnhancedMessageDisplay
                    content={message.content}
                    progressMessages={message.progressMessages}
                    isStreaming={isGenerating && index === messages.length - 1}
                  />
                  
                  {/* ✅ GAP #4: Display validation metadata for tool results */}
                  {message.validationMetadata && (
                    <ValidationMetadataDisplay metadata={message.validationMetadata} />
                  )}
                </div>
              )}
            </div>

            {/* User Avatar */}
            {message.role === 'user' && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <User className="w-4 h-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {/* Scratchpad Display (if entries exist) */}
        {scratchpadEntries.length > 0 && sessionId && (
          <div className="mt-4">
            <ScratchpadDisplay
              entries={scratchpadEntries}
              sessionId={sessionId}
              onClear={onClearScratchpad}
            />
          </div>
        )}

        {isGenerating && (
          <div className="flex items-center gap-2 text-muted-foreground" data-testid="typing-indicator">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span className="text-base md:text-lg">Hexad is thinking...</span>
          </div>
        )}

        <div ref={activeMessagesEndRef} />
      </div>

      {/* WebSocket Stream: File Status */}
      {streamState?.currentFile && (
        <div className="mx-4 mb-2 px-3 py-1.5 bg-card border-l-2 border-emerald-500/60 rounded text-sm" data-testid="stream-file-status">
          <p className="text-[hsl(220,10%,72%)] flex items-center gap-2">
            <span className="font-mono text-[hsl(220,70%,60%)]">{streamState.currentFile.action}</span>
            <span className="font-mono">{streamState.currentFile.filename}</span>
            <span className="ml-auto text-muted-foreground">{streamState.currentFile.language}</span>
            <Loader2 className="w-3 h-3 animate-spin text-[hsl(220,70%,60%)]" />
          </p>
        </div>
      )}

      {/* WebSocket Stream: File Summary */}
      {streamState?.fileSummary && !streamState?.currentFile && (
        <div className="mx-4 mb-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-sm" data-testid="stream-file-summary">
          <div className="flex items-center justify-between text-emerald-200">
            <span className="font-semibold">
              ✓ Modified {streamState.fileSummary.filesChanged} file{streamState.fileSummary.filesChanged !== 1 ? 's' : ''}
            </span>
            <span className="text-emerald-300/70">
              +{streamState.fileSummary.linesAdded} lines
              {streamState.fileSummary.linesRemoved !== undefined && ` / -${streamState.fileSummary.linesRemoved}`}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}
