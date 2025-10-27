import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Loader2, Wrench, User, FileCode, Copy, Check, Paperclip, X, Image, FileText, Zap, Shield, Brain, Infinity } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";

interface Attachment {
  fileName: string;
  fileType: 'image' | 'code' | 'log' | 'text';
  content: string; // base64 for images, text for others
  mimeType: string;
  size: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  platformChanges?: {
    files: Array<{ path: string; operation: string }>;
  };
  attachments?: Attachment[];
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
  const [progressMessage, setProgressMessage] = useState("");
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();

  // Load Meta-SySop chat history
  const { data: chatHistory, isLoading } = useQuery<{ messages: Message[] }>({
    queryKey: ['/api/meta-sysop/history'],
  });

  // Load autonomy level
  const { data: autonomyData } = useQuery<{
    currentLevel: string;
    maxAllowedLevel: string;
    plan: string;
    isOwner: boolean;
    levels: Record<string, { id: string; name: string; description: string; icon: string }>;
  }>({
    queryKey: ['/api/meta-sysop/autonomy-level'],
  });

  // Update autonomy level mutation
  const updateAutonomyMutation = useMutation({
    mutationFn: async (level: string) => {
      return await apiRequest('/api/meta-sysop/autonomy-level', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/meta-sysop/autonomy-level'] });
      toast({
        title: "Autonomy updated",
        description: "Meta-SySop autonomy level changed successfully",
      });
    },
    onError: (error: any) => {
      toast({
        title: "Failed to update autonomy",
        description: error.message,
        variant: "destructive",
      });
    },
  });

  // Initialize messages from history
  useEffect(() => {
    if (chatHistory?.messages) {
      setMessages(chatHistory.messages);
    }
  }, [chatHistory]);

  // Smooth auto-scroll to bottom to show newest messages
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTo({
        top: scrollRef.current.scrollHeight,
        behavior: 'smooth'
      });
    }
  }, [messages, streamingContent]);

  // File processing helper
  const processFile = async (file: File): Promise<Attachment | null> => {
    const maxSize = 10 * 1024 * 1024; // 10MB limit
    if (file.size > maxSize) {
      toast({
        title: "File too large",
        description: `${file.name} exceeds 10MB limit`,
        variant: "destructive",
      });
      return null;
    }

    // Determine file type
    let fileType: 'image' | 'code' | 'log' | 'text' = 'text';
    if (file.type.startsWith('image/')) {
      fileType = 'image';
    } else if (file.name.endsWith('.log') || file.name.includes('log')) {
      fileType = 'log';
    } else if (
      file.name.match(/\.(js|ts|tsx|jsx|py|java|cpp|c|h|css|html|json|xml|yaml|yml|sql)$/i)
    ) {
      fileType = 'code';
    }

    // Read file content
    return new Promise((resolve) => {
      const reader = new FileReader();
      
      reader.onload = (e) => {
        const content = e.target?.result as string;
        resolve({
          fileName: file.name,
          fileType,
          content: fileType === 'image' ? content : content, // base64 for images
          mimeType: file.type || 'application/octet-stream',
          size: file.size,
        });
      };

      reader.onerror = () => {
        toast({
          title: "Error reading file",
          description: `Failed to read ${file.name}`,
          variant: "destructive",
        });
        resolve(null);
      };

      if (fileType === 'image') {
        reader.readAsDataURL(file); // base64 for images
      } else {
        reader.readAsText(file); // text for code/logs
      }
    });
  };

  // Handle file selection
  const handleFileSelect = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    
    const maxFiles = 5;
    if (attachments.length + files.length > maxFiles) {
      toast({
        title: "Too many files",
        description: `Maximum ${maxFiles} attachments allowed`,
        variant: "destructive",
      });
      return;
    }

    const newAttachments: Attachment[] = [];
    for (let i = 0; i < files.length; i++) {
      const attachment = await processFile(files[i]);
      if (attachment) {
        newAttachments.push(attachment);
      }
    }

    setAttachments(prev => [...prev, ...newAttachments]);
    toast({
      title: "Files attached",
      description: `${newAttachments.length} file(s) ready to send`,
    });
  };

  // Handle paste event
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const files: File[] = [];
    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Handle images from clipboard
      if (item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
      // Handle text files from clipboard
      else if (item.kind === 'file') {
        const file = item.getAsFile();
        if (file) files.push(file);
      }
    }

    if (files.length > 0) {
      e.preventDefault();
      const fileList = files.reduce((dt, file) => {
        dt.items.add(file);
        return dt;
      }, new DataTransfer()).files;
      
      await handleFileSelect(fileList);
    }
  };

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.currentTarget === e.target) {
      setIsDragging(false);
    }
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    
    await handleFileSelect(e.dataTransfer.files);
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Send message mutation
  const sendMutation = useMutation({
    mutationFn: async (userMessage: string) => {
      // Add user message immediately with attachments
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: userMessage,
        attachments: attachments.length > 0 ? [...attachments] : undefined,
        createdAt: new Date().toISOString(),
      };
      setMessages(prev => [...prev, userMsg]);
      setInput("");
      const currentAttachments = [...attachments]; // Save for API call
      setAttachments([]); // Clear attachments after sending
      setIsStreaming(true);
      setStreamingContent("");
      setProgressMessage("🧠 Connecting to Meta-SySop...");

      // Start streaming response
      const response = await fetch('/api/meta-sysop/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
          message: userMessage,
          attachments: currentAttachments,
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

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          const chunk = decoder.decode(value, { stream: true });
          const lines = chunk.split('\n');

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const data = JSON.parse(line.slice(6));
              
              if (data.type === 'progress') {
                // SHOW PROGRESS in UI
                setProgressMessage(data.message);
              } else if (data.type === 'content') {
                fullContent += data.content;
                setStreamingContent(fullContent);
              } else if (data.type === 'file_change') {
                fileChanges.push(data.file);
              } else if (data.type === 'error') {
                console.error('[META-SYSOP] Error:', data.message);
                throw new Error(data.message);
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
                setProgressMessage(""); // CLEAR PROGRESS
                
                // Refresh history to persist
                queryClient.invalidateQueries({ queryKey: ['/api/meta-sysop/history'] });
              }
            }
          }
        }
      } catch (error) {
        // Cancel reader on error to clean up resources
        await reader.cancel();
        throw error; // Re-throw to trigger onError
      } finally {
        // Always clean up state, even if stream completes normally
        setIsStreaming(false);
        setProgressMessage("");
      }
    },
    onError: (error: any) => {
      console.error('Meta-SySop error:', error);
      setIsStreaming(false);
      setStreamingContent("");
      setProgressMessage(""); // CLEAR PROGRESS on error
      
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
    <div 
      className="flex flex-col h-full max-h-full overflow-hidden bg-slate-900/60 relative"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag-and-drop overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-50 bg-slate-900/95 backdrop-blur-sm flex items-center justify-center border-2 border-dashed border-slate-500 rounded-lg">
          <div className="text-center space-y-3 animate-in fade-in-up duration-300">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center">
              <Paperclip className="h-8 w-8 text-white" />
            </div>
            <div>
              <p className="text-xl font-semibold text-slate-100">Drop files here</p>
              <p className="text-sm text-slate-400 mt-1">Images, code snippets, and log files supported</p>
            </div>
          </div>
        </div>
      )}

      {/* Chat Messages - Enhanced Scrolling */}
      <div 
        ref={scrollRef}
        className="flex-1 min-h-0 overflow-y-auto space-y-4 p-4 sm:p-6 scroll-smooth"
        style={{
          scrollBehavior: 'smooth',
          WebkitOverflowScrolling: 'touch'
        }}
      >
        <div className="space-y-4 max-w-4xl mx-auto">
          {/* Welcome message */}
          {messages.length === 0 && !isStreaming && (
            <div className="text-center py-12 sm:py-16 animate-in fade-in-up duration-700">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center shadow-lg shadow-slate-700/30 animate-in zoom-in duration-500">
                <Wrench className="h-8 w-8 text-white" />
              </div>
              <h3 className="text-xl font-bold text-slate-100 mb-2">Meta-SySop Ready</h3>
              <p className="text-slate-400 max-w-md mx-auto leading-relaxed px-4">
                I'm Meta-SySop, your autonomous platform healing agent. I can diagnose and fix issues 
                with the Archetype platform itself. Tell me what needs to be fixed, and I'll analyze 
                the code, make changes, and optionally commit and deploy them.
              </p>
            </div>
          )}

          {/* Message list */}
          {messages.map((message, index) => (
            <div
              key={message.id}
              className={cn(
                "flex gap-3 animate-in fade-in-up slide-in-from-bottom-4",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
              style={{
                animationDelay: `${index * 50}ms`,
                animationDuration: '400ms',
                animationFillMode: 'both'
              }}
            >
            {message.role === "assistant" && (
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center shadow-lg shadow-slate-700/20">
                <Wrench className="h-5 w-5 text-white" />
              </div>
            )}
            
            <div
              className={cn(
                "rounded-xl px-4 py-3 max-w-[75%] shadow-lg transition-all duration-300 hover:shadow-xl",
                message.role === "user"
                  ? "bg-gradient-to-br from-slate-700 to-slate-600 text-white border border-slate-500/20 shadow-slate-700/30"
                  : "bg-slate-800/90 text-slate-200 border border-slate-700/50 backdrop-blur-sm shadow-slate-900/50"
              )}
            >
              <MessageContent content={message.content} />
              
              {/* Attachments display */}
              {message.attachments && message.attachments.length > 0 && (
                <div className="mt-3 pt-3 border-t border-slate-700/50 space-y-2">
                  <div className="flex items-center gap-2 text-xs font-semibold text-slate-300 mb-2">
                    <Paperclip className="h-3.5 w-3.5" />
                    Attachments ({message.attachments.length})
                  </div>
                  <div className="space-y-1.5">
                    {message.attachments.map((attachment, idx) => (
                      <div key={idx} className="flex items-center gap-2 bg-slate-900/50 rounded-lg px-3 py-2 border border-slate-700/30">
                        {attachment.fileType === 'image' ? (
                          <Image className="h-4 w-4 text-emerald-400" />
                        ) : (
                          <FileText className="h-4 w-4 text-blue-400" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-medium text-slate-300 truncate">{attachment.fileName}</p>
                          <p className="text-[10px] text-slate-500">{(attachment.size / 1024).toFixed(1)}KB</p>
                        </div>
                        <Badge variant="outline" className="text-[10px] h-5 bg-slate-700/10 text-slate-400 border-slate-600/30">
                          {attachment.fileType}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* File changes indicator */}
              {message.platformChanges && message.platformChanges.files && message.platformChanges.files.length > 0 && (
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
            <div className="flex gap-3 justify-start animate-in fade-in-up slide-in-from-bottom-4 duration-400">
              <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center shadow-lg shadow-slate-700/20 animate-pulse">
                <Wrench className="h-5 w-5 text-white" />
              </div>
              <div className="rounded-xl px-4 py-3 max-w-[75%] bg-slate-800/90 text-slate-200 border border-slate-700/50 backdrop-blur-sm shadow-lg shadow-slate-900/50 transition-all">
                {streamingContent ? (
                  <MessageContent content={streamingContent} />
                ) : (
                  <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
                )}
                {/* Show real-time progress messages */}
                {progressMessage && (
                  <div className="flex items-center gap-2 mt-3 pt-3 border-t border-slate-700/50 text-xs text-emerald-400/90">
                    <Loader2 className="h-3 w-3 animate-spin" />
                    <span className="animate-pulse">{progressMessage}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input area - Fixed at bottom with mobile optimization */}
      <div className="border-t border-slate-800/50 p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xl flex-shrink-0">
        <div className="max-w-5xl mx-auto space-y-3">
          {/* Autonomy Level Selector - Prominent placement */}
          {autonomyData && (
            <div className="flex items-center gap-3 bg-slate-800/40 border border-slate-700/50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <Zap className="h-3.5 w-3.5" />
                <span className="font-medium">Autonomy:</span>
              </div>
              <Select
                value={autonomyData.currentLevel}
                onValueChange={(value) => updateAutonomyMutation.mutate(value)}
                disabled={updateAutonomyMutation.isPending}
              >
                <SelectTrigger 
                  className="h-8 w-auto min-w-[140px] bg-slate-900/50 border-slate-600/50 text-xs font-semibold"
                  data-testid="select-autonomy-level"
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {autonomyData.levels && Object.values(autonomyData.levels).map((level: any) => {
                    const Icon = level.icon === 'shield' ? Shield : 
                                 level.icon === 'zap' ? Zap : 
                                 level.icon === 'brain' ? Brain : Infinity;
                    const isDisabled = autonomyData.levels && 
                      Object.keys(autonomyData.levels).indexOf(level.id) > 
                      Object.keys(autonomyData.levels).indexOf(autonomyData.maxAllowedLevel);
                    
                    return (
                      <SelectItem 
                        key={level.id} 
                        value={level.id}
                        disabled={isDisabled}
                        data-testid={`option-autonomy-${level.id}`}
                      >
                        <div className="flex items-center gap-2">
                          <Icon className="h-3.5 w-3.5" />
                          <span className="font-semibold">{level.name}</span>
                          {isDisabled && !autonomyData.isOwner && (
                            <Badge variant="outline" className="text-[10px] ml-2">
                              Upgrade Required
                            </Badge>
                          )}
                        </div>
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
              {autonomyData.isOwner && (
                <Badge variant="outline" className="text-[10px] bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                  Owner - Full Access
                </Badge>
              )}
            </div>
          )}

          {/* Attachment pills */}
          {attachments.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {attachments.map((attachment, idx) => (
                <div 
                  key={idx} 
                  className="flex items-center gap-2 bg-slate-800/80 border border-slate-700/50 rounded-lg px-3 py-1.5 group hover-elevate"
                  data-testid={`attachment-${idx}`}
                >
                  {attachment.fileType === 'image' ? (
                    <Image className="h-3.5 w-3.5 text-emerald-400" />
                  ) : (
                    <FileText className="h-3.5 w-3.5 text-blue-400" />
                  )}
                  <span className="text-xs text-slate-300 font-medium max-w-[120px] truncate">
                    {attachment.fileName}
                  </span>
                  <button
                    onClick={() => removeAttachment(idx)}
                    className="p-0.5 rounded-md hover:bg-slate-700/50 transition-colors"
                    data-testid={`button-remove-attachment-${idx}`}
                  >
                    <X className="h-3 w-3 text-slate-400 hover:text-slate-200" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Input row */}
          <div className="flex gap-2 sm:gap-3 items-end">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,.txt,.log,.js,.ts,.tsx,.jsx,.py,.java,.cpp,.c,.h,.css,.html,.json,.xml,.yaml,.yml,.sql"
              onChange={(e) => handleFileSelect(e.target.files)}
              className="hidden"
              data-testid="input-file-upload"
            />
            
            <Button
              size="icon"
              variant="ghost"
              onClick={() => fileInputRef.current?.click()}
              disabled={isStreaming}
              className="h-[60px] w-[60px] sm:h-[70px] sm:w-[70px] flex-shrink-0 rounded-xl border border-slate-700/50 hover:bg-slate-800/60 hover:border-slate-600/50 transition-all"
              data-testid="button-attach-file"
            >
              <Paperclip className="h-5 w-5 sm:h-6 sm:w-6 text-slate-400" />
            </Button>

            <Textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Describe the platform issue to fix... (paste images or drop files)"
              className="min-h-[60px] sm:min-h-[70px] max-h-[200px] resize-none bg-slate-800/60 border-slate-700/50 text-slate-100 placeholder:text-slate-500 rounded-xl focus:border-slate-500/50 focus:ring-2 focus:ring-slate-500/20 transition-all text-sm sm:text-base"
              rows={3}
              data-testid="input-meta-sysop-message"
              disabled={isStreaming}
            />
            
            <Button
              onClick={handleSend}
              disabled={(!input.trim() && attachments.length === 0) || isStreaming}
              size="icon"
              className="h-[60px] w-[60px] sm:h-[70px] sm:w-[70px] flex-shrink-0 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 hover:from-slate-600 hover:to-slate-500 shadow-lg shadow-slate-700/30 transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
              data-testid="button-send-meta-sysop-message"
            >
              {isStreaming ? (
                <Loader2 className="h-5 w-5 sm:h-6 sm:w-6 animate-spin" />
              ) : (
                <Send className="h-5 w-5 sm:h-6 sm:w-6" />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
