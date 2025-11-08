import { useState, useRef, useEffect, Component, type ReactNode, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient } from "@/lib/queryClient";
import { Send, Square, ChevronDown, ChevronRight, Shield, Zap, Brain, Infinity, Rocket, User, Copy, Check, Loader2, XCircle, FileCode, Terminal, CheckCircle, Clock, Upload, X, File, Image, AlertCircle } from "lucide-react";
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
import { TaskTimeline, type TaskTimelineTask } from "./task-timeline";
import { ChatArtifact, type Artifact } from "./chat-artifact";
import { ProjectSelector } from "./project-selector";
import { AIModelSelector } from "./ai-model-selector";
import { ArchitectNotesPanel } from "./architect-notes-panel";
import { CreditBalanceWidget } from "./credit-balance-widget";
import { CreditPurchaseModal } from "./credit-purchase-modal";
import { ScratchpadDisplay } from "./scratchpad-display";
import { useWebSocketStream } from "@/hooks/use-websocket-stream";
import { nanoid } from "nanoid";
// ✅ NEW: Agent Chatroom UX Components
import { StatusStrip } from "@/components/agent/StatusStrip";
import { TaskPane } from "@/components/agent/TaskPane";
import { ArtifactsDrawer, type Artifact as ArtifactItem } from "@/components/agent/ArtifactsDrawer";
import type { RunPhase } from "@shared/agentEvents";

// Error boundary for chat messages
class ChatErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  constructor(props: { children: ReactNode }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[LOMU-CHAT] Error rendering message:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-4 bg-destructive/10 text-destructive rounded-md">
          <p className="text-sm">Unable to display this message. The chat continues below.</p>
        </div>
      );
    }

    return this.props.children;
  }
}

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
  artifacts?: Artifact[]; // Rich inline content (code blocks, file previews, etc.)
}

interface LomuAiChatProps {
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
      console.log(`[LOMU-AI] Retry attempt ${attempt + 1}/${maxRetries} after ${delay}ms`);
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

// Detect frustration in user messages
function detectFrustration(message: string): boolean {
  const frustrationPatterns = [
    /broken/i,
    /not working/i,
    /doesn't work/i,
    /won't work/i,
    /keeps failing/i,
    /always fails/i,
    /frustrat(ed|ing)/i,
    /annoying/i,
    /stupid/i,
    /hate/i,
    /terrible/i,
    /awful/i,
    /wtf/i,
    /why (is|does) this/i,
    /help me/i,
    /please fix/i,
    /urgent/i,
    /asap/i,
    /critical/i,
    /still not/i,
    /keeps breaking/i,
  ];

  return frustrationPatterns.some(pattern => pattern.test(message));
}

// Get empathetic prefix for frustrated messages
function getEmpathyPrefix(message: string): string {
  const empathyPrefixes = [
    "I can see this is frustrating. ",
    "I totally understand - when things aren't working, it's really annoying. ",
    "I hear you! ",
    "No worries, I've got your back. ",
    "Ugh, I know how frustrating this is! ",
  ];

  // Randomly select one to keep it feeling natural
  return empathyPrefixes[Math.floor(Math.random() * empathyPrefixes.length)];
}

// AttachmentPreview component
function AttachmentPreview({ attachment, onRemove }: { attachment: Attachment; onRemove: () => void }) {
  const [showPreview, setShowPreview] = useState(false);

  return (
    <div className="relative group flex-shrink-0">
      <div className="flex items-center gap-1.5 md:gap-2 p-1.5 md:p-2 bg-muted rounded-lg border border-border min-w-[140px] md:min-w-[160px]">
        {attachment.fileType === 'image' ? (
          <Image className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground shrink-0" />
        ) : (
          <File className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className="text-xs font-medium truncate">{attachment.fileName}</div>
          <div className="text-xs text-muted-foreground">{formatFileSize(attachment.size)}</div>
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="h-10 w-10 md:h-8 md:w-8 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity shrink-0"
          onClick={onRemove}
          data-testid="button-remove-attachment"
        >
          <X className="h-4 w-4 md:h-3 md:w-3" />
        </Button>
      </div>

      {/* Image preview on hover - desktop only */}
      {attachment.fileType === 'image' && attachment.content && (
        <div className="absolute bottom-full mb-2 left-0 z-10 hidden md:group-hover:block">
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

export function LomuAIChat({ autoCommit = true, autoPush = true, onTasksChange }: LomuAiChatProps) {
  const { toast } = useToast();
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<Message[]>([]);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [copiedChatHistory, setCopiedChatHistory] = useState(false);
  const [progressStatus, setProgressStatus] = useState<'thinking' | 'working' | 'vibing' | 'idle'>('idle');
  const [progressMessage, setProgressMessage] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState<string | null>(null);
  const [attachments, setAttachments] = useState<Attachment[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [currentChatMessageId, setCurrentChatMessageId] = useState<string | null>(null);
  const [isPaused, setIsPaused] = useState(false);
  const [pauseMessage, setPauseMessage] = useState('');
  const [pausedRunId, setPausedRunId] = useState<string | null>(null);
  const [showCreditPurchase, setShowCreditPurchase] = useState(false);
  // ✅ NEW: Agent Chatroom UX State
  const [currentPhase, setCurrentPhase] = useState<RunPhase>('idle');
  const [phaseMessage, setPhaseMessage] = useState<string>('');
  const [artifacts, setArtifacts] = useState<ArtifactItem[]>([]);
  const [showTaskPane, setShowTaskPane] = useState(false);
  const [showArtifactsDrawer, setShowArtifactsDrawer] = useState(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastEventTimeRef = useRef<number>(Date.now());
  const fileInputRef = useRef<HTMLInputElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Get active project ID
  const { data: activeSession } = useQuery<{ activeProjectId: string | null }>({
    queryKey: ["/api/user/active-project"],
  });
  const activeProjectId = activeSession?.activeProjectId || null;

  // WebSocket session ID for real-time thinking indicators
  const sessionId = useMemo(() => {
    const storageKey = `lomu-chat-session-${activeProjectId || 'default'}`;
    let id = localStorage.getItem(storageKey);
    if (!id) {
      id = nanoid();
      localStorage.setItem(storageKey, id);
    }
    return id;
  }, [activeProjectId]);

  // WebSocket stream for Gemini thinking indicators
  const streamState = useWebSocketStream(sessionId, user?.id || 'anonymous');

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

  // 🧠 GEMINI THINKING INDICATORS: Sync WebSocket stream state to progress display
  useEffect(() => {
    if (streamState.currentThought) {
      setProgressStatus('thinking');
      setProgressMessage(streamState.currentThought);
      setCurrentPhase('thinking');
      setPhaseMessage(streamState.currentThought);
    } else if (streamState.currentAction) {
      setProgressStatus('working');
      setProgressMessage(streamState.currentAction);
      setCurrentPhase('working');
      setPhaseMessage(streamState.currentAction);
    } else if (isStreaming) {
      setProgressStatus('working');
      setProgressMessage('Generating response...');
      setCurrentPhase('working');
      setPhaseMessage('Generating response...');
    } else {
      setProgressStatus('idle');
      setProgressMessage('');
      setCurrentPhase('idle');
      setPhaseMessage('');
    }
  }, [streamState.currentThought, streamState.currentAction, isStreaming]);

  // Cleanup stream on unmount
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        console.log('[LOMU-AI] Aborting stream on unmount');
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
        console.warn('[LOMU-AI] No events received for 30+ seconds - connection may be stalled');
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
    queryKey: ['/api/lomu-ai/autonomy-level'],
  });

  // Fetch all projects (admin only)
  const { data: projects } = useQuery<any[]>({
    queryKey: ['/api/lomu-ai/projects'],
    enabled: isAdmin,
  });

  // Update autonomy level
  const updateAutonomyMutation = useMutation({
    mutationFn: async (level: string) => {
      const response = await fetch('/api/lomu-ai/autonomy-level', {
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

  // Default greeting message - emphasizes platform awareness and maintenance role
  const DEFAULT_GREETING: Message = {
    id: 'greeting',
    role: "assistant",
    content: "Hi! I'm LomuAI, your autonomous platform maintenance AI. I'm aware of the entire Archetype platform codebase and recent changes. I can diagnose issues, fix bugs, optimize performance, and evolve the platform. What needs my attention?",
  };

  // Send message mutation - uses SSE streaming for real-time responses
  const sendMutation = useMutation({
    mutationFn: async (message: string) => {
      // Detect frustration and add empathetic prefix
      let processedMessage = message;
      const isFrustrated = detectFrustration(message);

      if (isFrustrated) {
        const empathyPrefix = getEmpathyPrefix(message);
        processedMessage = empathyPrefix + message;
        console.log('[LOMU-AI] 💛 Frustration detected - adding empathetic context');
      }

      // Add user message to session (show original message, but send processed one)
      const userMsg: Message = {
        id: Date.now().toString(),
        role: "user",
        content: message, // Display the original message
        attachments: attachments.length > 0 ? [...attachments] : undefined,
      };
      setMessages(prev => [...prev, userMsg]);
      setInput("");
      setAttachments([]); // Clear attachments after sending

      setIsStreaming(true);
      setTasks([]);
      setActiveTaskId(null);
      setProgressStatus('thinking');
      setProgressMessage("Starting LomuAI...");

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

      console.log('[LOMU-AI] ============ SSE STREAM STARTING ============');
      console.log('[LOMU-AI] Message:', message);
      console.log('[LOMU-AI] Attachments:', attachments.length);
      console.log('[LOMU-AI] Project:', selectedProjectId || 'platform code');
      console.log('[LOMU-AI] =========================================');

      // Create abort controller for stopping stream
      const abortController = new AbortController();

      // Start SSE stream using fetch
      const response = await fetch('/api/lomu-ai/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        signal: abortController.signal,
        body: JSON.stringify({
          message: processedMessage, // Send the message with empathy prefix if needed
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
                console.log('[LOMU-AI] SSE event:', data.type);

                // Update last event timestamp for timeout detection
                lastEventTimeRef.current = Date.now();

                switch (data.type) {
                  case 'user_message':
                    console.log('[LOMU-AI] User message saved:', data.messageId);
                    // Store message ID for task persistence
                    setCurrentChatMessageId(data.messageId);
                    localStorage.setItem('lomu-current-message-id', data.messageId);
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
                    const progressMsg = data.message || '';
                    setProgressMessage(progressMsg);
                    
                    // Smart status detection based on progress message emoji (with trimming for formatting variations)
                    const trimmedMsg = progressMsg.trim();
                    if (trimmedMsg.startsWith('✅')) {
                      setProgressStatus('vibing'); // Creative work: file edits, code generation
                    } else if (trimmedMsg.startsWith('🔧')) {
                      setProgressStatus('working'); // Tool execution, bash commands
                    } else if (trimmedMsg.startsWith('📋') || trimmedMsg.startsWith('🔍')) {
                      setProgressStatus('thinking'); // Planning, analysis, search
                    } else {
                      // Fallback: use server status if available, otherwise default to 'working'
                      setProgressStatus(data.status || 'working');
                    }
                    break;

                  case 'task_list_created':
                    // Use retry logic for fetching task list
                    retryFetch(`/api/lomu-ai/task-list/${data.taskListId}`, {
                      credentials: 'include'
                    })
                      .then(res => res.json())
                      .then(taskListData => {
                        if (taskListData.success && taskListData.tasks && taskListData.tasks.length > 0) {
                          const formattedTasks: AgentTask[] = taskListData.tasks.map((t: any) => ({
                            id: t.id,
                            title: t.title,
                            description: t.description,
                            status: t.status as AgentTask['status'],
                          }));
                          setTasks(formattedTasks);
                          
                          // Save tasks to localStorage for persistence
                          if (currentChatMessageId) {
                            localStorage.setItem(`tasks-${currentChatMessageId}`, JSON.stringify(formattedTasks));
                            console.log('[LOMU-AI] Tasks saved to localStorage for message:', currentChatMessageId);
                          }
                          
                          console.log('[LOMU-AI] Task list loaded with', formattedTasks.length, 'tasks');
                        } else {
                          console.log('[LOMU-AI] Task list empty or unavailable:', taskListData.message || 'No tasks');
                          setTasks([]); // Clear any stale tasks
                        }
                      })
                      .catch(err => {
                        console.error('[LOMU-AI] Failed to fetch task list after retries:', err);
                        setTasks([]); // Clear tasks on error
                        // Don't show error toast - just log it and continue
                        console.log('[LOMU-AI] Continuing without task list display');
                      });
                    break;

                  case 'task_updated':
                    // Check if task exists before updating
                    setTasks(prev => {
                      const taskExists = prev.some(t => t.id === data.taskId);
                      if (!taskExists) {
                        console.warn('[LOMU-AI] Task update received for unknown taskId:', data.taskId);
                      }

                      const updatedTasks = prev.map(t => 
                        t.id === data.taskId 
                          ? { ...t, status: data.status as AgentTask['status'] }
                          : t
                      );
                      
                      // Save updated tasks to localStorage
                      if (currentChatMessageId) {
                        localStorage.setItem(`tasks-${currentChatMessageId}`, JSON.stringify(updatedTasks));
                      }
                      
                      return updatedTasks;
                    });

                    if (data.status === 'in_progress') {
                      setActiveTaskId(data.taskId);
                    }
                    console.log('[LOMU-AI] Task updated:', data.taskId, '→', data.status);
                    break;

                  // Remove all section-based events - we're using direct content streaming now
                  case 'section_start':
                  case 'section_update': 
                  case 'section_finish':
                    // Ignore - using simple content streaming instead
                    break;

                  case 'agent_paused':
                    setIsPaused(true);
                    setPauseMessage(data.message || 'Agent paused due to insufficient credits');
                    setPausedRunId(data.runId || null); // Store run ID for resume
                    setIsStreaming(false);
                    console.log('[LOMU-AI] Agent paused:', data.message, 'runId:', data.runId);
                    break;

                  case 'done': {
                    console.log('[LOMU-AI] Stream complete, messageId:', data.messageId);

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
                    console.error('[LOMU-AI] Stream error:', data.message);

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
                console.error('[LOMU-AI] Failed to parse SSE data:', error);
              }
            }
          }
        }
      } catch (error: any) {
        if (error.name === 'AbortError') {
          console.log('[LOMU-AI] Stream aborted by user');
        } else {
          console.error('[LOMU-AI] Stream error:', error);
          throw error;
        }
      }
    },
    onError: (error: any) => {
      console.error('LomuAI error:', error);
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

  // Start with clean greeting - NO auto-loading of old history
  // This ensures AI gets fresh context without confusion from old conversations
  useEffect(() => {
    setMessages([DEFAULT_GREETING]);
    
    // Restore the last chat message ID from localStorage for task persistence
    const savedMessageId = localStorage.getItem('lomu-current-message-id');
    if (savedMessageId) {
      setCurrentChatMessageId(savedMessageId);
      console.log('[LOMU-AI] Restored message ID from localStorage:', savedMessageId);
      
      // Try to load tasks for this message
      const savedTasks = localStorage.getItem(`tasks-${savedMessageId}`);
      if (savedTasks) {
        try {
          const parsedTasks = JSON.parse(savedTasks);
          setTasks(parsedTasks);
          console.log('[LOMU-AI] Restored', parsedTasks.length, 'tasks from localStorage');
        } catch (err) {
          console.error('[LOMU-AI] Failed to parse saved tasks:', err);
        }
      }
    }
  }, []); // Only run once on mount

  const handleSend = () => {
    const trimmedInput = input.trim();
    if (!trimmedInput || sendMutation.isPending) return;
    sendMutation.mutate(trimmedInput);
  };

  const handleClearScratchpad = async () => {
    try {
      const response = await fetch(`/api/scratchpad/${sessionId}`, {
        method: 'DELETE',
      });
      
      if (!response.ok) {
        throw new Error('Failed to clear scratchpad');
      }
      
      toast({
        title: "Scratchpad cleared",
        description: "Progress log has been cleared",
      });
    } catch (error) {
      console.error('[SCRATCHPAD] Error clearing:', error);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to clear scratchpad",
      });
    }
  };

  const handleStop = () => {
    if (abortControllerRef.current) {
      console.log('[LOMU-AI] Stopping stream...');
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

      {/* Main Content with Sidebar */}
      <div className="flex-1 flex overflow-hidden">
        {/* Chat Section */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Project & AI Model Selection */}
          <div className="flex items-center justify-between p-4 border-b">
            <ProjectSelector />
            <div className="flex items-center gap-4">
              <CreditBalanceWidget />
              <AIModelSelector />
            </div>
          </div>

          {/* ✅ NEW: Agent Status Strip - Shows current phase */}
          {isStreaming && (
            <StatusStrip 
              phase={currentPhase}
              message={phaseMessage}
              isExecuting={isStreaming}
            />
          )}

          {/* Active Task Header */}
          {isStreaming && activeTaskId && (
            <div className="px-3 py-2 md:px-4 md:py-3 border-b border-border bg-muted/30">
              <div className="flex items-center justify-between gap-2 md:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <h2 className="text-xs md:text-sm font-semibold truncate">
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
                  className="shrink-0 h-7 md:h-8"
                  data-testid="button-stop"
                >
                  <Square className="h-3 w-3 md:h-3.5 md:w-3.5 mr-1 md:mr-1.5 fill-current" />
                  <span className="text-xs">Stop</span>
                </Button>
              </div>
            </div>
          )}

        

        {/* Messages Area */}
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-2 md:p-4 space-y-3 md:space-y-4 scroll-smooth"
        >
          <div className="max-w-4xl mx-auto space-y-3 md:space-y-4">
            {/* Inline Progress Messages - Like Replit Agent */}
            {streamState.progressMessages.length > 0 && (
              <div className="flex flex-col gap-2">
                {streamState.progressMessages.map((progress) => (
                  <div key={progress.id} className="flex gap-3 justify-start animate-in fade-in-up">
                    <div className="max-w-[75%] rounded-xl px-3 py-2 bg-secondary/30 border border-border/30">
                      <p className="text-xs text-muted-foreground leading-relaxed">{progress.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Welcome screen */}
            {messages.length === 0 && !isStreaming && (
              <div className="text-center py-6 md:py-8 animate-in fade-in-up duration-700">
                <h3 className="text-lg md:text-2xl font-bold mb-1 md:mb-2 px-2">LomuAI Platform Healing</h3>
                <h4 className="text-sm md:text-lg text-muted-foreground mb-2 md:mb-3 px-2">Autonomous Platform Assistant</h4>
                <p className="text-xs md:text-base text-muted-foreground max-w-md mx-auto leading-relaxed px-4">
                  I'm an autonomous platform healing agent. I can diagnose and fix issues 
                  with the Lomu platform itself. Tell me what needs to be fixed.
                </p>
                <div className="mt-2 md:mt-4 text-xs md:text-sm text-muted-foreground px-2">
                  💡 Tip: You can upload images, paste screenshots, or attach code/logs
                </div>
              </div>
            )}

            {/* Message list */}
            {messages.map((message) => (
              <ChatErrorBoundary key={message.id}>
                <div
                  className={cn(
                    "flex gap-2 md:gap-3 animate-in fade-in-up",
                    message.role === "user" ? "justify-end" : "justify-start"
                  )}
                >
                <div className={cn("rounded-lg max-w-[90%] md:max-w-[85%]", message.role === "user" ? "w-auto" : "w-full")}>
                  {message.role === "user" ? (
                    <div className="space-y-1.5 md:space-y-2">
                      <div className="px-3 py-2 md:px-4 md:py-3 bg-primary text-primary-foreground border border-primary rounded-lg">
                        <div className="text-xs md:text-sm leading-relaxed whitespace-pre-wrap">{message.content}</div>
                      </div>
                      {/* User attachments */}
                      {message.attachments && message.attachments.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 md:gap-2">
                          {message.attachments.map((attachment, idx) => (
                            <div key={idx} className="flex items-center gap-1.5 md:gap-2 p-1.5 md:p-2 bg-muted rounded-lg border border-border">
                              {attachment.fileType === 'image' ? (
                                <Image className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground shrink-0" />
                              ) : (
                                <File className="w-3 h-3 md:w-4 md:h-4 text-muted-foreground shrink-0" />
                              )}
                              <div className="text-xs">
                                <div className="font-medium truncate max-w-[120px]">{attachment.fileName}</div>
                                <div className="text-muted-foreground">{formatFileSize(attachment.size)}</div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    // 🎯 ASSISTANT MESSAGE: Content + Artifacts + Task Timeline + Streaming Indicator
                    <div className="space-y-2 md:space-y-3">
                      {message.content && (
                        <div className="px-3 py-2 md:px-4 md:py-3 bg-muted text-foreground border border-border rounded-lg">
                          <div className="prose prose-sm max-w-none dark:prose-invert text-xs md:text-sm">
                            <MarkdownRenderer content={message.content} />
                          </div>
                        </div>
                      )}

                      {/* 🎯 ARTIFACTS: Rich inline code blocks, file previews, etc. */}
                      {message.artifacts && message.artifacts.length > 0 && (
                        <div className="space-y-2 md:space-y-3" data-testid="message-artifacts">
                          {message.artifacts.map((artifact) => (
                            <ChatArtifact
                              key={artifact.id}
                              artifact={artifact}
                              onCopy={(content) => {
                                toast({
                                  title: "✅ Copied!",
                                  description: "Code copied to clipboard",
                                });
                              }}
                            />
                          ))}
                        </div>
                      )}

                      {/* 🎯 TASK TIMELINE: Show tasks when streaming or when there are tasks */}
                      {(message.isStreaming || tasks.length > 0) && tasks.length > 0 && (
                        <div className="w-full">
                          <TaskTimeline 
                            tasks={tasks.map(t => ({
                              id: t.id,
                              title: t.title,
                              description: t.description,
                              status: t.status,
                              architectReviewed: undefined,
                              architectReviewReason: undefined,
                              result: undefined,
                              error: undefined,
                              startedAt: undefined,
                              completedAt: undefined,
                              createdAt: undefined,
                            }))}
                            activeTaskId={activeTaskId}
                            showHeader={true}
                            compact={false}
                          />
                        </div>
                      )}

                      {message.isStreaming && !message.content && (
                        <div className="px-3 py-2 md:px-4 md:py-3 bg-muted text-foreground border border-border rounded-lg">
                          <div className="flex items-center gap-2 text-xs md:text-sm text-muted-foreground">
                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-primary rounded-full animate-pulse" />
                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.2s' }} />
                            <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-primary rounded-full animate-pulse" style={{ animationDelay: '0.4s' }} />
                            <span className="text-xs ml-1 md:ml-2">LomuAI is typing...</span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>

                {message.role === "user" && (
                  <div className="flex-shrink-0 w-7 h-7 md:w-9 md:h-9 rounded-lg bg-primary flex items-center justify-center">
                    <User className="h-4 w-4 md:h-5 md:w-5 text-primary-foreground" />
                  </div>
                )}
              </div>
              </ChatErrorBoundary>
            ))}
          </div>
        </div>

        {/* Agent Paused Banner */}
        {isPaused && (
          <div className="mx-2 md:mx-4 mb-2 md:mb-4 p-3 md:p-4 bg-warning/10 border border-warning rounded-md" data-testid="banner-agent-paused">
            <div className="flex items-center gap-2 mb-3">
              <AlertCircle className="h-5 w-5 text-warning shrink-0" />
              <div className="flex-1">
                <p className="font-medium text-sm md:text-base">Agent Paused</p>
                <p className="text-xs md:text-sm text-muted-foreground">{pauseMessage}</p>
              </div>
            </div>
            <div className="flex gap-2 flex-wrap">
              <Button 
                onClick={() => setShowCreditPurchase(true)} 
                variant="outline"
                size="sm"
                data-testid="button-purchase-credits"
              >
                Purchase Credits
              </Button>
              {pausedRunId && (
                <Button 
                  onClick={async () => {
                    try {
                      const response = await fetch(`/api/agents/resume/${pausedRunId}`, {
                        method: 'POST',
                        headers: { 
                          'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ additionalCredits: 100 }),
                      });

                      if (!response.ok) {
                        const errorData = await response.json();
                        throw new Error(errorData.error || 'Resume failed');
                      }

                      const result = await response.json();
                      
                      if (result.success) {
                        toast({
                          title: "Agent Resumed",
                          description: result.message,
                        });
                        setIsPaused(false);
                        setPausedRunId(null);
                        // Refresh page to see continued output
                        window.location.reload();
                      }
                    } catch (error: any) {
                      toast({
                        variant: "destructive",
                        title: "Resume Failed",
                        description: error.message || "Failed to resume agent. Please try again.",
                      });
                    }
                  }}
                  size="sm"
                  data-testid="button-resume-agent"
                >
                  Resume Agent
                </Button>
              )}
            </div>
          </div>
        )}

        {/* Input Area - Sticky on mobile */}
        <div className="sticky bottom-0 border-t border-border p-2 md:p-4 bg-background flex-shrink-0">
          <div className="max-w-3xl mx-auto space-y-2 md:space-y-3">
            {/* 🎯 REDESIGNED CONTROLS: Project, Autonomy & Upload Button together */}
            <div className="flex items-center justify-between gap-2 md:gap-4 flex-wrap">
              {/* Left side: Project Selector */}
              <div className="flex items-center gap-1.5 md:gap-3 flex-1 min-w-0">
                <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Target:</span>
                <Select
                  value={selectedProjectId || "platform"}
                  onValueChange={(value) => setSelectedProjectId(value === "platform" ? null : value)}
                  disabled={isStreaming}
                >
                  <SelectTrigger className="h-7 md:h-8 w-auto min-w-[120px] md:min-w-[180px] text-xs" data-testid="select-project">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="platform" data-testid="project-option-platform">
                      <div className="flex items-center gap-2">
                        <Rocket className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        <span className="text-xs">Platform Code</span>
                      </div>
                    </SelectItem>
                    {projects?.map((project) => (
                      <SelectItem key={project.id} value={project.id} data-testid={`project-option-${project.id}`}>
                        <div className="flex items-center gap-2">
                          <FileCode className="h-3 w-3 md:h-3.5 md:w-3.5" />
                          <span className="truncate max-w-[120px] md:max-w-[160px] text-xs">{project.name}</span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Right side: Autonomy Selector + Upload Button */}
              <div className="flex items-center gap-1.5 md:gap-3">
                {/* Autonomy Level Selector */}
                {autonomyData && (
                  <>
                    <span className="text-xs text-muted-foreground font-medium hidden sm:inline">Autonomy:</span>
                    <Select
                      value={autonomyData.currentLevel}
                      onValueChange={(level) => updateAutonomyMutation.mutate(level)}
                      disabled={isStreaming}
                    >
                      <SelectTrigger className="h-7 md:h-8 w-auto min-w-[100px] md:min-w-[140px] text-xs" data-testid="select-autonomy">
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
                                <Icon className="h-3 w-3 md:h-3.5 md:w-3.5" />
                                <span className="text-xs">{level.name}</span>
                                {!isAvailable && <span className="text-xs text-muted-foreground">(Upgrade)</span>}
                              </div>
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </>
                )}

                {/* ✨ UPLOAD BUTTON - Icon only on mobile, text on desktop */}
                <Button
                  variant="outline"
                  size="sm"
                  className="h-7 md:h-8 px-2 md:px-3 gap-1.5"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isStreaming}
                  title="Upload files (images, code, logs)"
                >
                  <Upload className="h-3 w-3 md:h-3.5 md:w-3.5" />
                  <span className="hidden md:inline text-xs">Upload</span>
                </Button>

                {/* ✨ COPY CHAT BUTTON - Next to Upload */}
                {messages.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-7 md:h-8 px-2 md:px-3 gap-1.5"
                    onClick={() => {
                      const chatHistory = messages.map(m => 
                        `${m.role === 'user' ? 'USER' : 'LOMU AI'}:\n${m.content}\n`
                      ).join('\n---\n\n');
                      navigator.clipboard.writeText(chatHistory);
                      setCopiedChatHistory(true);
                      setTimeout(() => setCopiedChatHistory(false), 2000);
                      toast({ title: "✅ Chat history copied!" });
                    }}
                    title="Copy chat history for debugging"
                    data-testid="button-copy-chat-toolbar"
                  >
                    {copiedChatHistory ? (
                      <>
                        <Check className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        <span className="hidden md:inline text-xs">Copied!</span>
                      </>
                    ) : (
                      <>
                        <Copy className="h-3 w-3 md:h-3.5 md:w-3.5" />
                        <span className="hidden md:inline text-xs">Copy Chat</span>
                      </>
                    )}
                  </Button>
                )}
              </div>
            </div>

            {/* Attachments preview - Horizontal scroll on mobile */}
            {attachments.length > 0 && (
              <div className="flex overflow-x-auto gap-1.5 md:gap-2 p-1.5 md:p-2 bg-muted/50 rounded-lg border border-border scrollbar-thin">
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
            <div className="flex gap-1.5 md:gap-2">
              <div className="flex-1">
                <Textarea
                  ref={textareaRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Tell me what needs to be fixed..."
                  className="min-h-[48px] md:min-h-[60px] max-h-[150px] md:max-h-[200px] resize-none text-xs md:text-sm"
                  disabled={isStreaming}
                  data-testid="input-message"
                />
              </div>
              <div className="flex flex-col gap-1.5 md:gap-2">
                {isStreaming ? (
                  <Button
                    onClick={handleStop}
                    variant="destructive"
                    size="icon"
                    className="h-12 w-12 md:h-10 md:w-10"
                    data-testid="button-stop"
                  >
                    <Square className="h-4 w-4" />
                  </Button>
                ) : (
                  <Button
                    onClick={handleSend}
                    disabled={!input.trim()}
                    size="icon"
                    className="h-12 w-12 md:h-10 md:w-10"
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

        {/* Architect Notes & Scratchpad Sidebar */}
        <div className="w-80 border-l hidden lg:block overflow-hidden flex flex-col">
          <div className="p-4 space-y-4 overflow-y-auto flex-1">
            {/* ✅ NEW: Task Pane - Kanban-style task board */}
            {tasks.length > 0 && (
              <Collapsible open={showTaskPane} onOpenChange={setShowTaskPane}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between p-2 h-auto"
                    data-testid="button-toggle-task-pane"
                  >
                    <span className="text-sm font-medium">Tasks ({tasks.length})</span>
                    {showTaskPane ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <TaskPane 
                    tasks={tasks.map(t => ({
                      id: t.id,
                      title: t.title,
                      status: t.status === 'completed' ? 'done' : 
                              t.status === 'in_progress' ? 'in_progress' : 
                              t.status === 'failed' ? 'blocked' : 'backlog',
                      owner: 'agent' as const,
                      verification: t.verification ? {
                        checks: [],
                        summary: '✅ Verified'
                      } : undefined,
                      artifactCount: 0
                    }))}
                  />
                </CollapsibleContent>
              </Collapsible>
            )}

            {/* ✅ NEW: Artifacts Drawer - File changes and URLs */}
            {artifacts.length > 0 && (
              <Collapsible open={showArtifactsDrawer} onOpenChange={setShowArtifactsDrawer}>
                <CollapsibleTrigger asChild>
                  <Button 
                    variant="ghost" 
                    className="w-full justify-between p-2 h-auto"
                    data-testid="button-toggle-artifacts"
                  >
                    <span className="text-sm font-medium">Artifacts ({artifacts.length})</span>
                    {showArtifactsDrawer ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <ArtifactsDrawer artifacts={artifacts} />
                </CollapsibleContent>
              </Collapsible>
            )}

            <ScratchpadDisplay 
              entries={streamState.scratchpadEntries}
              onClear={handleClearScratchpad}
              sessionId={sessionId}
            />
            <ArchitectNotesPanel projectId={activeProjectId} />
          </div>
        </div>
      </div>

      {/* Credit Purchase Modal */}
      {showCreditPurchase && (
        <CreditPurchaseModal 
          isOpen={showCreditPurchase} 
          onClose={() => setShowCreditPurchase(false)}
          pausedRunId={pausedRunId}
          onResumed={() => {
            setIsPaused(false);
            setPausedRunId(null);
            window.location.reload();
          }}
        />
      )}
    </div>
  );
}

// Backwards compatibility export
export { LomuAIChat as MetaSySopChat };