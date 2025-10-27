import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { Send, Square, ChevronDown, Shield, Zap, Brain, Infinity, Rocket } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
import { AgentTaskList, type AgentTask } from "./agent-task-list";
import { AgentProgressDisplay } from "./agent-progress-display";

interface MetaSySopChatProps {
  autoCommit?: boolean;
  autoPush?: boolean;
}

export function MetaSySopChat({ autoCommit = true, autoPush = true }: MetaSySopChatProps) {
  const { toast } = useToast();
  const [input, setInput] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<'thinking' | 'working' | 'vibing' | 'idle'>('idle');
  const [progressMessage, setProgressMessage] = useState("");
  const [currentTaskContent, setCurrentTaskContent] = useState("");
  const [showTaskList, setShowTaskList] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);

  // Fetch autonomy level
  const { data: autonomyData } = useQuery<any>({
    queryKey: ['/api/meta-sysop/autonomy-level'],
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
      toast({
        title: "Autonomy level updated",
        description: "Meta-SySop's autonomy level has been changed",
      });
    },
  });

  // Send message mutation with streaming
  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      setIsStreaming(true);
      setTasks([]);
      setActiveTaskId(null);
      setCurrentTaskContent("");
      setProgressStatus('thinking');
      setProgressMessage("Analyzing request...");
      
      // Create abort controller
      abortControllerRef.current = new AbortController();

      const response = await fetch('/api/meta-sysop/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ message }),
        signal: abortControllerRef.current.signal,
      });

      if (!response.ok) {
        throw new Error(`Failed to start: ${response.statusText}`);
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      if (!reader) {
        throw new Error('No response stream');
      }

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
                  setCurrentTaskContent(prev => prev + (data.content || ''));
                  setProgressStatus('working');
                  break;

                case 'tool_use':
                  // Add tool as a task
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
                  // Mark tool task as completed
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

                case 'done':
                  setIsStreaming(false);
                  setProgressStatus('idle');
                  setProgressMessage("");
                  
                  // Mark all tasks as completed
                  setTasks(prev => prev.map(t => ({ ...t, status: 'completed' as const })));
                  
                  toast({
                    title: "✅ Task completed",
                    description: "Meta-SySop has finished processing your request",
                  });
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
      setProgressStatus('idle');
      setProgressMessage("");
      
      // Mark current task as failed
      if (activeTaskId) {
        setTasks(prev => prev.map(t => 
          t.id === activeTaskId 
            ? { ...t, status: 'failed' as const }
            : t
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
    
    setInput("");
    sendMutation.mutate(trimmedInput);
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setProgressStatus('idle');
      setProgressMessage("");
      
      toast({
        title: "🛑 Stopped",
        description: "Meta-SySop has been stopped",
      });
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
      {/* Task List Sidebar - Only show when there are tasks */}
      {showTaskList && tasks.length > 0 && (
        <div className="w-64 border-r border-border flex-shrink-0 overflow-y-auto bg-muted/30">
          <div className="p-3 border-b border-border flex items-center justify-between">
            <h3 className="text-sm font-semibold">Tasks</h3>
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
          <AgentTaskList
            tasks={tasks}
            activeTaskId={activeTaskId}
            onTaskClick={(id) => setActiveTaskId(id)}
          />
        </div>
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Header with current task */}
        {isStreaming && activeTaskId && (
          <div className="px-4 py-3 border-b border-border bg-muted/20">
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
                <AgentProgressDisplay 
                  status={progressStatus} 
                  message={progressMessage}
                />
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

        {/* Task Content / Welcome Screen */}
        <div className="flex-1 overflow-y-auto p-4">
          {!isStreaming && tasks.length === 0 ? (
            // Welcome screen
            <div className="max-w-2xl mx-auto text-center pt-12">
              <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-blue-600 to-blue-700 flex items-center justify-center shadow-lg">
                <Rocket className="h-8 w-8 text-white" />
              </div>
              <h2 className="text-2xl font-bold mb-2">Meta-SySop Ready</h2>
              <p className="text-muted-foreground max-w-md mx-auto mb-8">
                I'm your autonomous platform maintenance agent. I can diagnose issues, 
                fix bugs, and deploy updates to the Archetype platform itself.
              </p>
              <div className="grid gap-3 text-left max-w-md mx-auto">
                <div className="p-3 rounded-lg border border-border bg-card/50">
                  <h3 className="font-semibold text-sm mb-1">✨ What I can do:</h3>
                  <ul className="text-sm text-muted-foreground space-y-1">
                    <li>• Fix bugs and errors in the platform code</li>
                    <li>• Optimize performance and memory usage</li>
                    <li>• Update dependencies and configurations</li>
                    <li>• Deploy changes to Railway production</li>
                  </ul>
                </div>
              </div>
            </div>
          ) : (
            // Task content
            <div className="max-w-3xl mx-auto">
              {currentTaskContent && (
                <div className="prose prose-sm dark:prose-invert max-w-none">
                  <div className="whitespace-pre-wrap text-sm leading-relaxed">
                    {currentTaskContent}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Input Area - Fixed at bottom */}
        <div className="border-t border-border p-4 bg-muted/20 flex-shrink-0">
          <div className="max-w-3xl mx-auto space-y-3">
            {/* Autonomy Selector */}
            {autonomyData && (
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-medium">Autonomy:</span>
                <Select
                  value={autonomyData.currentLevel}
                  onValueChange={(value) => updateAutonomyMutation.mutate(value)}
                  disabled={updateAutonomyMutation.isPending || isStreaming}
                >
                  <SelectTrigger 
                    className="h-8 w-auto min-w-[140px] text-xs"
                    data-testid="select-autonomy-level"
                  >
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {autonomyData.levels && Object.values(autonomyData.levels).map((level: any) => {
                      const Icon = level.icon === 'shield' ? Shield : 
                                   level.icon === 'zap' ? Zap : 
                                   level.icon === 'brain' ? Brain : Infinity;
                      
                      return (
                        <SelectItem 
                          key={level.id} 
                          value={level.id}
                          data-testid={`autonomy-option-${level.id}`}
                        >
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

            {/* Input with Send Button */}
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

// Helper function to format tool names nicely
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
