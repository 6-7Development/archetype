import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Square, ChevronDown, ChevronRight, Shield, Zap, Brain, Infinity, Rocket, Wrench, User, Copy, Check } from "lucide-react";
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
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

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

  // Send message mutation
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
      setProgressMessage("Analyzing request...");
      
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/meta-sysop/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ 
          message,
          projectId: selectedProjectId, // null = platform code, otherwise user project ID
        }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to start: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullContent = '';

      if (!reader) throw new Error('No response stream');

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split('\n');
          buffer = lines.pop() || '';

          for (const line of lines) {
            if (!line.trim() || !line.startsWith('data: ')) continue;
            
            try {
              const data = JSON.parse(line.slice(6));

              switch (data.type) {
                case 'content':
                  fullContent += data.content || '';
                  setStreamingContent(fullContent);
                  setProgressStatus('working');
                  break;

                case 'tool_use':
                  const toolTask: AgentTask = {
                    id: data.id || `tool-${Date.now()}`,
                    title: formatToolName(data.name || 'Unknown tool'),
                    status: 'in_progress',
                  };
                  setTasks(prev => {
                    const existing = prev.find(t => t.id === toolTask.id);
                    if (existing) return prev;
                    return [...prev, toolTask];
                  });
                  setActiveTaskId(toolTask.id);
                  setProgressMessage(`Using ${formatToolName(data.name)}...`);
                  setShowTaskList(true);
                  break;

                case 'tool_result':
                  setTasks(prev => prev.map(t => 
                    t.id === data.tool_use_id 
                      ? { ...t, status: 'completed' as const }
                      : t
                  ));
                  setProgressStatus('thinking');
                  setProgressMessage("Processing results...");
                  break;

                case 'progress':
                  setProgressMessage(data.message || '');
                  setProgressStatus('working');
                  break;

                case 'task_list_created':
                  // Fetch the task list from the database
                  fetch(`/api/meta-sysop/task-list/${data.taskListId}`, {
                    credentials: 'include'
                  })
                    .then(async res => {
                      if (!res.ok) {
                        throw new Error(`Failed to fetch task list: ${res.status} ${res.statusText}`);
                      }
                      return res.json();
                    })
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
                        console.log('[META-SYSOP] Task list populated:', formattedTasks.length, 'tasks');
                      } else {
                        console.error('[META-SYSOP] Task list fetch returned no tasks:', taskListData);
                      }
                    })
                    .catch(err => {
                      console.error('[META-SYSOP] Failed to fetch task list:', err);
                      toast({ 
                        title: "Failed to load task list", 
                        description: "Task progress may not be visible",
                        variant: "destructive" 
                      });
                    });
                  break;

                case 'task_updated':
                  // Update specific task status
                  setTasks(prev => prev.map(t => 
                    t.id === data.taskId 
                      ? { ...t, status: data.status as AgentTask['status'] }
                      : t
                  ));
                  if (data.status === 'in_progress') {
                    setActiveTaskId(data.taskId);
                  }
                  break;

                case 'done':
                  // Add assistant message to session
                  const assistantMsg: Message = {
                    id: Date.now().toString(),
                    role: "assistant",
                    content: fullContent,
                  };
                  setMessages(prev => [...prev, assistantMsg]);
                  
                  setIsStreaming(false);
                  setStreamingContent("");
                  setProgressStatus('idle');
                  setProgressMessage("");
                  setTasks(prev => prev.map(t => ({ ...t, status: 'completed' as const })));
                  
                  toast({ title: "✅ Task completed" });
                  break;

                case 'error':
                  throw new Error(data.error || 'Unknown error');
              }
            } catch (parseError) {
              console.warn('Failed to parse SSE event:', line);
            }
          }
        }
      } finally {
        setIsStreaming(false);
        setProgressStatus('idle');
        abortControllerRef.current = null;
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
                <div className="bg-slate-800/60 border border-slate-700/50 rounded-xl p-4 shadow-lg backdrop-blur-sm">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <Loader2 className="w-4 h-4 text-blue-400 animate-spin" />
                      <h3 className="text-sm font-semibold text-slate-200">
                        Task Progress
                      </h3>
                      <span className="text-xs text-slate-400">
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
