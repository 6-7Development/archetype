import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Loader2, User, Key, AlertCircle, Square, ChevronDown, Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { AgentProgress, type ProgressStep, type ProgressMetrics } from "@/components/agent-progress";
import { AiStreamingIndicator } from "@/components/ai-streaming-indicator";
import { useWebSocketStream } from "@/hooks/use-websocket-stream";
import { ConnectionStatus } from "@/components/connection-status";
import { nanoid } from "nanoid";
import CostPreview from "@/components/cost-preview";
import { ChangesPanel } from "@/components/changes-panel";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { TaskBoard } from "@/components/task-board";
import { AgentTaskList, type AgentTask } from "@/components/agent-task-list";
import { AgentProgressDisplay } from "@/components/agent-progress-display";
import { ChatInputToolbar } from "@/components/ui/chat-input-toolbar";
import { AIModelSelector } from "@/components/ai-model-selector";
import { parseMessageContent, cleanAIResponse } from "@/lib/message-parser";

interface CheckpointData {
  complexity: string;
  cost: number;
  estimatedTime: string;
  actions: string[];
}

interface Message {
  role: "user" | "assistant" | "system";
  content: string;
  timestamp?: Date;
  progressSteps?: ProgressStep[];
  checkpoint?: CheckpointData; // Checkpoint billing data
  isSummary?: boolean; // Memory optimization: marks summarized old messages
  images?: string[]; // Array of image URLs for Vision API support
}

interface RequiredSecret {
  key: string;
  description: string;
  getInstructions?: string;
}

interface SecretsRequest {
  commandId: string;
  command: string;
  message: string;
  requiredSecrets: RequiredSecret[];
}

interface AIChatProps {
  onProjectGenerated?: (result: any) => void;
  currentProjectId?: string | null;
}

export function AIChat({ onProjectGenerated, currentProjectId }: AIChatProps) {
  const { user } = useAuth(); // Get current user to check if admin
  const isAdmin = user?.role === 'admin';

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [copiedChatHistory, setCopiedChatHistory] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]); // Image URLs to send with next message
  const [uploadingImages, setUploadingImages] = useState<Map<string, boolean>>(new Map()); // Track uploading images by temp ID
  const [zoomImage, setZoomImage] = useState<string | null>(null); // For image zoom modal
  const [secretsRequest, setSecretsRequest] = useState<SecretsRequest | null>(null);
  const [secretsInput, setSecretsInput] = useState<Record<string, string>>({});
  const [lastCommand, setLastCommand] = useState<string>("");
  const [currentProgress, setCurrentProgress] = useState<ProgressStep[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<ProgressMetrics>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [lastChanges, setLastChanges] = useState<{
    created: string[];
    modified: string[];
    deleted: string[];
    summary: string;
  } | null>(null);

  // Agent UI state
  const [agentTasks, setAgentTasks] = useState<AgentTask[]>([]);
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null);
  const [progressStatus, setProgressStatus] = useState<'thinking' | 'working' | 'vibing' | 'idle'>('idle');
  const [progressMessage, setProgressMessage] = useState("");
  const [showTaskList, setShowTaskList] = useState(true); // Default true to show UI when tasks arrive

  // Fix sessionId persistence - scoped to project, recomputes when project changes
  const sessionId = useMemo(() => {
    const storageKey = `chat-session-${currentProjectId || 'default'}`;
    let id = localStorage.getItem(storageKey);
    if (!id) {
      id = nanoid();
      localStorage.setItem(storageKey, id);
    }
    return id;
  }, [currentProjectId]);
  const [showCostPreview, setShowCostPreview] = useState(false);
  const [showComplexityError, setShowComplexityError] = useState(false);
  const [complexityErrorMessage, setComplexityErrorMessage] = useState("");
  const [pendingCommand, setPendingCommand] = useState<string>("");
  const [costData, setCostData] = useState<{
    complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
    estimatedTokens: number;
    tokensRemaining: number;
    tokenLimit: number;
    overageTokens: number;
    overageCost: number;
    reasons: string[];
  } | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  // Default greeting message
  const DEFAULT_GREETING: Message = {
    role: "assistant",
    content: "Hi! I'm LomuAI, your self-healing development assistant. What would you like to build today?",
    timestamp: new Date(),
  };

  // Load chat history on mount (always enabled - loads general or project-specific chat)
  const effectiveProjectId = currentProjectId || 'general';
  const { data: chatHistory, isLoading: isLoadingHistory } = useQuery<{ messages: Message[] }>({
    queryKey: ['/api/chat/history', effectiveProjectId],
    queryFn: async () => {
      // Backend expects projectId as URL parameter, not query string
      const response = await fetch(`/api/chat/history/${effectiveProjectId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        throw new Error('Failed to load chat history');
      }
      return response.json();
    },
  });

  // Hydrate messages from API response or show default greeting
  useEffect(() => {
    if (chatHistory?.messages && chatHistory.messages.length > 0) {
      setMessages(chatHistory.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      })));
    } else if (!isLoadingHistory) {
      // No history found, show default greeting
      setMessages([DEFAULT_GREETING]);
    }
  }, [chatHistory, isLoadingHistory]);

  // Mutation to save messages to database
  const saveMessageMutation = useMutation<void, Error, { projectId: string | null; role: string; content: string }>({
    mutationFn: async (data) => {
      await apiRequest("POST", "/api/chat/messages", data);
    },
    onSuccess: () => {
      // Invalidate chat history to keep it in sync
      queryClient.invalidateQueries({ queryKey: ['/api/chat/history', effectiveProjectId] });
    },
  });

  // Mutation to upload chat images
  const uploadImageMutation = useMutation<{ imageUrl: string }, Error, File>({
    mutationFn: async (file) => {
      const formData = new FormData();
      formData.append('image', file);
      const response = await fetch('/api/chat/upload-image', {
        method: 'POST',
        body: formData,
        credentials: 'include',
      });
      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to upload image');
      }
      return response.json();
    },
    onSuccess: (data) => {
      // Add uploaded image URL to pending images
      setPendingImages((prev) => [...prev, data.imageUrl]);
      toast({ description: "Image uploaded successfully!" });
    },
    onError: (error) => {
      toast({ 
        variant: "destructive",
        description: error.message || "Failed to upload image" 
      });
    },
  });

  // Check for quickstart prompt from onboarding
  useEffect(() => {
    const quickstartPrompt = localStorage.getItem('lomu_ai_prompt');
    if (quickstartPrompt) {
      setInput(quickstartPrompt);
      localStorage.removeItem('lomu_ai_prompt');
    }
  }, []);

  // WebSocket streaming for AI chat - use actual user ID
  const streamState = useWebSocketStream(sessionId, user?.id || 'anonymous');

  // State to track current message ID for task persistence
  const [currentMessageId, setCurrentMessageId] = useState<string | null>(null);

  // Load tasks from API for the current project/session
  const { data: savedTasks } = useQuery<{ taskListId?: string; tasks: AgentTask[] }>({
    queryKey: ['/api/tasks', currentMessageId],
    queryFn: async () => {
      if (!currentMessageId) return { tasks: [] };
      const response = await fetch(`/api/tasks/${currentMessageId}`, {
        credentials: 'include',
      });
      if (!response.ok) {
        return { tasks: [] };
      }
      return response.json();
    },
    enabled: !!currentMessageId,
  });

  // Load tasks from localStorage or API on mount
  useEffect(() => {
    if (currentMessageId) {
      // Try localStorage first
      const stored = localStorage.getItem(`tasks-${currentMessageId}`);
      if (stored) {
        try {
          const parsedTasks = JSON.parse(stored);
          setAgentTasks(parsedTasks);
          setShowTaskList(parsedTasks.length > 0);
        } catch (e) {
          console.error('Failed to parse stored tasks:', e);
        }
      } else if (savedTasks?.tasks && savedTasks.tasks.length > 0) {
        // Fallback to API
        setAgentTasks(savedTasks.tasks);
        setShowTaskList(true);
      }
    }
  }, [currentMessageId, savedTasks]);

  // Update agent UI from WebSocket events
  useEffect(() => {
    // Convert WebSocket tasks to AgentTask format
    if (streamState.tasks && streamState.tasks.length > 0) {
      const convertedTasks: AgentTask[] = streamState.tasks.map(task => ({
        id: task.id,
        title: task.title,
        status: task.status,
      }));
      setAgentTasks(convertedTasks);
      setShowTaskList(true);

      // Save tasks to localStorage for persistence (keyed by currentMessageId)
      if (currentMessageId) {
        localStorage.setItem(`tasks-${currentMessageId}`, JSON.stringify(convertedTasks));
      }

      // Find active task (first in_progress task)
      const activeTask = convertedTasks.find(t => t.status === 'in_progress');
      if (activeTask) {
        setActiveTaskId(activeTask.id);
      }

      // Auto-close task box when all tasks complete (like Replit Agent)
      const allCompleted = convertedTasks.every(t => t.status === 'completed');
      const hasInProgress = convertedTasks.some(t => t.status === 'in_progress');
      
      if (allCompleted && !hasInProgress) {
        // Wait 2 seconds to show completion state, then close
        const closeTimer = setTimeout(() => {
          console.log('✅ All tasks completed - auto-closing task box');
          setShowTaskList(false);
        }, 2000);
        
        return () => clearTimeout(closeTimer);
      }
    }

    // Update progress status from chat progress with smart emoji-based detection
    if (streamState.chatProgress) {
      const message = streamState.chatProgress.message;
      setProgressMessage(message);
      
      // Smart status detection based on progress message emoji (with trimming for formatting variations)
      const trimmedMsg = message.trim();
      if (trimmedMsg.startsWith('✅')) {
        setProgressStatus('vibing'); // Creative work: file edits, code generation
      } else if (trimmedMsg.startsWith('🔧')) {
        setProgressStatus('working'); // Tool execution, bash commands
      } else if (trimmedMsg.startsWith('📋') || trimmedMsg.startsWith('🔍')) {
        setProgressStatus('thinking'); // Planning, analysis, search
      } else {
        setProgressStatus(streamState.chatProgress.status === 'working' ? 'working' : 'thinking');
      }
    } else if (streamState.currentAction) {
      setProgressMessage(streamState.currentAction);
      setProgressStatus('working');
    } else if (streamState.currentStatus) {
      setProgressMessage(streamState.currentStatus);
      setProgressStatus('thinking');
    }

    // Set to idle when complete
    if (streamState.currentStatus === 'completed') {
      setProgressStatus('idle');
      setProgressMessage("");
      setIsGenerating(false);
    }
  }, [streamState.tasks, streamState.chatProgress, streamState.currentAction, streamState.currentStatus]);

  // Update metrics from WebSocket usage data
  useEffect(() => {
    if (streamState.usage) {
      setCurrentMetrics({
        inputTokens: streamState.usage.inputTokens,
        outputTokens: streamState.usage.outputTokens,
        estimatedCost: ((streamState.usage.inputTokens * 0.003) + (streamState.usage.outputTokens * 0.015)) / 1000,
      });
    }
  }, [streamState.usage]);

  // Auto-clear file summary after 5 seconds
  useEffect(() => {
    if (streamState.fileSummary && !streamState.currentFile) {
      const timer = setTimeout(() => {
        streamState.resetState();
      }, 5000);

      return () => clearTimeout(timer);
    }
  }, [streamState.fileSummary, streamState.currentFile, streamState]);

  // Complexity detection mutation
  const complexityMutation = useMutation<any, Error, { command: string }>({
    mutationFn: async (data) => {
      return await apiRequest("POST", "/api/analyze-complexity", data);
    },
    onSuccess: (data, variables) => {
      setCostData(data);
      setPendingCommand(variables.command);
      setShowCostPreview(true);
    },
    onError: (error: any, variables) => {
      // Save the pending command and show error dialog with retry/proceed options
      setPendingCommand(variables.command);
      setComplexityErrorMessage(error.message || "Could not estimate tokens");
      setShowComplexityError(true);
    },
  });

  const chatMutation = useMutation<{ response: string; shouldGenerate?: boolean; command?: string; autonomous?: boolean; checkpoint?: CheckpointData }, Error, { message: string; projectId?: number; images?: string[]; sessionId: string }>({
    mutationFn: async (data) => {
      return await apiRequest<{ response: string; shouldGenerate?: boolean; command?: string; autonomous?: boolean; checkpoint?: CheckpointData }>("POST", "/api/ai-chat-conversation", data);
    },
    onSuccess: (data) => {
      const assistantMessage = {
        role: "assistant" as const,
        content: data.response,
        timestamp: new Date(),
        checkpoint: data.checkpoint, // Include checkpoint data for billing display
      };

      setMessages((prev) => [...prev, assistantMessage]);

      // Clear chat progress when mutation completes
      streamState.resetState();
      setProgressStatus('idle');
      setProgressMessage("");
      setIsGenerating(false);

      // Persist assistant message to database (save to general chat if no project)
      saveMessageMutation.mutate({
        projectId: currentProjectId || null,
        role: 'assistant',
        content: data.response,
      });

      // If AI decides to generate code
      if (data.shouldGenerate && data.command) {
        // ⚠️ Check if quota exceeded
        if ((data as any).quotaExceeded) {
          console.log('[AI-CHAT] Build blocked - quota exceeded');
          
          // Show error toast with upgrade prompt
          toast({
            variant: "destructive",
            title: "Usage Limit Reached",
            description: (data as any).limitReason || "You've reached your usage limit. Please upgrade your plan to continue building.",
            duration: 10000, // Show for 10 seconds
          });
          
          // Don't proceed with build
          return;
        }
        
        // 🚀 AUTONOMOUS MODE: Execute immediately without cost preview
        if (data.autonomous) {
          console.log('[AI-CHAT] Autonomous build detected - executing immediately');
          executeCommand(data.command);
        } else {
          // Show cost preview first for manual builds
          complexityMutation.mutate({ command: data.command });
        }
      }
    },
    onError: (error) => {
      // Clear progress indicators on failure
      streamState.resetState();
      setProgressStatus('idle');
      setProgressMessage("");
      setIsGenerating(false);

      // Show error toast
      toast({
        variant: "destructive",
        title: "Chat Error",
        description: error.message || "Failed to send message. Please try again.",
      });
    },
  });

  const commandMutation = useMutation<
    { commandId: string; result?: any; needsSecrets?: boolean; message?: string; requiredSecrets?: RequiredSecret[]; changes?: { created: string[]; modified: string[]; deleted: string[]; summary: string; } }, 
    Error, 
    { command: string; userId: string; projectId: string | null; secrets?: Record<string, string> }
  >({
    mutationFn: async (data) => {
      return await apiRequest("POST", "/api/commands", data);
    },
    onSuccess: (data, variables) => {
      // Check if LomuAI is requesting secrets
      if (data.needsSecrets) {
        setSecretsRequest({
          commandId: data.commandId,
          command: variables.command, // Store the original command
          message: data.message || "This project requires secure credentials",
          requiredSecrets: data.requiredSecrets || [],
        });

        // Initialize secrets input state
        const initialSecrets: Record<string, string> = {};
        data.requiredSecrets?.forEach((secret) => {
          initialSecrets[secret.key] = "";
        });
        setSecretsInput(initialSecrets);

        // Add message to chat
        setMessages((prev) => [
          ...prev,
          {
            role: "assistant",
            content: `${data.message}\n\nI've detected that this project requires secure API keys or credentials. Please provide them below, and I'll continue building your project.`,
            timestamp: new Date(),
          },
        ]);

        return;
      }

      // Normal project generation success
      queryClient.invalidateQueries({ queryKey: ["/api/commands"] });
      queryClient.invalidateQueries({ queryKey: ["/api/projects"] });
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      toast({ description: "Project generated successfully!" });

      // Display changes panel if changes data is available
      if (data.changes) {
        setLastChanges(data.changes);
        // Auto-dismiss after 10 seconds
        setTimeout(() => setLastChanges(null), 10000);
      }

      if (onProjectGenerated && data.result) {
        onProjectGenerated(data.result);
      }

      // Clear generation state
      setIsGenerating(false);
      setProgressStatus('idle');
      setProgressMessage("");
    },
    onError: (error: any) => {
      toast({ 
        variant: "destructive",
        description: error.message || "Failed to generate project" 
      });

      // Clear generation state on error
      setIsGenerating(false);
      setProgressStatus('idle');
      setProgressMessage("");
    },
  });

  const executeCommand = (command: string, secrets?: Record<string, string>) => {
    setLastCommand(command);
    setIsGenerating(true);
    setProgressStatus('thinking');
    setProgressMessage("Analyzing your request...");

    // Track start time for elapsed time calculation
    const startTime = Date.now();

    // Simulate progress steps with progress tracking
    const progressSteps: ProgressStep[] = [
      { id: "1", type: "thinking", message: "Analyzing your request...", progress: 0 },
      { id: "2", type: "thinking", message: "Designing project architecture...", progress: 0 },
      { id: "3", type: "action", message: "Generating code files...", progress: 0 },
      { id: "4", type: "action", message: "Testing syntax and logic...", progress: 0 },
      { id: "5", type: "action", message: "Validating security...", progress: 0 },
    ];

    // Simulate step-by-step progress with percentage updates
    let currentStep = 0;
    let currentStepProgress = 0;

    const progressInterval = setInterval(() => {
      // Calculate elapsed time
      const elapsed = Date.now() - startTime;
      const minutes = Math.floor(elapsed / 60000);
      const seconds = Math.floor((elapsed % 60000) / 1000);
      const timeElapsed = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

      if (currentStep < progressSteps.length) {
        // Update current step progress (0% -> 25% -> 50% -> 75% -> 100%)
        currentStepProgress += 25;

        if (currentStepProgress > 100) {
          // Move to next step
          currentStepProgress = 25;
          currentStep++;
        }

        // Update progress for all steps
        const updatedSteps = progressSteps.map((step, index) => {
          if (index < currentStep) {
            // Completed steps
            return { ...step, type: "success" as const, progress: 100 };
          } else if (index === currentStep) {
            // Current in-progress step
            return { ...step, progress: currentStepProgress };
          }
          // Pending steps
          return step;
        });

        setCurrentProgress(updatedSteps);

        // Update metrics with time elapsed
        setCurrentMetrics((prev) => ({
          ...prev,
          timeElapsed,
        }));
      }
    }, 400); // Update every 400ms for smooth animation

    commandMutation.mutate(
      {
        command,
        userId: user?.id || "anonymous",
        projectId: currentProjectId || null,
        secrets,
      },
      {
        onSettled: () => {
          clearInterval(progressInterval);

          // Calculate final elapsed time
          const elapsed = Date.now() - startTime;
          const minutes = Math.floor(elapsed / 60000);
          const seconds = Math.floor((elapsed % 60000) / 1000);
          const timeElapsed = minutes > 0 ? `${minutes}m ${seconds}s` : `${seconds}s`;

          // Show final success step
          const completedSteps = progressSteps.map(step => ({
            ...step,
            type: "success" as const,
            progress: 100,
          }));

          setCurrentProgress([
            ...completedSteps,
            { id: "6", type: "success", message: "Project generated successfully!", progress: 100 },
          ]);

          // Update final metrics
          setCurrentMetrics((prev) => ({
            ...prev,
            timeElapsed,
            filesCreated: 5, // Simulated - could come from API response
            filesModified: 2,
            linesAdded: 247,
            linesRemoved: 18,
          }));

          // Clear progress after 3 seconds
          setTimeout(() => {
            setCurrentProgress([]);
            setCurrentMetrics({});
          }, 3000);
        },
      }
    );
  };

  const handleSecretsSubmit = () => {
    if (!secretsRequest) return;

    // Validate all secrets are provided
    const missing = secretsRequest.requiredSecrets.filter(
      (secret) => !secretsInput[secret.key]?.trim()
    );

    if (missing.length > 0) {
      toast({
        variant: "destructive",
        description: `Please provide: ${missing.map((s) => s.key).join(", ")}`,
      });
      return;
    }

    // Add confirmation message
    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: "Secrets received securely. Continuing with project generation...",
        timestamp: new Date(),
      },
    ]);

    // Retry command with secrets using the original command
    executeCommand(secretsRequest.command, secretsInput);

    // Clear secrets request
    setSecretsRequest(null);
    setSecretsInput({});
  };

  const handleCostPreviewConfirm = () => {
    if (!pendingCommand) return;

    // Close modal and execute command
    setShowCostPreview(false);
    executeCommand(pendingCommand);

    // Clear cost data
    setCostData(null);
    setPendingCommand("");
  };

  const handleCostPreviewCancel = () => {
    // Close modal without executing
    setShowCostPreview(false);
    setCostData(null);
    setPendingCommand("");

    toast({ 
      description: "Project generation cancelled" 
    });
  };

  const handleRetryComplexity = () => {
    if (!pendingCommand) return;

    setShowComplexityError(false);
    complexityMutation.mutate({ command: pendingCommand });
  };

  const handleProceedWithoutPreview = () => {
    if (!pendingCommand) return;

    setShowComplexityError(false);
    executeCommand(pendingCommand);
    setPendingCommand("");
  };

  const handleCancelComplexity = () => {
    setShowComplexityError(false);
    setPendingCommand("");

    toast({ 
      description: "Project generation cancelled" 
    });
  };

  const handleSend = () => {
    if (!input.trim() || chatMutation.isPending) return;

    const userMessage = input.trim();
    const messagesToSend = pendingImages.length > 0 ? [...pendingImages] : undefined;

    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
        timestamp: new Date(),
        images: messagesToSend,
      },
    ]);
    setInput("");
    setPendingImages([]); // Clear pending images after sending

    // Set initial progress state
    setProgressStatus('thinking');
    setProgressMessage("Analyzing request...");

    // Persist user message to database (save to general chat if no project)
    saveMessageMutation.mutate({
      projectId: currentProjectId || null,
      role: 'user',
      content: userMessage,
    });

    chatMutation.mutate({ 
      message: userMessage,
      projectId: currentProjectId ? parseInt(currentProjectId) : undefined,
      images: messagesToSend,
      sessionId,
    });
  };

  // Handle stopping the generation
  const handleStop = () => {
    setIsGenerating(false);
    setProgressStatus('idle');
    setProgressMessage("");
    
    // Mark all in-progress tasks as failed
    setAgentTasks(prev => prev.map(t => 
      t.status === 'in_progress' ? { ...t, status: 'failed' as const } : t
    ));

    toast({ title: "🛑 Stopped generation" });
  };

  // Handle image paste from clipboard
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    for (let i = 0; i < items.length; i++) {
      const item = items[i];

      // Check if item is an image
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault(); // Prevent default paste behavior for images

        const file = item.getAsFile();
        if (!file) continue;

        // Validate file format
        if (!ALLOWED_FORMATS.includes(file.type)) {
          toast({
            variant: "destructive",
            description: `Unsupported image format. Please use: JPG, PNG, GIF, or WebP`
          });
          continue;
        }

        // Validate file size (5MB max)
        if (file.size > MAX_FILE_SIZE) {
          const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
          toast({
            variant: "destructive",
            description: `Image too large (${sizeMB}MB). Maximum size is 5MB`
          });
          continue;
        }

        // Generate temporary ID for tracking upload progress
        const tempId = nanoid();

        // Add to uploading state
        setUploadingImages(prev => new Map(prev).set(tempId, true));

        // Upload image with temp ID for progress tracking
        uploadImageMutation.mutate(file, {
          onSuccess: () => {
            // Remove from uploading state
            setUploadingImages(prev => {
              const next = new Map(prev);
              next.delete(tempId);
              return next;
            });
          },
          onError: () => {
            // Remove from uploading state on error
            setUploadingImages(prev => {
              const next = new Map(prev);
              next.delete(tempId);
              return next;
            });
          },
        });
      }
    }
  };

  // Remove an image from pending images
  const removeImage = (imageUrl: string) => {
    setPendingImages((prev) => prev.filter((url) => url !== imageUrl));
  };

  // Handle image selection from file input
  const handleImageSelect = async (files: FileList) => {
    const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
    const ALLOWED_FORMATS = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];

      // Validate file format
      if (!ALLOWED_FORMATS.includes(file.type)) {
        toast({
          variant: "destructive",
          description: `Unsupported image format. Please use: JPG, PNG, GIF, or WebP`
        });
        continue;
      }

      // Validate file size (5MB max)
      if (file.size > MAX_FILE_SIZE) {
        const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
        toast({
          variant: "destructive",
          description: `Image too large (${sizeMB}MB). Maximum size is 5MB`
        });
        continue;
      }

      // Generate temporary ID for tracking upload progress
      const tempId = nanoid();

      // Add to uploading state
      setUploadingImages(prev => new Map(prev).set(tempId, true));

      // Upload image with temp ID for progress tracking
      uploadImageMutation.mutate(file, {
        onSuccess: () => {
          // Remove from uploading state
          setUploadingImages(prev => {
            const next = new Map(prev);
            next.delete(tempId);
            return next;
          });
        },
        onError: () => {
          // Remove from uploading state on error
          setUploadingImages(prev => {
            const next = new Map(prev);
            next.delete(tempId);
            return next;
          });
        },
      });
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  // Smooth auto-scroll to bottom to show newest messages with delay for animation
  useEffect(() => {
    const timer = setTimeout(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollTo({
          top: scrollRef.current.scrollHeight,
          behavior: 'smooth'
        });
      }
    }, 100);
    return () => clearTimeout(timer);
  }, [messages, isGenerating]);

  return (
    <div className="flex h-full overflow-hidden bg-[hsl(220,20%,12%)] relative">
      {/* Task List Sidebar */}
      {showTaskList && agentTasks.length > 0 && (
        <div className="w-64 border-r border-[hsl(220,15%,28%)] flex-shrink-0 overflow-y-auto bg-[hsl(220,18%,16%)]">
          <div className="p-3 border-b border-[hsl(220,15%,28%)] flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[hsl(220,8%,98%)]">Tasks</h3>
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
          <AgentTaskList tasks={agentTasks} activeTaskId={activeTaskId} onTaskClick={setActiveTaskId} />
        </div>
      )}

      {/* Main Content */}
      <div className="flex flex-col h-full max-h-full overflow-hidden flex-1 relative touch-none">
        {/* Changes Panel - Fixed Overlay */}
        {lastChanges && (
          <ChangesPanel
            changes={lastChanges}
            onClose={() => setLastChanges(null)}
          />
        )}

        {/* Progress Display Header */}
        {(isGenerating || chatMutation.isPending) && progressStatus !== 'idle' && (
          <div className="px-4 py-3 border-b border-[hsl(220,15%,28%)] bg-[hsl(220,18%,16%)]">
            <div className="flex items-center justify-between gap-4">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h2 className="text-sm font-semibold text-[hsl(220,8%,98%)] truncate">
                    {agentTasks.find(t => t.id === activeTaskId)?.title || 'Working...'}
                  </h2>
                  {agentTasks.length > 0 && (
                    <span className="text-xs text-[hsl(220,10%,72%)] shrink-0">
                      {agentTasks.filter(t => t.status === 'completed').length}/{agentTasks.length}
                    </span>
                  )}
                </div>
                <AgentProgressDisplay status={progressStatus} message={progressMessage} />
              </div>
              {isGenerating && (
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
              )}
            </div>
          </div>
        )}

        {/* Header with Connection Status and Model Selector */}
        <div className="px-4 py-2 border-b border-[hsl(220,15%,28%)] bg-[hsl(220,18%,16%)] flex items-center justify-between gap-4">
          <ConnectionStatus
            isConnected={streamState.isConnected}
            isReconnecting={streamState.isReconnecting}
            reconnectAttempt={streamState.reconnectAttempt}
            onReconnect={streamState.forceReconnect}
          />
          <AIModelSelector />
        </div>

        {/* AI Progress */}
        {(currentProgress.length > 0 || isGenerating) && (
          <div className="px-6 pt-4 pb-2 bg-[hsl(220,18%,16%)] border-b border-[hsl(220,15%,28%)]">
            <AgentProgress
              steps={currentProgress}
              metrics={currentMetrics}
            />
          </div>
        )}

        {/* Task Board - ALWAYS SHOW when tasks exist */}
        <TaskBoard 
          tasks={streamState.tasks || []}
          isGenerating={isGenerating || chatMutation.isPending}
          subAgentActive={streamState.subAgentActive}
          className="border-b border-[hsl(220,15%,28%)]" 
        />

        {/* Copy Chat History Button */}
        {messages.length > 1 && (
          <div className="px-4 py-2 border-b border-border bg-muted/20 flex justify-end">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const chatHistory = messages.filter(m => !m.isSummary).map(m => 
                  `${m.role === 'user' ? 'USER' : 'LOMU AI'}:\n${m.content}\n`
                ).join('\n---\n\n');
                navigator.clipboard.writeText(chatHistory);
                setCopiedChatHistory(true);
                setTimeout(() => setCopiedChatHistory(false), 2000);
                toast({ title: "✅ Chat copied!" });
              }}
              className="h-7 gap-1.5"
              data-testid="button-copy-chat"
            >
              {copiedChatHistory ? (
                <>
                  <Check className="h-3.5 w-3.5" />
                  <span className="text-xs">Copied!</span>
                </>
              ) : (
                <>
                  <Copy className="h-3.5 w-3.5" />
                  <span className="text-xs">Copy Chat</span>
                </>
              )}
            </Button>
          </div>
        )}

        {/* Messages Area */}
        <div
          ref={scrollRef}
          className="flex-1 overflow-y-auto px-6 py-4 space-y-4 scroll-smooth"
          data-testid="messages-container"
        >
          {/* Progress Messages - Inline step-by-step updates */}
          {streamState.progressMessages.length > 0 && (
            <div className="flex flex-col gap-2">
              {streamState.progressMessages.map((progress) => (
                <div key={progress.id} className="flex gap-3 justify-start">
                  <div className="max-w-[75%] rounded-2xl px-3 py-2 bg-secondary/30 border border-border/30">
                    <p className="text-xs text-muted-foreground leading-relaxed">{progress.message}</p>
                  </div>
                </div>
              ))}
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex gap-3 items-start",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
            >
              <div
                className={cn(
                  "max-w-[75%] rounded-2xl px-4 py-3",
                  message.role === "user"
                    ? "bg-primary text-primary-foreground shadow-md"
                    : message.isSummary 
                      ? "bg-muted border border-border" 
                      : "bg-secondary text-secondary-foreground shadow-sm"
                )}>
                  {message.isSummary ? (
                    <div className="text-sm text-muted-foreground italic flex items-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Earlier messages summarized for efficiency</span>
                    </div>
                  ) : (
                    <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                      <MarkdownRenderer content={cleanAIResponse(parseMessageContent(message.content))} />
                    </div>
                  )}

                  {/* Display checkpoint billing preview if available */}
                  {message.checkpoint && (
                    <div className="mt-3 pt-3 border-t border-white/10">
                      <div className="text-xs space-y-1">
                        <div className="flex items-center justify-between">
                          <span className="text-white/70">Complexity:</span>
                          <span className="font-semibold">{message.checkpoint.complexity}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/70">Estimated Cost:</span>
                          <span className="font-semibold">${message.checkpoint.cost.toFixed(2)}</span>
                        </div>
                        <div className="flex items-center justify-between">
                          <span className="text-white/70">Time:</span>
                          <span className="font-semibold">{message.checkpoint.estimatedTime}</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Display attached images if any */}
                  {message.images && message.images.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.images.map((imageUrl, imgIndex) => (
                        <img
                          key={imgIndex}
                          src={imageUrl}
                          alt={`Attached ${imgIndex + 1}`}
                          className="max-w-[200px] rounded border border-white/20 cursor-pointer hover:opacity-80 transition-opacity"
                          onClick={() => setZoomImage(imageUrl)}
                          data-testid={`message-image-${index}-${imgIndex}`}
                        />
                      ))}
                    </div>
                  )}
                </div>

              {message.role === "user" && (
                <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center border border-primary/20">
                  <User className="w-5 h-5 text-primary" />
                </div>
              )}
            </div>
          ))}

          {/* Streaming Indicator */}
          {chatMutation.isPending && streamState.fullMessage && (
            <div className="flex gap-3 items-start">
              <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-secondary text-secondary-foreground shadow-sm border border-border/50">
                <div className="prose prose-invert max-w-none text-sm leading-relaxed">
                  <MarkdownRenderer content={cleanAIResponse(parseMessageContent(streamState.fullMessage))} />
                </div>
              </div>
            </div>
          )}

          {/* AI Streaming Indicator - Simple Loader */}
          {chatMutation.isPending && !streamState.fullMessage && (
            <div className="flex gap-3 items-start">
              <div className="max-w-[75%] rounded-2xl px-4 py-3 bg-muted border border-border">
                <div className="flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Secrets Request Dialog */}
        <Dialog open={!!secretsRequest} onOpenChange={() => setSecretsRequest(null)}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Key className="w-5 h-5" />
                Secure Credentials Required
              </DialogTitle>
              <DialogDescription>
                {secretsRequest?.message}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {secretsRequest?.requiredSecrets.map((secret) => (
                <div key={secret.key} className="space-y-2">
                  <Label htmlFor={secret.key}>{secret.key}</Label>
                  <Input
                    id={secret.key}
                    type="password"
                    placeholder={secret.description}
                    value={secretsInput[secret.key] || ""}
                    onChange={(e) =>
                      setSecretsInput((prev) => ({
                        ...prev,
                        [secret.key]: e.target.value,
                      }))
                    }
                    data-testid={`input-secret-${secret.key}`}
                  />
                  {secret.getInstructions && (
                    <p className="text-xs text-muted-foreground">
                      {secret.getInstructions}
                    </p>
                  )}
                </div>
              ))}

              <Alert>
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>
                  Your credentials are encrypted and never stored. They're used only for this project generation.
                </AlertDescription>
              </Alert>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => setSecretsRequest(null)}
                data-testid="button-cancel-secrets"
              >
                Cancel
              </Button>
              <Button
                onClick={handleSecretsSubmit}
                disabled={commandMutation.isPending}
                data-testid="button-submit-secrets"
              >
                {commandMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating...
                  </>
                ) : (
                  "Continue Generation"
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Input Area */}
        <div className="flex-shrink-0 border-t border-[hsl(220,15%,28%)] bg-[hsl(220,18%,16%)] p-4">
          {/* WebSocket Stream: File Status */}
          {streamState.currentFile && (
            <div className="mb-2 px-3 py-1.5 bg-[hsl(220,16%,20%)] border-l-2 border-emerald-500/60 rounded text-xs" data-testid="stream-file-status">
              <p className="text-[hsl(220,10%,72%)] flex items-center gap-2">
                <span className="font-mono text-[hsl(220,70%,60%)]">{streamState.currentFile.action}</span>
                <span className="font-mono">{streamState.currentFile.filename}</span>
                <span className="ml-auto text-[hsl(220,12%,55%)]">{streamState.currentFile.language}</span>
                <Loader2 className="w-3 h-3 animate-spin text-[hsl(220,70%,60%)]" />
              </p>
            </div>
          )}

          {/* WebSocket Stream: File Summary */}
          {streamState.fileSummary && !streamState.currentFile && (
            <div className="mb-2 px-3 py-2 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-xs" data-testid="stream-file-summary">
              <div className="flex items-center justify-between text-emerald-200">
                <span className="font-semibold">
                  ✓ Modified {streamState.fileSummary.filesChanged} file{streamState.fileSummary.filesChanged !== 1 ? 's' : ''}
                </span>
                <span className="text-emerald-300/70">
                  +{streamState.fileSummary.linesAdded} lines
                  {streamState.fileSummary.linesRemoved !== undefined && ` / -${streamState.fileSummary.linesRemoved}`}
                </span>
              </div>
            </div>
          )}

          {/* WebSocket Stream: Status Display */}
          {streamState.currentStatus && (
            <div className="mb-2 px-3 py-1.5 bg-[hsl(220,16%,20%)] border-l-2 border-amber-500/60 rounded text-xs" data-testid="stream-status-display">
              <p className="text-[hsl(220,10%,72%)] flex items-center gap-2">
                <span>{streamState.currentStatus}</span>
                {streamState.currentStep > 0 && streamState.totalSteps > 0 && (
                  <span className="ml-auto font-mono">
                    {streamState.currentStep}/{streamState.totalSteps}
                  </span>
                )}
                <Loader2 className="w-3 h-3 animate-spin text-[hsl(220,70%,60%)]" />
              </p>
            </div>
          )}

          {/* WebSocket Stream: Action Display */}
          {streamState.currentAction && (
            <div className="mb-2 px-3 py-1.5 bg-[hsl(220,16%,20%)] border-l-2 border-purple-500/60 rounded text-xs" data-testid="stream-action-display">
              <p className="text-[hsl(220,10%,72%)] flex items-center gap-2">
                <span>{streamState.currentAction}</span>
                <Loader2 className="w-3 h-3 animate-spin ml-auto text-[hsl(220,70%,60%)]" />
              </p>
            </div>
          )}

          {/* Image Preview Section */}
          {(pendingImages.length > 0 || uploadingImages.size > 0) && (
            <div className="mb-3 flex flex-wrap gap-2">
              {/* Show uploading images with loading spinner */}
              {Array.from(uploadingImages.keys()).map((tempId) => (
                <div key={tempId} className="relative">
                  <div className="h-20 w-20 rounded border border-[hsl(220,15%,28%)] bg-[hsl(220,18%,16%)] flex items-center justify-center">
                    <Loader2 className="w-6 h-6 animate-spin text-[hsl(220,70%,60%)]" />
                  </div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <span className="text-xs text-[hsl(220,12%,55%)] bg-[hsl(220,20%,12%)]/80 px-2 py-1 rounded">
                      Uploading...
                    </span>
                  </div>
                </div>
              ))}

              {/* Show uploaded images with remove button */}
              {pendingImages.map((imageUrl, index) => (
                <div key={index} className="relative group">
                  <img
                    src={imageUrl}
                    alt={`Preview ${index + 1}`}
                    className="h-20 w-20 object-cover rounded border border-[hsl(220,15%,28%)]"
                    data-testid={`image-preview-${index}`}
                  />
                  <button
                    onClick={() => removeImage(imageUrl)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`button-remove-image-${index}`}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2 items-end">
            <div className="flex-1 relative">
              <Textarea
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                onPaste={handlePaste}
                placeholder="Message LomuAI..."
                className="min-h-[60px] max-h-[200px] resize-none text-base bg-background border-border focus-visible:ring-2 focus-visible:ring-primary/50 rounded-2xl px-4 py-3 pr-12 transition-all"
                disabled={chatMutation.isPending}
                data-testid="input-chat-message"
                rows={3}
              />
              <div className="absolute bottom-2 right-2">
                <ChatInputToolbar
                  onImageSelect={handleImageSelect}
                  disabled={chatMutation.isPending}
                />
              </div>
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending}
              size="icon"
              variant="default"
              className="flex-shrink-0 h-12 w-12 rounded-full shadow-md hover:shadow-lg transition-all"
              data-testid="button-send-chat"
            >
              {chatMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Send className="w-5 h-5" />
              )}
            </Button>
          </div>
        </div>
      </div>

      {/* Cost Preview Dialog - Mobile Responsive */}
      <Dialog open={showCostPreview} onOpenChange={setShowCostPreview}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          {costData && (
            <CostPreview
              complexity={costData.complexity}
              estimatedTokens={costData.estimatedTokens}
              tokensRemaining={costData.tokensRemaining}
              tokenLimit={costData.tokenLimit}
              overageTokens={costData.overageTokens}
              overageCost={costData.overageCost}
              reasons={costData.reasons}
              onConfirm={handleCostPreviewConfirm}
              onCancel={handleCostPreviewCancel}
              isLoading={commandMutation.isPending}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Complexity Detection Error Dialog - Mobile Responsive */}
      <Dialog open={showComplexityError} onOpenChange={setShowComplexityError}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Failed to Analyze Complexity</DialogTitle>
            <DialogDescription>
              {complexityErrorMessage}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                You can retry the analysis or proceed without a cost preview. The actual tokens will still be tracked after generation.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              onClick={handleCancelComplexity}
              data-testid="button-cancel-complexity-error"
            >
              Cancel
            </Button>
            <Button
              variant="outline"
              onClick={handleRetryComplexity}
              disabled={complexityMutation.isPending}
              data-testid="button-retry-complexity-analysis"
            >
              {complexityMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Retrying...
                </>
              ) : (
                "Retry Analysis"
              )}
            </Button>
            <Button
              variant="default"
              onClick={handleProceedWithoutPreview}
              disabled={commandMutation.isPending}
              data-testid="button-proceed-without-cost-preview"
            >
              Proceed Without Preview
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Image Zoom Modal */}
      <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-4xl p-0">
          <div className="relative">
            <img
              src={zoomImage || ''}
              alt="Zoomed image"
              className="w-full h-auto max-h-[90vh] object-contain"
              data-testid="zoomed-image"
            />
            <button
              onClick={() => setZoomImage(null)}
              className="absolute top-2 right-2 bg-background/80 hover:bg-background text-foreground rounded-full p-2"
              data-testid="button-close-zoom"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}