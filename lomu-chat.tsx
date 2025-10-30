import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Loader2, Wrench, User, FileCode, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { TaskBoard } from "@/components/task-board";
import type { Task } from "@/hooks/use-websocket-stream";

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

// Copy button component for code blocks
function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({
        title: "Copied to clipboard",
        description: "Code copied successfully",
      });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({
        title: "Failed to copy",
        description: "Could not copy code to clipboard",
        variant: "destructive",
      });
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 hover:border-slate-500 transition-all text-slate-300 hover:text-white"
      data-testid="button-copy-code"
    >
      {copied ? (
        <Check className="w-3.5 h-3.5" />
      ) : (
        <Copy className="w-3.5 h-3.5" />
      )}
    </button>
  );
}

// Enhanced message renderer with code block support
function MessageContent({ content }: { content: string }) {
  // Split content into parts: text and code blocks
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
  let remaining = content;
  
  // Regex to match code blocks ```language\ncode\n```
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    // Add text before code block
    if (match.index > lastIndex) {
      parts.push({
        type: 'text',
        content: content.slice(lastIndex, match.index),
      });
    }
    
    // Add code block
    parts.push({
      type: 'code',
      content: match[2].trim(),
      language: match[1] || 'text',
    });
    
    lastIndex = match.index + match[0].length;
  }
  
  // Add remaining text
  if (lastIndex < content.length) {
    parts.push({
      type: 'text',
      content: content.slice(lastIndex),
    });
  }
  
  // If no code blocks found, just render the text
  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }

  return (
    <div className="space-y-2">
      {parts.map((part, index) => (
        part.type === 'code' ? (
          <div key={index} className="relative group">
            <div className="bg-slate-950/90 border border-slate-700/50 rounded-lg p-3 overflow-x-auto">
              <div className="text-[10px] text-slate-500 uppercase mb-2 font-semibold">
                {part.language}
              </div>
              <pre className="text-xs text-emerald-300 font-mono leading-relaxed">
                {part.content}
              </pre>
            </div>
            <CodeCopyButton code={part.content} />
          </div>
        ) : (
          <div key={index} className="text-sm leading-relaxed whitespace-pre-wrap">
            {part.content.split('\n').map((line, i) => {
              // Check for **bold** text
              const boldRegex = /\*\*(.*?)\*\*/g;
              if (boldRegex.test(line)) {
                const segments = [];
                let lastIdx = 0;
                let boldMatch;
                boldRegex.lastIndex = 0; // Reset regex
                
                while ((boldMatch = boldRegex.exec(line)) !== null) {
                  // Add text before bold
                  if (boldMatch.index > lastIdx) {
                    segments.push(
                      <span key={`text-${i}-${lastIdx}`}>
                        {line.slice(lastIdx, boldMatch.index)}
                      </span>
                    );
                  }
                  // Add bold text
                  segments.push(
                    <strong key={`bold-${i}-${boldMatch.index}`} className="font-semibold text-slate-100">
                      {boldMatch[1]}
                    </strong>
                  );
                  lastIdx = boldMatch.index + boldMatch[0].length;
                }
                // Add remaining text
                if (lastIdx < line.length) {
                  segments.push(
                    <span key={`text-${i}-${lastIdx}`}>
                      {line.slice(lastIdx)}
                    </span>
                  );
                }
                
                return <div key={i}>{segments}</div>;
              }
              return <div key={i}>{line || '\u00A0'}</div>;
            })}
          </div>
        )
      ))}
    </div>
  );
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

  // Fetch live task progress
  const { data: tasksData } = useQuery<{ tasks: Task[] }>({
    queryKey: ['/api/platform/tasks'],
    refetchInterval: 1000, // Poll every second for real-time updates
  });

  const tasks = tasksData?.tasks || [];

  // Initialize messages from history
  useEffect(() => {
    if (chatHistory?.messages) {
      setMessages(chatHistory.messages);
    }
  }, [chatHistory]);

  // Auto-scroll to bottom to show newest messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
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
        content: `**Error:** ${error.message || 'Failed to process request'}`,
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
      <div className="flex items-center justify-center h-full bg-slate-900/60">
        <div className="flex items-center gap-3 text-slate-400">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span className="text-sm">Loading chat history...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden bg-slate-900/60">
      {/* TaskBoard - Live progress display */}
      {tasks.length > 0 && (
        <div className="border-b border-slate-700/50 p-4">
          <TaskBoard tasks={tasks} isGenerating={isStreaming} />
        </div>
      )}

      {/* Chat Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-4 p-6"
      >
        {/* Welcome message */}
        {messages.length === 0 && !isStreaming && (
          <div className="text-center py-16">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center shadow-lg shadow-slate-700/30">
              <Wrench className="h-8 w-8 text-white" />
            </div>
            <h3 className="text-xl font-bold text-slate-100 mb-2">Meta-SySop Ready</h3>
            <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
              I'm Meta-SySop, your autonomous platform healing agent. I can diagnose and fix issues 
              with the Archetype platform itself. Tell me what needs to be fixed, and I'll analyze 
              the code, make changes, and optionally commit and deploy them.
            </p>
          </div>
        )}

        {/* Message list */}
        {messages.map((message) => (
          <div
            key={message.id}
            className={cn(
              "flex gap-3 animate-in fade-in-up duration-500",
              message.role === "user" ? "justify-end" : "justify-start"
            )}
          >
            {message.role === "assistant" && (
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center shadow-lg shadow-slate-700/20">
                <Wrench className="h-5 w-5 text-white" />
              </div>
            )}
            
            <div
              className={cn(
                "rounded-xl px-4 py-3 max-w-[75%] shadow-lg",
                message.role === "user"
                  ? "bg-gradient-to-br from-slate-700 to-slate-600 text-white border border-slate-500/20"
                  : "bg-slate-800/80 text-slate-200 border border-slate-700/50 backdrop-blur-sm"
              )}
            >
              <MessageContent content={message.content} />
              
              {/* File changes indicator */}
              {message.platformChanges && message.platformChanges.files.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
                    <FileCode className="h-3.5 w-3.5" />
                    Modified Files ({message.platformChanges.files.length})
                  </div>
                  <div className="space-y-1.5">
                    {message.platformChanges.files.map((file, idx) => (
                      <div key={idx} className="flex items-center gap-2 text-xs bg-slate-900/50 rounded px-2 py-1.5 border border-slate-700/30">
                        <Badge variant="outline" className="text-[10px] h-5 font-mono bg-slate-700/10 text-slate-300 border-slate-600/30">
                          {file.operation}
                        </Badge>
                        <span className="text-slate-400 font-mono flex-1 truncate">{file.path}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {message.role === "user" && (
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center">
                <User className="h-5 w-5 text-slate-300" />
              </div>
            )}
          </div>
        ))}

        {/* Streaming indicator */}
        {isStreaming && (
          <div className="flex gap-3 justify-start animate-in fade-in-up duration-500">
            <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center shadow-lg shadow-slate-700/20">
              <Wrench className="h-5 w-5 text-white" />
            </div>
            <div className="rounded-xl px-4 py-3 max-w-[75%] bg-slate-800/80 text-slate-200 border border-slate-700/50 backdrop-blur-sm shadow-lg">
              {streamingContent ? (
                <MessageContent content={streamingContent} />
              ) : (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
              )}
              <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/50 text-xs text-slate-400">
                <Loader2 className="h-3 w-3 animate-spin" />
                Meta-SySop is thinking...
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area - Fixed at bottom */}
      <div className="border-t border-slate-800/50 p-4 bg-slate-950/50 backdrop-blur-xl flex-shrink-0">
        <div className="flex gap-3 items-end max-w-5xl mx-auto">
          <Textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe the platform issue to fix..."
            className="min-h-[70px] max-h-[200px] resize-none bg-slate-800/50 border-slate-700/50 text-slate-100 placeholder:text-slate-500 rounded-xl focus:border-slate-500/50 focus:ring-2 focus:ring-slate-500/20"
            rows={3}
            data-testid="input-meta-sysop-message"
            disabled={isStreaming}
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || isStreaming}
            size="icon"
            className="h-[70px] w-[70px] flex-shrink-0 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 shadow-lg shadow-slate-700/30 transition-all hover:scale-105 active:scale-95"
            data-testid="button-send-meta-sysop-message"
          >
            {isStreaming ? (
              <Loader2 className="h-6 w-6 animate-spin" />
            ) : (
              <Send className="h-6 w-6" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
