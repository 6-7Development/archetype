import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Send, Square, ChevronDown, ChevronRight, Shield, Zap, Brain, Infinity, Rocket, Wrench, User, Copy, Check, Loader2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { AgentTaskList, type AgentTask } from "./agent-task-list";
import { AgentProgressDisplay } from "./agent-progress-display";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface MetaSySopChatProps {
  autoCommit?: boolean;
  autoPush?: boolean;
}

// Copy button for code blocks
function CodeCopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const { toast } = useToast();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast({ title: "Copied to clipboard" });
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      toast({ title: "Failed to copy", variant: "destructive" });
    }
  };

  return (
    <button
      onClick={handleCopy}
      className="absolute top-2 right-2 p-1.5 rounded-md bg-muted hover:bg-muted/80 border border-border transition-colors text-muted-foreground hover:text-foreground"
      data-testid="button-copy-code"
    >
      {copied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

// Message content renderer with code blocks
function MessageContent({ content }: { content: string }) {
  const parts: Array<{ type: 'text' | 'code'; content: string; language?: string }> = [];
  const codeBlockRegex = /```(\w+)?\n([\s\S]*?)```/g;
  let lastIndex = 0;
  let match;

  while ((match = codeBlockRegex.exec(content)) !== null) {
    if (match.index > lastIndex) {
      parts.push({ type: 'text', content: content.slice(lastIndex, match.index) });
    }
    parts.push({ type: 'code', content: match[2].trim(), language: match[1] || 'text' });
    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < content.length) {
    parts.push({ type: 'text', content: content.slice(lastIndex) });
  }

  if (parts.length === 0) {
    parts.push({ type: 'text', content });
  }

  return (
    <div className="space-y-2">
      {parts.map((part, index) => (
        part.type === 'code' ? (
          <div key={index} className="relative group">
            <div className="bg-muted border border-border rounded-md p-3 overflow-x-auto">
              <div className="text-[10px] text-muted-foreground uppercase mb-2 font-semibold">{part.language}</div>
              <pre className="text-xs text-foreground font-mono leading-relaxed">{part.content}</pre>
            </div>
            <CodeCopyButton code={part.content} />
          </div>
        ) : (
          <div key={index} className="text-sm leading-relaxed whitespace-pre-wrap">
            {part.content.split('\n').map((line, i) => {
              const boldRegex = /\*\*(.*?)\*\*/g;
              if (boldRegex.test(line)) {
                const segments = [];
                let lastIdx = 0;
                let boldMatch;
                boldRegex.lastIndex = 0;
                
                while ((boldMatch = boldRegex.exec(line)) !== null) {
                  if (boldMatch.index > lastIdx) {
                    segments.push(<span key={`text-${i}-${lastIdx}`}>{line.slice(lastIdx, boldMatch.index)}</span>);
                  }
                  segments.push(<strong key={`bold-${i}-${boldMatch.index}`} className="font-semibold">{boldMatch[1]}</strong>);
                  lastIdx = boldMatch.index + boldMatch[0].length;
                }
                if (lastIdx < line.length) {
                  segments.push(<span key={`text-${i}-${lastIdx}`}>{line.slice(lastIdx)}</span>);
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

export function MetaSySopChat({ autoCommit = true, autoPush = true }: MetaSySopChatProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]); // Session-based only, no DB
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState("");
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<'thinking' | 'working' | 'vibing' | 'idle'>('idle');
  const [progressMessage, setProgressMessage] = useState("");
  const [showTaskList, setShowTaskList] = useState(true); // Default true to show task UI when tasks arrive (like Replit Agent)
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null); // null = platform code
  const eventSourceRef = useRef<EventSource | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (eventSourceRef.current) {
        console.log('[META-SYSOP] Aborting stream on unmount');
        (eventSourceRef.current as AbortController).abort();
        eventSourceRef.current = null;
      }
    };
  }, []);

  // Fetch autonomy level
  const { data: autonomyData } = useQuery<any>({
    queryKey: ['/api/meta-sysop/autonomy-level'],
  });

  // Fetch all projects (admin only) - only run query if user is admin
  const { data: projects } = useQuery<any[]>({
    queryKey: ['/api/meta-sysop/projects'],
    enabled: isAdmin, // Only fetch if user is admin to prevent 403 errors
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
      setStreamingContent("");
      setTasks([]);
      setActiveTaskId(null);
      setProgressStatus('thinking');
      setProgressMessage("Starting Meta-SySop...");

      console.log('[META-SYSOP] ============ SSE STREAM STARTING ============');
      console.log('[META-SYSOP] Message:', message);
      console.log('[META-SYSOP] Project:', selectedProjectId || 'platform code');
      console.log('[META-SYSOP] =========================================');

      // Create abort controller for stopping stream
      const abortController = new AbortController();
      
      // Start SSE stream using fetch (POST required for this endpoint)
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
          autoPush: false,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Failed to start stream: ${response.statusText}`);
      }

      // Store abort controller for stopping
      eventSourceRef.current = abortController as any;

      // Parse SSE stream manually
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let accumulatedContent = ''; // Track content locally for final message

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

                switch (data.type) {
                  case 'user_message':
                    // User message saved - just acknowledge
                    console.log('[META-SYSOP] User message saved:', data.messageId);
                    break;

                  case 'content':
                    // Stream content in real-time
                    accumulatedContent += (data.content || '');
                    setStreamingContent(accumulatedContent);
                    setProgressStatus('working');
                    break;

                  case 'progress':
                    // Update progress message
                    setProgressMessage(data.message || '');
                    setProgressStatus('working');
                    break;

                  case 'task_list_created':
                    // Fetch task list from database
                    fetch(`/api/meta-sysop/task-list/${data.taskListId}`, {
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
                          console.log('[META-SYSOP] Task list created with', formattedTasks.length, 'tasks');
                        }
                      })
                      .catch(err => {
                        console.error('[META-SYSOP] Failed to fetch task list:', err);
                      });
                    break;

                  case 'task_updated':
                    // Update task status
                    setTasks(prev => prev.map(t => 
                      t.id === data.taskId 
                        ? { ...t, status: data.status as AgentTask['status'] }
                        : t
                    ));
                    if (data.status === 'in_progress') {
                      setActiveTaskId(data.taskId);
                    }
                    console.log('[META-SYSOP] Task updated:', data.taskId, '→', data.status);
                    break;

                  case 'done':
                    // Stream complete - add final message
                    console.log('[META-SYSOP] ✅ Stream complete, messageId:', data.messageId);
                    
                    // Use accumulated content for final message
                    const finalContent = accumulatedContent || '✅ Done!';
                    const assistantMsg: Message = {
                      id: data.messageId || Date.now().toString(),
                      role: 'assistant',
                      content: finalContent,
                    };
                    
                    setMessages(prev => [...prev, assistantMsg]);
                    setStreamingContent('');
                    setIsStreaming(false);
                    setProgressStatus('idle');
                    setProgressMessage('');
                    setTasks(prev => prev.map(t => ({ ...t, status: 'completed' as const })));
                    
                    eventSourceRef.current = null;
                    toast({ title: "✅ Done" });
                    return; // Exit the loop

                  case 'error':
                    // Handle error
                    console.error('[META-SYSOP] ❌ Stream error:', data.message);
                    
                    setIsStreaming(false);
                    setStreamingContent('');
                    setProgressStatus('idle');
                    setProgressMessage('');
                    
                    toast({
                      title: '❌ Error',
                      description: data.message || 'Unknown error',
                      variant: 'destructive'
                    });
                    
                    eventSourceRef.current = null;
                    return; // Exit the loop
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
      setStreamingContent("");
      setProgressStatus('idle');
      setProgressMessage("");
      
      // Mark active task as failed
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
      
      // Cleanup abort controller
      if (eventSourceRef.current) {
        (eventSourceRef.current as AbortController).abort();
        eventSourceRef.current = null;
      }
    },
  });

  const handleSend = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || sendMutation.isPending) return;
    sendMutation.mutate(trimmedInput);
  };

  const handleStop = () => {
    if (eventSourceRef.current) {
      console.log('[META-SYSOP] Stopping stream...');
      (eventSourceRef.current as AbortController).abort();
      eventSourceRef.current = null;
      
      // Mark all in-progress tasks as failed
      setTasks(prev => prev.map(t => 
        t.status === 'in_progress' ? { ...t, status: 'failed' as const } : t
      ));
      
      setIsStreaming(false);
      setStreamingContent("");
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
                
                <div
                  className={cn(
                    "rounded-lg px-4 py-3 max-w-[75%] border",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "bg-muted text-foreground border-border"
                  )}
                >
                  <MessageContent content={message.content} />
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

            {/* Streaming indicator */}
            {isStreaming && (
              <div className="flex gap-3 justify-start animate-in fade-in-up">
                <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-muted flex items-center justify-center animate-pulse">
                  <Wrench className="h-5 w-5 text-muted-foreground" />
                </div>
                <div className="rounded-lg px-4 py-3 max-w-[75%] bg-muted text-foreground border border-border">
                  {streamingContent ? (
                    <MessageContent content={streamingContent} />
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                  )}
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
                        <span className="font-semibold">Platform Code</span>
                      </div>
                    </SelectItem>
                    {projects && projects.length > 0 && (
                      <>
                        <div className="px-2 py-1.5 text-xs text-muted-foreground font-medium">User Projects</div>
                        {projects.map((project: any) => (
                          <SelectItem key={project.id} value={project.id} data-testid={`project-option-${project.id}`}>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-xs">{project.name}</span>
                              <span className="text-[10px] text-muted-foreground">
                                {project.userName || project.userEmail} • {project.fileCount || 0} files
                              </span>
                            </div>
                          </SelectItem>
                        ))}
                      </>
                    )}
                  </SelectContent>
                </Select>
              </div>

              {/* Autonomy Selector */}
              {autonomyData && (
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground font-medium">Autonomy:</span>
                  <Select
                    value={autonomyData.currentLevel}
                    onValueChange={(value) => updateAutonomyMutation.mutate(value)}
                    disabled={updateAutonomyMutation.isPending || isStreaming}
                  >
                    <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs" data-testid="select-autonomy-level">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {autonomyData.levels && Object.values(autonomyData.levels).map((level: any) => {
                        const Icon = level.icon === 'shield' ? Shield : 
                                     level.icon === 'zap' ? Zap : 
                                     level.icon === 'brain' ? Brain : Infinity;
                        
                        return (
                          <SelectItem key={level.id} value={level.id} data-testid={`autonomy-option-${level.id}`}>
                            <div className="flex items-center gap-2">
                              <Icon className="h-3.5 w-3.5" />
                              <span className="font-semibold">{level.name}</span>
                            </div>
                          </SelectItem>
                        );
                      })}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            {/* Input */}
            <div className="flex gap-2">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Tell Meta-SySop what needs to be fixed..."
                className="min-h-[44px] max-h-32 resize-none"
                disabled={isStreaming}
                data-testid="textarea-message"
              />
              <Button
                onClick={handleSend}
                disabled={!input.trim() || isStreaming}
                size="icon"
                className="h-11 w-11 shrink-0"
                data-testid="button-send"
              >
                <Send className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helper to format tool names
function formatToolName(toolName: string): string {
  const nameMap: Record<string, string> = {
    'readPlatformFile': 'Read file',
    'writePlatformFile': 'Write file',
    'listPlatformDirectory': 'List directory',
    'perform_diagnosis': 'Run diagnostics',
    'commit_to_github': 'Commit to GitHub',
    'architect_consult': 'Consult I AM',
    'web_search': 'Search web',
  };

  return nameMap[toolName] || toolName.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').trim();
}
