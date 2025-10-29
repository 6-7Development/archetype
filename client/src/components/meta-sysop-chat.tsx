import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Send, Square, ChevronDown, ChevronRight, Shield, Zap, Brain, Infinity, Rocket, Wrench, User, Copy, Check, Loader2, XCircle, FileCode, Terminal, CheckCircle, Clock } from "lucide-react";
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

interface Section {
  id: string;
  type: 'thinking' | 'tool' | 'text';
  title: string;
  content: string;
  status: 'active' | 'finished';
  startTime: number;
  endTime?: number;
  metadata?: {
    toolName?: string;
    args?: any;
    result?: any;
  };
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
  sections?: Section[]; // Structured sections for agent responses
  isStreaming?: boolean; // Flag to indicate if this message is currently streaming
}

interface MetaSySopChatProps {
  autoCommit?: boolean;
  autoPush?: boolean;
}

// Helper to format duration
function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms}ms`;
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
}

// Icon mapping for section types
function getSectionIcon(type: Section['type'], toolName?: string) {
  if (type === 'thinking') return Brain;
  if (type === 'text') return FileCode;
  if (type === 'tool') {
    // Map tool names to specific icons
    if (toolName?.includes('read')) return FileCode;
    if (toolName?.includes('write')) return FileCode;
    if (toolName?.includes('diagnosis')) return Terminal;
    if (toolName?.includes('sql')) return Terminal;
    return Wrench;
  }
  return FileCode;
}

// CollapsibleExcerpt: Shows preview with "Show N more" for long content
function CollapsibleExcerpt({ content, maxLines = 4 }: { content: string; maxLines?: number }) {
  const [isExpanded, setIsExpanded] = useState(false);
  const lines = content.split('\n');
  const hasMore = lines.length > maxLines;

  if (!hasMore) {
    return <MarkdownRenderer content={content} />;
  }

  const previewContent = lines.slice(0, maxLines).join('\n');
  const hiddenCount = lines.length - maxLines;

  return (
    <div>
      {!isExpanded ? (
        <>
          <MarkdownRenderer content={previewContent} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(true)}
            className="mt-2 h-7 text-xs text-primary hover:text-primary/80"
            data-testid="button-show-more"
          >
            Show {hiddenCount} more line{hiddenCount !== 1 ? 's' : ''}
          </Button>
        </>
      ) : (
        <>
          <MarkdownRenderer content={content} />
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setIsExpanded(false)}
            className="mt-2 h-7 text-xs text-muted-foreground"
            data-testid="button-show-less"
          >
            Show less
          </Button>
        </>
      )}
    </div>
  );
}

// CollapsibleSection: Renders a single section with collapse/expand
function CollapsibleSection({ section }: { section: Section }) {
  const [isOpen, setIsOpen] = useState(section.status === 'active');
  const Icon = getSectionIcon(section.type, section.metadata?.toolName);
  
  // Auto-expand when section finishes
  useEffect(() => {
    if (section.status === 'finished') {
      setIsOpen(false); // Collapse when finished to save space
    }
  }, [section.status]);

  const duration = section.endTime && section.startTime 
    ? formatDuration(section.endTime - section.startTime)
    : null;

  const getStatusIcon = () => {
    if (section.status === 'active') {
      return <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />;
    }
    return <CheckCircle className="w-3.5 h-3.5 text-emerald-500" />;
  };

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <div className="border border-border rounded-lg overflow-hidden bg-muted/30">
        <CollapsibleTrigger className="w-full px-4 py-2.5 flex items-center gap-3 hover:bg-muted/50 transition-colors group" data-testid="section-trigger">
          <div className="flex items-center gap-2 flex-1 min-w-0">
            {isOpen ? (
              <ChevronDown className="w-4 h-4 text-muted-foreground shrink-0" />
            ) : (
              <ChevronRight className="w-4 h-4 text-muted-foreground shrink-0" />
            )}
            <Icon className="w-4 h-4 text-muted-foreground shrink-0" />
            <span className="text-sm font-medium truncate">{section.title}</span>
            {duration && (
              <span className="text-xs text-muted-foreground ml-auto shrink-0 flex items-center gap-1">
                <Clock className="w-3 h-3" />
                {duration}
              </span>
            )}
            {getStatusIcon()}
          </div>
        </CollapsibleTrigger>
        <CollapsibleContent>
          <div className="px-4 py-3 border-t border-border bg-background/50">
            {section.content ? (
              <CollapsibleExcerpt content={section.content} maxLines={6} />
            ) : (
              <div className="text-sm text-muted-foreground italic">No output</div>
            )}
          </div>
        </CollapsibleContent>
      </div>
    </Collapsible>
  );
}

// Helper function to retry fetch with exponential backoff
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

export function MetaSySopChat({ autoCommit = true, autoPush = true }: MetaSySopChatProps) {
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
  const [showTaskList, setShowTaskList] = useState(true);
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastEventTimeRef = useRef<number>(Date.now());

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

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
      };
      setMessages(prev => [...prev, userMsg]);
      setInput("");
      
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
        sections: [],
        isStreaming: true,
      };
      setMessages(prev => [...prev, assistantMsg]);

      console.log('[META-SYSOP] ============ SSE STREAM STARTING ============');
      console.log('[META-SYSOP] Message:', message);
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

                  case 'section_start': {
                    // Start a new section
                    const newSection: Section = {
                      id: data.sectionId,
                      type: data.sectionType || 'text',
                      title: data.title || 'Working...',
                      content: '',
                      status: 'active',
                      startTime: data.timestamp || Date.now(),
                      metadata: data.metadata,
                    };
                    
                    // Update the streaming message with new section
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMsgId
                        ? { ...msg, sections: [...(msg.sections || []), newSection] }
                        : msg
                    ));
                    setProgressStatus('working');
                    console.log('[META-SYSOP] Section started:', data.sectionType, data.title);
                    break;
                  }

                  case 'section_update': {
                    // Update existing section content
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMsgId
                        ? {
                            ...msg,
                            sections: msg.sections?.map(s => 
                              s.id === data.sectionId 
                                ? { ...s, content: s.content + (data.content || '') }
                                : s
                            )
                          }
                        : msg
                    ));
                    break;
                  }

                  case 'section_finish': {
                    // Finish section and mark as complete
                    setMessages(prev => prev.map(msg => 
                      msg.id === assistantMsgId
                        ? {
                            ...msg,
                            sections: msg.sections?.map(s => 
                              s.id === data.sectionId 
                                ? { 
                                    ...s, 
                                    status: 'finished' as const,
                                    endTime: data.timestamp || Date.now(),
                                    content: data.content || s.content
                                  }
                                : s
                            )
                          }
                        : msg
                    ));
                    console.log('[META-SYSOP] Section finished:', data.sectionId);
                    break;
                  }

                  case 'content':
                    // Update the streaming message content
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
                          setShowTaskList(true);
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
    <div className="flex h-full overflow-hidden bg-background">
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
                    <div className="px-4 py-3 bg-primary text-primary-foreground border border-primary rounded-lg">
                      <div className="text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {/* CRITICAL FIX: Always show content if it exists, regardless of sections */}
                      {message.content && (
                        <div className="px-4 py-3 bg-muted text-foreground border border-border rounded-lg">
                          <MarkdownRenderer content={message.content} />
                          {message.isStreaming && (
                            <span className="inline-block w-1 h-4 bg-primary animate-pulse ml-0.5" />
                          )}
                        </div>
                      )}
                      
                      {/* Render sections separately (after content) */}
                      {message.sections && message.sections.length > 0 && (
                        message.sections.map((section) => (
                          <CollapsibleSection key={section.id} section={section} />
                        ))
                      )}
                      
                      {/* Show streaming indicator if no content yet */}
                      {!message.content && message.isStreaming && (
                        <div className="px-4 py-3 bg-muted text-foreground border border-border rounded-lg">
                          <div className="flex items-center gap-2 text-sm text-muted-foreground">
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                            <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                          </div>
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

            {/* Inline Task Progress Card */}
            {showTaskList && tasks.length > 0 && (
              <div className="animate-in fade-in-up">
                <div className="bg-muted border border-border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-primary animate-spin" />
                      <h3 className="text-sm font-semibold">
                        Task Progress
                      </h3>
                      <span className="text-xs text-muted-foreground">
                        {tasks.filter(t => t.status === 'completed').length}/{tasks.length}
                      </span>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => setShowTaskList(false)}
                      data-testid="button-hide-tasks"
                    >
                      <ChevronDown className="h-4 w-4" />
                    </Button>
                  </div>
                  <AgentTaskList tasks={tasks} activeTaskId={activeTaskId} onTaskClick={setActiveTaskId} />
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-border p-4 bg-background flex-shrink-0">
          <div className="max-w-3xl mx-auto space-y-3">
            {/* Project Selector & Autonomy Selector */}
            <div className="flex items-center gap-6 flex-wrap">
              {/* Project Selector */}
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

              {/* Autonomy Level Selector */}
              {autonomyData && (
                <div className="flex items-center gap-3">
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
                </div>
              )}
            </div>

            {/* Input field */}
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tell me what needs to be fixed..."
                className="min-h-[60px] max-h-[200px] resize-none"
                disabled={isStreaming}
                data-testid="input-message"
              />
              <div className="flex flex-col gap-2">
                <Button
                  onClick={handleSend}
                  disabled={!input.trim() || isStreaming}
                  size="icon"
                  data-testid="button-send"
                >
                  <Send className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}