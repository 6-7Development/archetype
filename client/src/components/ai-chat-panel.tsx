import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Bot, User, Loader2, X, Sparkles } from "lucide-react";
import type { ChatMessage } from "@shared/schema";
import { Badge } from "@/components/ui/badge";

interface AiChatPanelProps {
  messages: ChatMessage[];
  onSendMessage: (content: string) => void;
  isLoading: boolean;
  onClose: () => void;
}

export function AiChatPanel({ messages, onSendMessage, isLoading, onClose }: AiChatPanelProps) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (input.trim() && !isLoading) {
      onSendMessage(input.trim());
      setInput("");
    }
  };

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between h-14 px-4 border-b border-card-border bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-3">
          <div className="p-1.5 bg-primary/10 rounded-lg">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <div>
            <span className="text-sm font-semibold tracking-tight">AI Assistant</span>
            <Badge variant="outline" className="ml-2 text-xs h-5">GPT-4</Badge>
          </div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7"
          onClick={onClose}
          data-testid="button-close-chat"
        >
          <X className="h-4 w-4" />
        </Button>
      </div>

      <ScrollArea className="flex-1 p-4" ref={scrollRef}>
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center p-6">
            <div className="p-5 bg-gradient-to-br from-primary/10 to-primary/5 rounded-2xl mb-6">
              <Sparkles className="h-14 w-14 text-primary" />
            </div>
            <h3 className="text-base font-semibold mb-2 tracking-tight">AI Code Assistant</h3>
            <p className="text-xs text-muted-foreground max-w-[280px] leading-relaxed">
              Ask me to generate, modify, or explain code. I'll inject the results directly into your editor with precision.
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex gap-3 ${
                  message.role === "user" ? "justify-end" : "justify-start"
                }`}
                data-testid={`message-${message.id}`}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-sm">
                    <Bot className="h-5 w-5 text-primary" />
                  </div>
                )}
                <div
                  className={`max-w-[85%] rounded-xl px-4 py-3 shadow-sm ${
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted border border-border"
                  }`}
                >
                  <pre className="text-sm whitespace-pre-wrap font-sans break-words leading-relaxed">
                    {message.content}
                  </pre>
                </div>
                {message.role === "user" && (
                  <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-gradient-to-br from-secondary/30 to-secondary/20 flex items-center justify-center shadow-sm">
                    <User className="h-5 w-5 text-secondary-foreground" />
                  </div>
                )}
              </div>
            ))}
            {isLoading && (
              <div className="flex gap-3 justify-start">
                <div className="flex-shrink-0 h-9 w-9 rounded-xl bg-gradient-to-br from-primary/20 to-primary/10 flex items-center justify-center shadow-sm">
                  <Bot className="h-5 w-5 text-primary" />
                </div>
                <div className="bg-muted border border-border rounded-xl px-4 py-3 shadow-sm">
                  <div className="flex items-center gap-2">
                    <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    <span className="text-sm text-muted-foreground">Thinking...</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </ScrollArea>

      <form onSubmit={handleSubmit} className="p-4 border-t border-card-border bg-card/50">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Describe what you want to build..."
              className="resize-none text-sm min-h-[60px] pr-12"
              disabled={isLoading}
              data-testid="input-chat-message"
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSubmit(e);
                }
              }}
            />
            <Button
              type="submit"
              size="icon"
              disabled={!input.trim() || isLoading}
              className="absolute bottom-2 right-2 h-8 w-8 shadow-md hover:shadow-lg transition-all"
              data-testid="button-send-message"
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] border border-border">Enter</kbd>
          to send,
          <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] border border-border">Shift+Enter</kbd>
          for new line
        </p>
      </form>
    </div>
  );
}
