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
      className="absolute top-2 right-2 p-1.5 rounded-md bg-slate-700/50 hover:bg-slate-700 border border-slate-600/50 transition-all text-slate-300 hover:text-white"
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
            <div className="bg-slate-950/90 border border-slate-700/50 rounded-lg p-3 overflow-x-auto">
              <div className="text-[10px] text-slate-500 uppercase mb-2 font-semibold">{part.language}</div>
              <pre className="text-xs text-emerald-300 font-mono leading-relaxed">{part.content}</pre>
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
                  segments.push(<strong key={`bold-${i}-${boldMatch.index}`} className="font-semibold text-slate-100">{boldMatch[1]}</strong>);
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
  const [currentJobId, setCurrentJobId] = useState<string | null>(null); // Track active background job
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // WebSocket listener for background job updates
  useEffect(() => {
    if (!currentJobId) return;

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);

    ws.onopen = () => {
      console.log('[META-SYSOP] WebSocket connected for job:', currentJobId);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Only process meta_sysop_job_update events for current job
        if (data.type !== 'meta_sysop_job_update' || data.jobId !== currentJobId) {
          return;
        }

        console.log('[META-SYSOP] WebSocket event:', data.updateType, data);

        switch (data.updateType) {
          case 'job_content':
            setStreamingContent(prev => prev + (data.content || ''));
            setProgressStatus('working');
            break;

          case 'job_progress':
            setProgressMessage(data.message || '');
            setProgressStatus('working');
            break;

          case 'task_list_created':
            // Fetch the task list from database
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
                  setProgressMessage('Task list created - tracking progress...');
                }
              })
              .catch(err => {
                console.error('[META-SYSOP] Failed to fetch task list:', err);
              });
            break;

          case 'task_updated':
            setTasks(prev => prev.map(t => 
              t.id === data.taskId 
                ? { ...t, status: data.status as AgentTask['status'] }
                : t
            ));
            if (data.status === 'in_progress') {
              setActiveTaskId(data.taskId);
            }
            break;

          case 'job_completed':
            // CRITICAL FIX: Fetch message from database instead of using state
            // (in case WebSocket disconnected during streaming)
            if (data.messageId) {
              fetch(`/api/meta-sysop/message/${data.messageId}`, {
                credentials: 'include'
              })
                .then(res => res.json())
                .then(msgData => {
                  if (msgData.success && msgData.message) {
                    const assistantMsg: Message = {
                      id: msgData.message.id,
                      role: 'assistant',
                      content: msgData.message.content || streamingContent || '✅ Done!',
                    };
                    setMessages(prev => [...prev, assistantMsg]);
                  }
                })
                .catch(err => {
                  console.error('[META-SYSOP] Failed to fetch final message:', err);
                  // Fallback to streamed content if fetch fails
                  const assistantMsg: Message = {
                    id: Date.now().toString(),
                    role: 'assistant',
                    content: streamingContent || '✅ Done!',
                  };
                  setMessages(prev => [...prev, assistantMsg]);
                });
            } else {
              // No messageId, use streamed content
              const assistantMsg: Message = {
                id: Date.now().toString(),
                role: 'assistant',
                content: streamingContent || '✅ Done!',
              };
              setMessages(prev => [...prev, assistantMsg]);
            }
            
            setIsStreaming(false);
            setProgressStatus('idle');
            setCurrentJobId(null);
            setStreamingContent('');
            setTasks(prev => prev.map(t => ({ ...t, status: 'completed' as const })));
            
            toast({ title: "✅ Task completed" });
            break;

          case 'job_failed':
            setIsStreaming(false);
            setProgressStatus('idle');
            setCurrentJobId(null);
            setStreamingContent('');
            
            toast({ 
              title: '❌ Job failed', 
              description: data.error || 'Unknown error',
              variant: 'destructive' 
            });
            break;
        }
      } catch (error) {
        console.error('[META-SYSOP] WebSocket message parse error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('[META-SYSOP] WebSocket error:', error);
    };

    ws.onclose = () => {
      console.warn('[META-SYSOP] WebSocket disconnected - content may be lost!');
      // Note: If connection drops, job_completed will fetch message from database
    };

    return () => {
      console.log('[META-SYSOP] Closing WebSocket for job:', currentJobId);
      ws.close();
    };
  }, [currentJobId, toast]); // CRITICAL FIX: Removed streamingContent to prevent reconnection loops

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

  // Query for user's active job (poll every 5s when no current job)
  const { data: activeJobData } = useQuery<any>({
    queryKey: ['/api/meta-sysop/active-job'],
    enabled: !currentJobId && isAdmin,
    refetchInterval: 5000,
  });

  const activeJob = activeJobData?.job;

  // Resume mutation
  const resumeMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`/api/meta-sysop/resume/${jobId}`, {
        method: 'POST',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to resume job');
      setCurrentJobId(jobId);
      setIsStreaming(true);
      setProgressStatus('working');
      setProgressMessage("Resuming Meta-SySop...");
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "✅ Job resumed" });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Resume failed",
        description: error.message || 'Failed to resume job',
        variant: "destructive",
      });
    },
  });

  // Cancel stuck job mutation
  const cancelJobMutation = useMutation({
    mutationFn: async (jobId: string) => {
      const response = await fetch(`/api/meta-sysop/job/${jobId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!response.ok) throw new Error('Failed to cancel job');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: "✅ Job cancelled" });
      // Trigger refetch of active job
      queryClient.invalidateQueries({ queryKey: ['/api/meta-sysop/active-job'] });
    },
    onError: (error: any) => {
      toast({
        title: "❌ Cancel failed",
        description: error.message || 'Failed to cancel job',
        variant: "destructive",
      });
    },
  });

  // Send message mutation - now starts background job instead of SSE
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
      setProgressMessage("Starting Meta-SySop background job...");

      // Start background job
      const response = await fetch('/api/meta-sysop/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          message,
          projectId: selectedProjectId,
        }),
      });

      if (!response.ok) {
        throw new Error(`Failed to start job: ${response.statusText}`);
      }

      const { jobId } = await response.json();
      setCurrentJobId(jobId);
      setProgressStatus('working');
      setProgressMessage("Meta-SySop is working...");
      
      console.log('[META-SYSOP] Started background job:', jobId);
      
      // SIMPLE POLLING: Check every 3 seconds for completion
      const checkCompletion = async () => {
        for (let i = 0; i < 60; i++) { // Max 3 minutes
          await new Promise(resolve => setTimeout(resolve, 3000));
          
          try {
            const jobRes = await fetch(`/api/meta-sysop/active-job`, { credentials: 'include' });
            const jobData = await jobRes.json();
            
            if (!jobData.job || jobData.job.status === 'completed' || jobData.job.status === 'failed') {
              // Fetch last 2 messages (user + assistant)
              const histRes = await fetch('/api/meta-sysop/chat-history?limit=2', { credentials: 'include' });
              const histData = await histRes.json();
              
              if (histData.success && histData.messages) {
                const assistantMsg = histData.messages.find((m: any) => m.role === 'assistant');
                if (assistantMsg) {
                  setMessages(prev => [...prev, {
                    id: assistantMsg.id,
                    role: 'assistant',
                    content: assistantMsg.content
                  }]);
                }
              }
              
              setIsStreaming(false);
              setProgressStatus('idle');
              setCurrentJobId(null);
              toast({ title: "✅ Done" });
              break;
            }
          } catch (err) {
            console.error('Poll error:', err);
          }
        }
      };
      
      checkCompletion(); // Start polling
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
    },
  });

  const handleSend = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || sendMutation.isPending) return;
    sendMutation.mutate(trimmedInput);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      
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
    <div className="flex h-full overflow-hidden bg-slate-900/60">
      {/* Main Content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Active Task Header */}
        {isStreaming && activeTaskId && (
          <div className="px-4 py-3 border-b border-slate-800/50 bg-slate-950/60">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-sm font-semibold text-slate-200 truncate">
                    {tasks.find(t => t.id === activeTaskId)?.title || 'Working...'}
                  </h2>
                  {tasks.length > 0 && (
                    <span className="text-xs text-slate-400 shrink-0">
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
            {/* Active Job Controls - Resume or Cancel */}
            {activeJob && (activeJob.status === 'interrupted' || activeJob.status === 'running' || activeJob.status === 'pending') && !currentJobId && (
              <div className="mb-4 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg animate-in fade-in-up">
                <p className="text-sm text-amber-200 mb-2">
                  {activeJob.status === 'interrupted' 
                    ? 'Meta-SySop session was interrupted' 
                    : 'Active Meta-SySop job found'}
                </p>
                <p className="text-xs text-amber-300/70 mb-3">
                  Job ID: {activeJob.id.substring(0, 8)}... • Status: {activeJob.status}
                </p>
                <div className="flex gap-2">
                  <Button 
                    size="sm" 
                    onClick={() => resumeMutation.mutate(activeJob.id)}
                    disabled={resumeMutation.isPending || cancelJobMutation.isPending}
                    data-testid="button-resume-job"
                    className="bg-amber-600 hover:bg-amber-700 text-white"
                  >
                    {resumeMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <Rocket className="w-4 h-4 mr-2" />
                    )}
                    Resume
                  </Button>
                  <Button 
                    size="sm" 
                    variant="destructive"
                    onClick={() => cancelJobMutation.mutate(activeJob.id)}
                    disabled={resumeMutation.isPending || cancelJobMutation.isPending}
                    data-testid="button-cancel-job"
                  >
                    {cancelJobMutation.isPending ? (
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    ) : (
                      <XCircle className="w-4 h-4 mr-2" />
                    )}
                    Cancel Job
                  </Button>
                </div>
              </div>
            )}

            {/* Welcome screen */}
            {messages.length === 0 && !isStreaming && (
              <div className="text-center py-12 animate-in fade-in-up duration-700">
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center shadow-lg">
                  <Wrench className="h-8 w-8 text-white" />
                </div>
                <h3 className="text-xl font-bold text-slate-100 mb-2">Meta-SySop Ready</h3>
                <p className="text-slate-400 max-w-md mx-auto leading-relaxed">
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
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center shadow-lg">
                    <Wrench className="h-5 w-5 text-white" />
                  </div>
                )}
                
                <div
                  className={cn(
                    "rounded-xl px-4 py-3 max-w-[75%] shadow-lg",
                    message.role === "user"
                      ? "bg-gradient-to-br from-slate-700 to-slate-600 text-white border border-slate-500/20"
                      : "bg-slate-800/90 text-slate-200 border border-slate-700/50"
                  )}
                >
                  <MessageContent content={message.content} />
                </div>

                {message.role === "user" && (
                  <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-slate-700 flex items-center justify-center">
                    <User className="h-5 w-5 text-slate-300" />
                  </div>
                )}
              </div>
            ))}

            {/* Inline Task Progress Card */}
            {showTaskList && tasks.length > 0 && (
              <div className="animate-in fade-in-up">
                <div className="bg-card/50 border border-border/40 rounded-xl p-4 shadow-sm backdrop-blur-md">
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
                <div className="flex-shrink-0 w-9 h-9 rounded-xl bg-gradient-to-br from-slate-700 to-slate-600 flex items-center justify-center shadow-lg animate-pulse">
                  <Wrench className="h-5 w-5 text-white" />
                </div>
                <div className="rounded-xl px-4 py-3 max-w-[75%] bg-slate-800/90 text-slate-200 border border-slate-700/50 shadow-lg">
                  {streamingContent ? (
                    <MessageContent content={streamingContent} />
                  ) : (
                    <div className="flex items-center gap-2 text-sm text-slate-400">
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                      <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Input Area */}
        <div className="border-t border-slate-800/50 p-4 bg-slate-950/80 flex-shrink-0">
          <div className="max-w-3xl mx-auto space-y-3">
            {/* Project Selector & Autonomy Selector */}
            <div className="flex items-center gap-6 flex-wrap">
              {/* Project Selector */}
              <div className="flex items-center gap-3">
                <span className="text-xs text-slate-400 font-medium">Target:</span>
                <Select
                  value={selectedProjectId || "platform"}
                  onValueChange={(value) => setSelectedProjectId(value === "platform" ? null : value)}
                  disabled={isStreaming}
                >
                  <SelectTrigger className="h-8 w-auto min-w-[180px] text-xs bg-slate-900/50 border-slate-700" data-testid="select-project">
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
                        <div className="px-2 py-1.5 text-xs text-slate-500 font-medium">User Projects</div>
                        {projects.map((project: any) => (
                          <SelectItem key={project.id} value={project.id} data-testid={`project-option-${project.id}`}>
                            <div className="flex flex-col gap-0.5">
                              <span className="font-semibold text-xs">{project.name}</span>
                              <span className="text-[10px] text-slate-500">
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
                  <span className="text-xs text-slate-400 font-medium">Autonomy:</span>
                  <Select
                    value={autonomyData.currentLevel}
                    onValueChange={(value) => updateAutonomyMutation.mutate(value)}
                    disabled={updateAutonomyMutation.isPending || isStreaming}
                  >
                    <SelectTrigger className="h-8 w-auto min-w-[140px] text-xs bg-slate-900/50 border-slate-700" data-testid="select-autonomy-level">
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
                className="min-h-[44px] max-h-32 resize-none bg-slate-900/50 border-slate-700 text-slate-200"
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
