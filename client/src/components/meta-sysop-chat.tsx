import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Loader2, Wrench, User, FileCode, GitBranch, AlertTriangle, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { MarkdownRenderer } from "@/components/markdown-renderer";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  platformChanges?: {
    files: Array<{ path: string; operation: string }>;
  };
  createdAt: string;
}

interface MetaSySopChatProps {
  autoCommit?: boolean;
  autoPush?: boolean;
}

export function MetaSySopChat({ autoCommit = false, autoPush = false }: MetaSySopChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  // Load Meta-SySop chat history
  const { data: chatHistory, isLoading } = useQuery<{ messages: Message[] }>({
    queryKey: ['/api/platform/chat/history'],
  });

  // Initialize messages from history
  useEffect(() => {
    if (chatHistory?.messages) {
      setMessages(chatHistory.messages);
    }
  }, [chatHistory]);

  // Auto-scroll to top to show newest messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0;
    }
  }, [messages, streamingContent]);

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      // Add user message immediately
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: userMessage,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);
      setInput("");
      setIsStreaming(true);
      setStreamingContent("");

      // Start streaming response
      const response = await fetch('/api/platform/chat/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          autoCommit,
          autoPush,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error('Failed to get streaming response');
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullContent = "";
      let fileChanges: any[] = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        const lines = chunk.split('\n');

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            const data = JSON.parse(line.slice(6));
            
            if (data.type === 'content') {
              fullContent += data.content;
              setStreamingContent(fullContent);
            } else if (data.type === 'file_change') {
              fileChanges.push(data.file);
            } else if (data.type === 'done') {
              // Add complete assistant message
              const assistantMsg: Message = {
                id: data.messageId,
                role: "assistant",
                content: fullContent,
                platformChanges: fileChanges.length > 0 ? { files: fileChanges } : undefined,
                createdAt: new Date().toISOString(),
              };
              setMessages(prev => [...prev, assistantMsg]);
              setIsStreaming(false);
              setStreamingContent("");
              
              // Refresh history to persist
              queryClient.invalidateQueries({ queryKey: ['/api/platform/chat/history'] });
            }
          }
        }
      }
    },
    onError: (error: any) => {
      console.error('Meta-SySop error:', error);
      setIsStreaming(false);
      setStreamingContent("");
      
      // Add error message
      const errorMsg: Message = {
        id: Date.now().toString(),
        role: "assistant",
        content: `⚠️ **Error:** ${error.message || 'Failed to process request'}`,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, errorMsg]);
    },
  });

  const handleSend = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || sendMutation.isPending) return;
    sendMutation.mutate(trimmedInput);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden">
      {/* Chat Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-3 sm:space-y-4 p-2 sm:p-4"
      >
        {/* Welcome message */}
        {messages.length === 0 && (
          <div className="text-center py-8">
            <Wrench className="h-12 w-12 mx-auto mb-4 text-primary" />
            <h3 className="text-lg font-semibold mb-2">Meta-SySop Platform Healing</h3>
            <p className="text-muted-foreground max-w-md mx-auto">
              I'm Meta-SySop. I can diagnose and fix issues with the Archetype platform itself. 
              Tell me what needs to be fixed, and I'll analyze the code, make changes, and optionally 
              commit and deploy them.
            </p>
          </div>
        )}

        {/* Message list - Newest first */}
        {messages.slice().reverse().map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
                <Wrench className="h-4 w-4 text-primary" />
              </div>
            )}
            
            <div
              className={cn(
                "rounded-lg px-4 py-3 max-w-[80%]",
                message.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted"
              )}
            >
              <MarkdownRenderer content={message.content} />
              
              {/* File changes indicator */}
              {message.platformChanges && message.platformChanges.files.length > 0 && (
                <div className="mt-3 pt-3 border-t border-border space-y-1">
                  <div className="flex items-center gap-2 text-sm font-medium mb-2">
                    <FileCode className="h-4 w-4" />
                    Modified Files ({message.platformChanges.files.length})
                  </div>
                  {message.platformChanges.files.map((file, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-xs">
                      <Badge variant="outline" className="font-mono">
                        {file.operation}
                      </Badge>
                      <span className="text-muted-foreground font-mono">{file.path}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {message.role === "user" && (
              <div className="flex-shrink-0 w-8 h-8 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex gap-3 justify-start">
            <div className="flex-shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
              <Wrench className="h-4 w-4 text-primary" />
            </div>
            <div className="rounded-lg px-4 py-3 max-w-[80%] bg-muted">
              {streamingContent ? (
                <MarkdownRenderer content={streamingContent} />
              ) : (
                <Loader2 className="h-4 w-4 animate-spin" />
              )}
              <div className="flex items-center gap-2 mt-2 text-xs text-muted-foreground">
                <Loader2 className="h-3 w-3 animate-spin" />
                Meta-SySop is thinking...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="border-t p-2 sm:p-4 bg-background">
        <div className="flex gap-2">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the platform issue to fix..."
            className="resize-none text-sm sm:text-base"
            rows={2}
            data-testid="input-meta-sysop-message"
            disabled={isStreaming}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-auto flex-shrink-0"
            data-testid="button-send-meta-sysop-message"
          >
            {isStreaming ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
          </Button>
        </div>
        
        {/* Status indicators - Hidden on mobile */}
        <div className="hidden sm:flex items-center gap-4 mt-2 text-xs text-muted-foreground">
          {autoCommit && (
            <div className="flex items-center gap-1">
              <GitBranch className="h-3 w-3" />
              Auto-commit enabled
            </div>
          )}
          {autoPush && (
            <div className="flex items-center gap-1">
              <CheckCircle className="h-3 w-3" />
              Auto-push enabled (triggers deployment)
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
