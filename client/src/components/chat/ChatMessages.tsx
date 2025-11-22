import { useRef, useEffect } from "react";
import { EnhancedMessageDisplay } from "@/components/enhanced-message-display";
import { Loader2 } from "lucide-react";
import type { RunState } from "@shared/agentEvents";
import type { ProgressStep } from "@/components/agent-progress";

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
}

interface ChatMessagesProps {
  messages: Message[];
  isGenerating: boolean;
  runState: RunState | null;
  onImageZoom?: (imageUrl: string) => void;
  scrollRef?: React.RefObject<HTMLDivElement>;
  messagesEndRef?: React.RefObject<HTMLDivElement>;
}

export function ChatMessages({ 
  messages, 
  isGenerating, 
  runState,
  onImageZoom,
  scrollRef,
  messagesEndRef 
}: ChatMessagesProps) {
  const localScrollRef = useRef<HTMLDivElement>(null);
  const localMessagesEndRef = useRef<HTMLDivElement>(null);
  
  const activeScrollRef = scrollRef || localScrollRef;
  const activeMessagesEndRef = messagesEndRef || localMessagesEndRef;

  useEffect(() => {
    activeMessagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, activeMessagesEndRef]);

  return (
    <div
      ref={activeScrollRef}
      className="flex-1 overflow-y-auto px-4 py-6 space-y-6"
      data-testid="chat-messages-container"
    >
      {messages.map((message, index) => (
        <EnhancedMessageDisplay
          key={message.id || message.messageId || index}
          content={message.content}
          progressMessages={message.progressMessages}
          isStreaming={false}
        />
      ))}

      {isGenerating && (
        <div className="flex items-center gap-2 text-muted-foreground" data-testid="typing-indicator">
          <Loader2 className="w-4 h-4 animate-spin" />
          <span className="text-sm">LomuAI is thinking...</span>
        </div>
      )}

      <div ref={activeMessagesEndRef} />
    </div>
  );
}
