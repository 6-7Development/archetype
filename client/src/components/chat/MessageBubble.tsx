import { useState } from "react";
import { Copy, Check, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { MarkdownMessage } from "./MarkdownMessage";

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  id?: string;
  messageId?: string;
  images?: string[];
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

  const isUser = message.role === 'user';
  const isLast = index === totalMessages - 1;

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
        title={isUser ? 'You' : 'LomuAI'}
      >
        {isUser ? (
          <User className="w-4 h-4" />
        ) : (
          <span className="font-bold text-xs">AI</span>
        )}
      </div>

      {/* Message Content */}
      <div className={`flex-1 min-w-0 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
        {/* Message bubble */}
        <div 
          className={`px-3 py-2 max-w-2xl break-words transition-all ${
            isUser
              ? 'bg-primary text-primary-foreground rounded-lg rounded-tr-sm'
              : 'bg-secondary/50 text-foreground rounded-lg rounded-tl-sm'
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
        </div>

        {/* Timestamp + Actions - Always visible but subtle */}
        <div className={`flex items-center gap-1 mt-1.5 px-1 ${isUser ? 'flex-row-reverse' : 'flex-row'} text-xs text-muted-foreground/60`}>
          {message.timestamp && (
            <span className="text-xs opacity-70">
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
