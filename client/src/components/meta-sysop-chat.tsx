import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Send, Square, ChevronDown, ChevronRight, Shield, Zap, Brain, Infinity, Rocket, Wrench, User, Copy, Check, Loader2, XCircle, FileCode, Terminal, CheckCircle, Clock, Upload, X, File, Image } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { AgentTaskList, type AgentTask } from "./agent-task-list";
import { AgentProgressDisplay } from "./agent-progress-display";
import { MarkdownRenderer } from "./markdown-renderer";

interface Attachment {
  fileName: string;
  fileType: 'image' | 'code' | 'log' | 'text';
  content: string; // base64 for images, text for others
  mimeType?: string;
  size: number;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  isStreaming?: boolean; // Flag to indicate if this message is currently streaming
  attachments?: Attachment[]; // File attachments
}

interface MetaSySopChatProps {
  autoCommit?: boolean;
  autoPush?: boolean;
  onTasksChange?: (tasks: AgentTask[], activeTaskId: string | null) => void;
}

// Helper to retry fetch with exponential backoff
async function retryFetch(url: string, options: RequestInit, maxRetries = 3): Promise<Response> {
  let lastError: Error | null = null;
  
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) {
        return response;
      }
      lastError = new Error(`HTTP ${response.status}: ${response.statusText}`);
    } catch (error) {
      lastError = error as Error;
    }
    
    // If not the last attempt, wait with exponential backoff
    if (attempt < maxRetries - 1) {
      const delay = Math.pow(2, attempt) * 1000; // 1s, 2s, 4s
      console.log(`[META-SYSOP] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
  
  throw lastError || new Error('Fetch failed after retries');
}

// File type detection
function detectFileType(fileName: string, mimeType?: string): Attachment['fileType'] {
  const ext = fileName.split('.').pop()?.toLowerCase() || '';
  
  // Check mime type first
  if (mimeType?.startsWith('image/')) return 'image';
  
  // Check by extension
  if (['jpg', 'jpeg', 'png', 'gif', 'bmp', 'webp', 'svg'].includes(ext)) return 'image';
  if (['js', 'ts', 'tsx', 'jsx', 'py', 'java', 'cpp', 'c', 'cs', 'go', 'rs', 'php', 'rb', 'swift', 'kt', 'dart', 'vue', 'css', 'html', 'xml', 'json', 'yaml', 'yml', 'toml', 'ini', 'sh', 'bash', 'ps1', 'sql'].includes(ext)) return 'code';
  if (['log', 'txt'].includes(ext)) return 'log';
  
  // Default to text
  return 'text';
}

// Convert file to base64 or text
async function fileToContent(file: File): Promise<{ content: string; isBase64: boolean }> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    
    reader.onload = (e) => {
      const result = e.target?.result;
      if (typeof result === 'string') {
        // For images, keep as data URL (includes base64)
        if (file.type.startsWith('image/')) {
          resolve({ content: result, isBase64: true });
        } else {
          // For text files, extract text content
          resolve({ content: result, isBase64: false });
        }
      } else {
        reject(new Error('Failed to read file'));
      }
    };
    
    reader.onerror = () => reject(reader.error);
    
    // Read images as data URL, text files as text
    if (file.type.startsWith('image/')) {
      reader.readAsDataURL(file);
    } else {
      reader.readAsText(file);
    }
  });
}

// Format file size
function formatFileSize(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

// AttachmentPreview component
function AttachmentPreview({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }) {
  const [showPreview, setShowPreview] = useState(false);
  
  return (
    <div className="relative group">
      <div className="flex items-center gap-2 p-2 bg-muted rounded-lg border border-border">
        {attachment.fileType === 'image' ? (
          <Image className="w-4 h-4 text-muted-foreground shrink-0" />
        ) : (
          <File className="w-4 h-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{attachment.fileName}</div>
          <div className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          onClick={onRemove}
        >
          <X className="h-3 w-3" />
        </Button>
      </div>
      
      {/* Image preview on hover */}
      {attachment.fileType === 'image' && attachment.content && (
        <div className="absolute bottom-full mb-2 left-0 z-10 hidden group-hover:block">
          <div className="p-2 bg-popover border border-border rounded-lg shadow-lg">
            <img 
              src={attachment.content} 
              alt={attachment.fileName}
              className="max-w-[200px] max-h-[200px] rounded"
            />
          </div>
        </div>
      )}
    </div>
  );
}

export function MetaSySopChat({ autoCommit = true, autoPush = true, onTasksChange }: MetaSySopChatProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<'thinking' | 'working' | 'vibing' | 'idle'>('idle');
  const [progressMessage, setProgressMessage] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastEventTimeRef = useRef<number>(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Notify parent of task changes
  useEffect(() => {
    if (onTasksChange) {
      onTasksChange(tasks, activeTaskId);
    }
  }, [tasks, activeTaskId, onTasksChange]);

  // Auto-scroll to bottom when new content arrives
  useEffect(() => {
    if (scrollRef.current) {
      const scrollEl = scrollRef.current;
      const isNearBottom = scrollEl.scrollTop + scrollEl.clientHeight > scrollEl.scrollHeight - 100;
      
      // Only auto-scroll if user is near the bottom (avoid interrupting reading)
      if (isNearBottom || isStreaming) {
        scrollEl.scrollTop = scrollEl.scrollHeight;
      }
    }
  }, [messages, isStreaming]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        console.log('[META-SYSOP] Aborting stream on unmount');
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    };
  }, []);

  // Paste handler for images and text
  useEffect(() => {
    const handlePaste = async (e: ClipboardEvent) => {
      // Only handle paste in our textarea
      if (document.activeElement !== textareaRef.current) return;
      
      const items = Array.from(e.clipboardData?.items || []);
      
      for (const item of items) {
        // Handle images
        if (item.type.startsWith('image/')) {
          e.preventDefault();
          const file = item.getAsFile();
          if (file) {
            try {
              const { content } = await fileToContent(file);
              const attachment: Attachment = {
                fileName: `paste-${Date.now()}.${file.type.split('/')[1]}`,
                fileType: 'image',
                content,
                mimeType: file.type,
                size: file.size,
              };
              setAttachments(prev => [...prev, attachment]);
              toast({
                title: "Image pasted",
                description: "Image added to attachments",
              });
            } catch (error) {
              console.error('Failed to process pasted image:', error);
              toast({
                title: "Failed to paste image",
                variant: "destructive",
              });
            }
          }
        }
        // Handle text/code (let default behavior handle regular text paste)
        else if (item.type === 'text/plain') {
          // Check if it looks like code (has multiple lines, indentation, or code patterns)
          const text = await new Promise<string>((resolve) => {
            item.getAsString(resolve);
          });
          
          const looksLikeCode = text.includes('\n') && (
            text.includes('  ') || // indentation
            text.includes('\t') || // tabs
            /^(import|export|const|let|var|function|class|if|for|while)/m.test(text) || // code keywords
            /[{}\[\]();]/.test(text) // code syntax
          );
          
          if (looksLikeCode && text.length > 100) {
            e.preventDefault();
            // Offer to add as code attachment
            const attachment: Attachment = {
              fileName: `code-snippet-${Date.now()}.txt`,
              fileType: 'code',
              content: text,
              mimeType: 'text/plain',
              size: new Blob([text]).size,
            };
            setAttachments(prev => [...prev, attachment]);
            toast({
              title: "Code snippet added",
              description: "Code added as attachment",
            });
          }
          // Otherwise let default paste behavior handle it
        }
      }
    };
    
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [toast]);

  // ESC key handler to dismiss drag overlay
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isDragging) {
        setIsDragging(false);
      }
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isDragging]);

  // Drag and drop handlers
  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    // Check if we're actually leaving the container (not just entering a child)
    const rect = e.currentTarget.getBoundingClientRect();
    const x = e.clientX;
    const y = e.clientY;
    
    // If the mouse is outside the container bounds, hide the overlay
    if (x < rect.left || x >= rect.right || y < rect.top || y >= rect.bottom) {
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
    
    const files = Array.from(e.dataTransfer.files);
    await processFiles(files);
  };

  // File processing
  const processFiles = async (files: File[]) => {
    const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB limit
    const newAttachments: Attachment[] = [];
    
    for (const file of files) {
      if (file.size > MAX_FILE_SIZE) {
        toast({
          title: "File too large",
          description: `${file.name} exceeds 10MB limit`,
          variant: "destructive",
        });
        continue;
      }
      
      try {
        const { content } = await fileToContent(file);
        const attachment: Attachment = {
          fileName: file.name,
          fileType: detectFileType(file.name, file.type),
          content,
          mimeType: file.type || undefined,
          size: file.size,
        };
        newAttachments.push(attachment);
      } catch (error) {
        console.error('Failed to process file:', error);
        toast({
          title: "Failed to process file",
          description: file.name,
          variant: "destructive",
        });
      }
    }
    
    if (newAttachments.length > 0) {
      setAttachments(prev => [...prev, ...newAttachments]);
      toast({
        title: "Files added",
        description: `${newAttachments.length} file(s) attached`,
      });
    }
  };

  // File input handler
  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    await processFiles(files);
    // Reset input to allow selecting the same file again
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Remove attachment
  const removeAttachment = (index: number) => {
    setAttachments(prev => prev.filter((_, i) => i !== index));
  };

  // Timeout detection: Check for stalled SSE connections
  useEffect(() => {
    if (!isStreaming) return;

    const timeoutCheckInterval = setInterval(() => {
      const timeSinceLastEvent = Date.now() - lastEventTimeRef.current;
      const TIMEOUT_THRESHOLD = 30000; // 30 seconds

      if (timeSinceLastEvent > TIMEOUT_THRESHOLD) {
        console.warn('[META-SYSOP] ⚠️ No events received for 30+ seconds - connection may be stalled');
        toast({
          title: '⚠️ Connection Warning',
          description: 'No updates received for 30 seconds. The connection may have stalled.',
          variant: 'destructive',
        });
        
        // Clear the interval to avoid repeated warnings
        clearInterval(timeoutCheckInterval);
      }
    }, 5000); // Check every 5 seconds

    return () => clearInterval(timeoutCheckInterval);
  }, [isStreaming, toast]);

  // Fetch autonomy level
  const { data: autonomyData } = useQuery<any>({
    queryKey: ['/api/meta-sysop/autonomy-level'],
  });

  // Fetch all projects (admin only)
  const { data: projects } = useQuery<any[]>({
    queryKey: ['/api/meta-sysop/projects'],
    enabled: isAdmin,
  });

  // Update autonomy level
  const updateAutonomyMutation = useMutation({
    mutationFn: async (level: string) => {
      const response = await fetch('/api/meta-sysop/autonomy-level', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ level }),
      });
      if (!response.ok) throw new Error('Failed to update autonomy level');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "Autonomy level updated" });
    },
  });

  // Send message mutation - uses SSE streaming for real-time responses
  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      // Add user message to session
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: message,
        attachments: attachments.length > 0 ? [...attachments] : undefined,
      };
      setMessages(prev => [...prev, userMsg]);
      setInput("");
      setAttachments([]); // Clear attachments after sending
      
      setIsStreaming(true);
      setTasks([]);
      setActiveTaskId(null);
      setProgressStatus('thinking');
      setProgressMessage("Starting Meta-SySop...");
      
      // Reset timeout detection timestamp
      lastEventTimeRef.current = Date.now();

      // Add initial assistant message that will be updated via streaming
      const assistantMsgId = `assistant-${Date.now()}`;
      setStreamingMessageId(assistantMsgId);
      
      const assistantMsg: Message = {
        id: assistantMsgId,
        role: "assistant",
        content: "",
        isStreaming: true,
      };
      setMessages(prev => [...prev, assistantMsg]);

      console.log('[META-SYSOP] ============ SSE STREAM STARTING ============');
      console.log('[META-SYSOP] Message:', message);
      console.log('[META-SYSOP] Attachments:', attachments.length);
      console.log('[META-SYSOP] Project:', selectedProjectId || 'platform code');
      console.log('[META-SYSOP] =========================================');

      // Create abort controller for stopping stream
      const abortController = new AbortController();
      
      // Start SSE stream using fetch
      const response = await fetch('/api/meta-sysop/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: abortController.signal,
        body: JSON.stringify({
          message,
          attachments: attachments.length > 0 ? attachments : undefined,
          projectId: selectedProjectId,
          autoCommit: true,
          autoPush: true, // ✅ Push to GitHub after committing (triggers Railway deployment)
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Failed to start stream: ${response.statusText}`);
      }

      // Store abort controller for stopping
      abortControllerRef.current = abortController;

      // Parse SSE stream manually
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const data = JSON.parse(line.slice(6));
                console.log('[META-SYSOP] SSE event:', data.type);
                
                // Update last event timestamp for timeout detection
                lastEventTimeRef.current = Date.now();

                switch (data.type) {
                  case 'user_message':
                    console.log('[META-SYSOP] User message saved:', data.messageId);
                    break;

                  case 'content':
                    // 🔥 REPLIT AGENT STYLE: Stream content character-by-character
                    // Update the streaming message content IMMEDIATELY (no buffering)
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMsgId
                        ? { ...msg, content: msg.content + (data.content || '') }
                        : msg
                    ));
                    setProgressStatus('working');
                    break;

                  case 'progress':
                    setProgressMessage(data.message || '');
                    setProgressStatus('working');
                    break;

                  case 'task_list_created':
                    // Use retry logic for fetching task list
                    retryFetch(`/api/meta-sysop/task-list/${data.taskListId}`, {
                      credentials: 'include'
                    })
                      .then(res => res.json())
                      .then(taskListData => {
                        if (taskListData.success && taskListData.tasks) {
                          const formattedTasks: AgentTask[] = taskListData.tasks.map((t: any) => ({
                            id: t.id,
                            title: t.title,
                            description: t.description,
                            status: t.status as AgentTask['status'],
                          }));
                          setTasks(formattedTasks);
                          console.log('[META-SYSOP] ✅ Task list loaded with', formattedTasks.length, 'tasks');
                        }
                      })
                      .catch(err => {
                        console.error('[META-SYSOP] ❌ Failed to fetch task list after retries:', err);
                        toast({
                          title: '❌ Failed to Load Tasks',
                          description: 'Could not load task list after multiple attempts. The agent is still working.',
                          variant: 'destructive',
                        });
                      });
                    break;

                  case 'task_updated':
                    // Check if task exists before updating
                    setTasks(prev => {
                      const taskExists = prev.some(t => t.id === data.taskId);
                      if (!taskExists) {
                        console.warn('[META-SYSOP] ⚠️ Task update received for unknown taskId:', data.taskId);
                      }
                      
                      return prev.map(t => 
                        t.id === data.taskId 
                          ? { ...t, status: data.status as AgentTask['status'] }
                          : t
                      );
                    });
                    
                    if (data.status === 'in_progress') {
                      setActiveTaskId(data.taskId);
                    }
                    console.log('[META-SYSOP] Task updated:', data.taskId, '→', data.status);
                    break;

                  // Remove all section-based events - we're using direct content streaming now
                  case 'section_start':
                  case 'section_update': 
                  case 'section_finish':
                    // Ignore - using simple content streaming instead
                    break;

                  case 'done': {
                    console.log('[META-SYSOP] ✅ Stream complete, messageId:', data.messageId);
                    
                    // Mark the message as no longer streaming
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMsgId
                        ? { ...msg, isStreaming: false }
                        : msg
                    ));
                    
                    setStreamingMessageId(null);
                    setIsStreaming(false);
                    setProgressStatus('idle');
                    setProgressMessage('');
                    setTasks(prev => prev.map(t => ({ ...t, status: 'completed' as const })));
                    
                    abortControllerRef.current = null;
                    toast({ title: "✅ Done" });
                    return;
                  }

                  case 'error':
                    console.error('[META-SYSOP] ❌ Stream error:', data.message);
                    
                    setIsStreaming(false);
                    setStreamingMessageId(null);
                    setProgressStatus('idle');
                    setProgressMessage('');
                    
                    // Add error to the message
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMsgId
                        ? { ...msg, content: msg.content + `\n\n❌ Error: ${data.message}`, isStreaming: false }
                        : msg
                    ));
                    
                    toast({
                      title: '❌ Error',
                      description: data.message || 'Unknown error',
                      variant: 'destructive'
                    });
                    
                    abortControllerRef.current = null;
                    return;
                }
              } catch (error) {
                console.error('[META-SYSOP] Failed to parse SSE data:', error);
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('[META-SYSOP] Stream aborted by user');
        } else {
          console.error('[META-SYSOP] Stream error:', error);
          throw error;
        }
      }
    },
    onError: (error: any) => {
      console.error('Meta-SySop error:', error);
      setIsStreaming(false);
      setStreamingMessageId(null);
      setProgressStatus('idle');
      setProgressMessage("");
      setAttachments([]); // Clear attachments on error
      
      if (activeTaskId) {
        setTasks(prev => prev.map(t => 
          t.id === activeTaskId ? { ...t, status: 'failed' as const } : t
        ));
      }

      toast({
        title: "❌ Error",
        description: error.message || 'Failed to process request',
        variant: "destructive",
      });
      
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
    },
  });

  const handleSend = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || sendMutation.isPending) return;
    sendMutation.mutate(trimmedInput);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      console.log('[META-SYSOP] Stopping stream...');
      (abortControllerRef.current as AbortController).abort();
      abortControllerRef.current = null;
      
      setTasks(prev => prev.map(t => 
        t.status === 'in_progress' ? { ...t, status: 'failed' as const } : t
      ));
      
      setIsStreaming(false);
      setStreamingMessageId(null);
      setProgressStatus('idle');
      setProgressMessage("");
      setAttachments([]); // Clear attachments when stopping
      
      toast({ title: "🛑 Stopped" });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <div 
      className="flex h-full overflow-hidden bg-background"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {/* Drag overlay */}
      {isDragging && (
        <div className="absolute inset-0 z-40 flex items-center justify-center bg-background/80 backdrop-blur-sm border-2 border-dashed border-primary rounded-lg">
          <div className="text-center">
            <Upload className="w-12 h-12 mx-auto mb-2 text-primary" />
            <p className="text-lg font-medium">Drop files here</p>
            <p className="text-sm text-muted-foreground">Images, code files, logs, or text files</p>
          </div>
        </div>
      )}

      {/* Hidden file input */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        className="hidden"
        onChange={handleFileSelect}
        accept="image/*,text/*,.js,.ts,.tsx,.jsx,.py,.java,.cpp,.c,.cs,.go,.rs,.php,.rb,.swift,.kt,.dart,.vue,.css,.html,.xml,.json,.yaml,.yml,.toml,.ini,.sh,.bash,.ps1,.sql,.log,.txt"
      />

      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Active Task Header */}
        {isStreaming && activeTaskId && (
          <div className="px-4 py-3 border-b border-border bg-muted/30">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-sm font-semibold truncate">
                    {tasks.find(t => t.id === activeTaskId)?.title || 'Working...'}
                  </h2>
                  {tasks.length > 0 && (
                    <span className="text-xs text-muted-foreground shrink-0">
                      {tasks.filter(t => t.status === 'completed').length}/{tasks.length}
                    </span>
                  )}
                </div>
                <AgentProgressDisplay status={progressStatus} message={progressMessage} />
              </div>
              <Button
                variant="destructive"
                size="sm"
                onClick={handleStop}
                className="shrink-0"
                data-testid="button-stop"
              >
                <Square className="h-3.5 w-3.5 mr-1.5 fill-current" />
                Stop
              </Button>
            </div>
          </div>
        )}

        {/* Messages Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
        >
          <div className="max-w-4xl mx-auto space-y-4">
            {/* Welcome screen */}
            {messages.length === 0 && !isStreaming && (
              <div className="text-center py-12 animate-in fade-in-up duration-700">
                <div className="w-16 h-16 mx-auto mb-4 rounded-xl bg-muted flex items-center justify-center">
                  <Wrench className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="text-xl font-bold mb-2">Meta-SySop Ready</h3>
                <p className="text-muted-foreground max-w-md mx-auto leading-relaxed">
                  I'm Meta-SySop, your autonomous platform healing agent. I can diagnose and fix issues 
                  with the Archetype platform itself. Tell me what needs to be fixed.
                </p>
                <div className="mt-4 text-sm text-muted-foreground">
                  💡 Tip: You can upload images, paste screenshots, or attach code/logs
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  "flex gap-3 animate-in fade-in-up",
                  message.role === "user" ? "justify-end" : "justify-start"
                )}
              >
                {message.role === "assistant" && (
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center">
                    <Wrench className="h-5 w-5 text-muted-foreground" />
                  </div>
                )}
                
                <div className={cn("rounded-lg max-w-[85%]", message.role === "user" ? "w-auto" : "w-full")}>
                  {message.role === "user" ? (
                    <div className="space-y-2">
                      <div className="px-4 py-3 bg-primary text-primary-foreground border border-primary rounded-lg">
                        <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
                      </div>
                      {/* User attachments */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-2">
                          {message.attachments.map((attachment, idx) => (
                            <div key={idx} className="flex items-center gap-2 p-2 bg-muted rounded-lg border border-border">
                              {attachment.fileType === 'image' ? (
                                <Image className="w-4 h-4 text-muted-foreground shrink-0" />
                              ) : (
                                <File className="w-4 h-4 text-muted-foreground shrink-0" />
                              )}
                              <div className="text-xs">
                                <div className="font-medium">{attachment.fileName}</div>
                                <div className="text-muted-foreground">{formatFileSize(attachment.size)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    // 🔥 SIMPLIFIED ASSISTANT MESSAGE: Just content + streaming indicator
                    <div className="px-4 py-3 bg-muted text-foreground border border-border rounded-lg">
                      {message.content ? (
                        <div className="prose prose-sm max-w-none dark:prose-invert">
                          <MarkdownRenderer content={message.content} />
                        </div>
                      ) : null}
                      {message.isStreaming && (
                        <div className="flex items-center gap-2 mt-2 text-sm text-muted-foreground">
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                          <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                          <span className="text-xs ml-2">Meta-SySop is typing...</span>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {message.role === "user" && (
                  <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
                    <User className="h-5 w-5 text-primary-foreground" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4 bg-background flex-shrink-0">
          <div className="max-w-3xl mx-auto space-y-3">
            {/* 🎯 REDESIGNED CONTROLS: Project, Autonomy & Upload Button together */}
            <div className="flex items-center justify-between gap-4 flex-wrap">
              {/* Left side: Project Selector */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-medium">Target:</span>
                <Select
                  value={selectedProjectId || "platform"}
                  onValueChange={(value) => setSelectedProjectId(value === "platform" ? null : value)}
                  disabled={isStreaming}
                >
                  <SelectTrigger className="h-8 w-auto min-w-[180px] text-xs" data-testid="select-project">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform" data-testid="project-option-platform">
                      <div className="flex items-center gap-2">
                        <Rocket className="h-3.5 w-3.5" />
                        <span>Platform Code</span>
                      </div>
                    </SelectItem>
                    {projects?.map((project) => (
                      <SelectItem key={project.id} value={project.id} data-testid={`project-option-${project.id}`}>
                        <div className="flex items-center gap-2">
                          <FileCode className="h-3.5 w-3.5" />
                          <span className="truncate max-w-[160px]">{project.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Right side: Autonomy Selector + Upload Button */}
              <div className="flex items-center gap-3">
                {/* Autonomy Level Selector */}
                {autonomyData && (
                  <>
                    <span className="text-xs text-muted-foreground font-medium">Autonomy:</span>
                    <Select
                      value={autonomyData.currentLevel}
                      onValueChange={(level) => updateAutonomyMutation.mutate(level)}
                      disabled={isStreaming}
                    >
                      <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs" data-testid="select-autonomy">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {Object.values(autonomyData.levels).map((level: any) => {
                          const Icon = level.icon === 'shield' ? Shield : level.icon === 'zap' ? Zap : level.icon === 'brain' ? Brain : Infinity;
                          const isAvailable = autonomyData.levels[autonomyData.maxAllowedLevel] >= autonomyData.levels[level.id];
                          return (
                            <SelectItem
                              key={level.id}
                              value={level.id}
                              disabled={!isAvailable}
                              data-testid={`autonomy-option-${level.id}`}
                            >
                              <div className="flex items-center gap-2">
                                <Icon className="h-3.5 w-3.5" />
                                <span>{level.name}</span>
                                {!isAvailable && <span className="text-xs text-muted-foreground">(Upgrade)</span>}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </>
                )}

                {/* ✨ UPLOAD BUTTON - Now positioned next to autonomy selector */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-8 px-3 gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming}
                  title="Upload files (images, code, logs)"
                >
                  <Upload className="h-3.5 w-3.5" />
                  <span className="hidden sm:inline text-xs">Upload</span>
                </Button>
              </div>
            </div>

            {/* Attachments preview */}
            {attachments.length > 0 && (
              <div className="flex flex-wrap gap-2 p-2 bg-muted/50 rounded-lg border border-border">
                {attachments.map((attachment, idx) => (
                  <AttachmentPreview
                    key={idx}
                    attachment={attachment}
                    onRemove={() => removeAttachment(idx)}
                  />
                ))}
              </div>
            )}

            {/* 🎯 REDESIGNED INPUT AREA: Clean textarea without embedded button */}
            <div className="flex gap-2">
              <div className="flex-1">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tell me what needs to be fixed... (paste images, drag files, or use upload button)"
                  className="min-h-[60px] max-h-[200px] resize-none"
                  disabled={isStreaming}
                  data-testid="input-message"
                />
              </div>
              <div className="flex flex-col gap-2">
                {isStreaming ? (
                  <Button
                    onClick={handleStop}
                    variant="destructive"
                    size="icon"
                    data-testid="button-stop"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    size="icon"
                    data-testid="button-send"
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}