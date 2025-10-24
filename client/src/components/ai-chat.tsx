import { useState, useRef, useEffect, useMemo } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Loader2, Sparkles, User, Key, AlertCircle } from "lucide-react";
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
    content: "Hey! I'm SySop. What are we building?",
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
    const quickstartPrompt = localStorage.getItem('archetype_ai_prompt');
    if (quickstartPrompt) {
      setInput(quickstartPrompt);
      localStorage.removeItem('archetype_ai_prompt');
    }
  }, []);

  // WebSocket streaming for AI chat - use actual user ID
  const streamState = useWebSocketStream(sessionId, user?.id || 'anonymous');
  
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

  const chatMutation = useMutation<{ response: string; shouldGenerate?: boolean; command?: string; checkpoint?: CheckpointData }, Error, { message: string; projectId?: number; images?: string[]; sessionId: string }>({
    mutationFn: async (data) => {
      return await apiRequest<{ response: string; shouldGenerate?: boolean; command?: string; checkpoint?: CheckpointData }>("POST", "/api/ai-chat-conversation", data);
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
      
      // Persist assistant message to database (save to general chat if no project)
      saveMessageMutation.mutate({
        projectId: currentProjectId || null,
        role: 'assistant',
        content: data.response,
      });
      
      // If AI decides to generate code, show cost preview first
      if (data.shouldGenerate && data.command) {
        // Analyze complexity before executing
        complexityMutation.mutate({ command: data.command });
      }
    },
    onError: (error) => {
      // Clear progress indicators on failure
      streamState.resetState();
      
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
      // Check if SySop is requesting secrets
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
    },
    onError: (error: any) => {
      toast({ 
        variant: "destructive",
        description: error.message || "Failed to generate project" 
      });
    },
  });

  const executeCommand = (command: string, secrets?: Record<string, string>) => {
    setLastCommand(command);
    setIsGenerating(true);
    
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
          setIsGenerating(false);
          
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

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = 0; // Scroll to top to show newest messages
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full max-h-full overflow-hidden bg-[hsl(220,20%,12%)] relative">
      {/* Changes Panel - Fixed Overlay */}
      {lastChanges && (
        <div className="absolute top-4 right-4 z-50 w-full max-w-md" data-testid="changes-panel-overlay">
          <ChangesPanel 
            changes={lastChanges} 
            onClose={() => setLastChanges(null)} 
          />
        </div>
      )}
      
      {/* Messages - Clean Scrollable Area */}
      <div 
        ref={scrollRef} 
        className="flex-1 min-h-0 overflow-y-auto px-4 sm:px-6 py-4 sm:py-8 scroll-smooth bg-[hsl(220,20%,12%)]"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="space-y-4 max-w-4xl mx-auto pb-4">
          {messages.slice().reverse().map((message, idx) => (
            <div
              key={idx}
              className={cn(
                "flex gap-3 items-start",
                message.role === "user" ? "justify-end" : "justify-start"
              )}
              data-testid={`chat-message-${idx}`}
            >
              {/* Avatar - Assistant Side */}
              {message.role === "assistant" && (
                <div className="flex-shrink-0">
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    message.isSummary 
                      ? "bg-[hsl(220,18%,16%)] border border-[hsl(220,15%,28%)]" 
                      : "bg-[hsl(220,70%,60%)]"
                  )}>
                    {message.isSummary ? (
                      <AlertCircle className="w-4 h-4 text-[hsl(220,12%,55%)]" />
                    ) : (
                      <Sparkles className="w-4 h-4 text-[hsl(220,8%,98%)]" />
                    )}
                  </div>
                </div>
              )}

              {/* Message Bubble */}
              <div className={cn(
                "flex flex-col gap-1",
                message.role === "user" ? "items-end max-w-[85%]" : "max-w-[85%]"
              )}>
                {/* Timestamp */}
                {message.timestamp && (
                  <div className="text-[11px] text-[hsl(220,12%,55%)]/60 px-2">
                    {new Date(message.timestamp).toLocaleTimeString()}
                  </div>
                )}
                
                {/* Message Content Bubble */}
                <div
                  className={cn(
                    "px-3 py-2 text-sm prose dark:prose-invert max-w-none",
                    message.role === "user"
                      ? "bg-[hsl(220,70%,60%)] text-[hsl(220,8%,98%)] rounded-2xl rounded-tr-sm"
                      : message.isSummary
                      ? "bg-[hsl(220,18%,16%)] text-[hsl(220,8%,98%)] rounded-2xl rounded-tl-sm border border-[hsl(220,15%,28%)]"
                      : "bg-[hsl(220,16%,20%)] text-[hsl(220,8%,98%)] rounded-2xl rounded-tl-sm border border-[hsl(220,15%,28%)]"
                  )}
                >
                  {message.isSummary && (
                    <p className="text-xs font-medium mb-2 text-[hsl(220,12%,55%)] border-b border-[hsl(220,15%,28%)] pb-1">
                      📝 Previous conversation summary
                    </p>
                  )}
                  
                  <MarkdownRenderer content={message.content} />
                  
                  {/* Display images if present */}
                  {message.images && message.images.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2 border-t border-[hsl(220,15%,28%)]/50 pt-3">
                      {message.images.map((imageUrl, imgIdx) => (
                        <img
                          key={imgIdx}
                          src={imageUrl}
                          alt={`Attachment ${imgIdx + 1}`}
                          className="max-w-xs rounded-lg cursor-pointer hover:opacity-90 transition-opacity border border-[hsl(220,15%,28%)]"
                          onClick={() => setZoomImage(imageUrl)}
                          data-testid={`message-image-${idx}-${imgIdx}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Checkpoint billing info */}
                {!isAdmin && message.role === "assistant" && message.checkpoint && (
                  <div className="text-xs text-[hsl(220,10%,72%)] bg-[hsl(220,18%,16%)] rounded-md px-3 py-2 space-y-1 max-w-[85%] border border-[hsl(220,15%,28%)]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium text-[hsl(220,8%,98%)]">{message.checkpoint.complexity.toUpperCase()}</span>
                      <span className="font-semibold text-[hsl(220,70%,60%)]">${message.checkpoint.cost.toFixed(2)}</span>
                    </div>
                    <div className="text-[11px] text-[hsl(220,12%,55%)]">{message.checkpoint.estimatedTime}</div>
                    {message.checkpoint.actions && message.checkpoint.actions.length > 0 && (
                      <div className="pt-1 border-t border-[hsl(220,15%,28%)] space-y-0.5">
                        {message.checkpoint.actions.map((action, i) => (
                          <div key={i} className="text-[11px] text-[hsl(220,12%,55%)]">• {action}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              
              {/* Avatar - User Side */}
              {message.role === "user" && (
                <div className="flex-shrink-0">
                  <div className="w-8 h-8 rounded-full bg-[hsl(220,70%,60%)] flex items-center justify-center">
                    <User className="w-4 h-4 text-[hsl(220,8%,98%)]" />
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Task Board - Replit Agent Style */}
          {(streamState.tasks.length > 0 || isGenerating) && (
            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-[hsl(220,70%,60%)] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[hsl(220,8%,98%)]" />
                </div>
              </div>
              <div className="flex-1 max-w-[85%]">
                <TaskBoard 
                  tasks={streamState.tasks}
                  isGenerating={isGenerating}
                  subAgentActive={streamState.subAgentActive}
                />
              </div>
            </div>
          )}

          {/* Loading indicator - Modern style with real-time progress */}
          {chatMutation.isPending && (
            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-[hsl(220,70%,60%)] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[hsl(220,8%,98%)] animate-pulse" />
                </div>
              </div>
              <div className="bg-[hsl(220,16%,20%)] border border-[hsl(220,15%,28%)] rounded-2xl rounded-tl-sm px-3 py-2 min-w-[200px]">
                <div className="flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin text-[hsl(220,70%,60%)]" />
                  <span className="text-sm text-[hsl(220,10%,72%)]">
                    {streamState.chatProgress?.message || 'Thinking...'}
                  </span>
                </div>
                {streamState.chatProgress?.filesModified !== undefined && streamState.chatProgress.filesModified > 0 && (
                  <div className="text-xs text-[hsl(220,12%,55%)] mt-2 pl-6">
                    Modified {streamState.chatProgress.filesModified} {streamState.chatProgress.filesModified === 1 ? 'file' : 'files'}
                  </div>
                )}
              </div>
            </div>
          )}
          
          {/* Progress Display - Clean and Minimal */}
          {currentProgress.length > 0 && (
            <div className="flex gap-3 items-start">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-[hsl(220,70%,60%)] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[hsl(220,8%,98%)]" />
                </div>
              </div>
              <div className="flex-1 max-w-[85%] bg-[hsl(220,16%,20%)] border border-[hsl(220,15%,28%)] rounded-2xl rounded-tl-sm p-3">
                <AgentProgress
                  steps={currentProgress}
                  isWorking={isGenerating}
                  showTeachingEmojis={true}
                  metrics={currentMetrics}
                  onStop={async () => {
                    try {
                      await apiRequest("POST", "/api/commands/abort", { sessionId });
                      setIsGenerating(false);
                      setCurrentProgress([]);
                      setCurrentMetrics({});
                      toast({ description: "Generation stopped successfully" });
                    } catch (error: any) {
                      console.error('Failed to abort generation:', error);
                      setIsGenerating(false);
                      setCurrentProgress([]);
                      setCurrentMetrics({});
                      toast({ 
                        variant: "destructive",
                        description: "Failed to stop generation" 
                      });
                    }
                  }}
                />
              </div>
            </div>
          )}
          
          {/* Secrets Request Form */}
          {secretsRequest && (
            <Card className="border-[hsl(220,15%,28%)] bg-[hsl(220,18%,16%)]" data-testid="secrets-request-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-[hsl(220,70%,60%)]" />
                  <CardTitle className="text-lg text-[hsl(220,8%,98%)]">Secure Credentials Required</CardTitle>
                </div>
                <CardDescription className="text-[hsl(220,10%,72%)]">
                  {secretsRequest.message}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert className="bg-[hsl(220,16%,20%)] border-[hsl(220,15%,28%)]">
                  <AlertCircle className="h-4 w-4 text-[hsl(220,70%,60%)]" />
                  <AlertDescription className="text-sm text-[hsl(220,10%,72%)]">
                    Your credentials will be stored securely as environment variables and never exposed in generated code.
                  </AlertDescription>
                </Alert>
                
                {secretsRequest.requiredSecrets.map((secret) => (
                  <div key={secret.key} className="space-y-2">
                    <Label htmlFor={secret.key} className="text-sm font-medium text-[hsl(220,8%,98%)]">
                      {secret.key}
                    </Label>
                    <p className="text-xs text-[hsl(220,10%,72%)]">{secret.description}</p>
                    {secret.getInstructions && (
                      <p className="text-xs text-[hsl(220,70%,60%)]">
                        Get it from: <a href={secret.getInstructions} target="_blank" rel="noopener noreferrer" className="underline">{secret.getInstructions}</a>
                      </p>
                    )}
                    <Input
                      id={secret.key}
                      type="password"
                      value={secretsInput[secret.key] || ""}
                      onChange={(e) => setSecretsInput({ ...secretsInput, [secret.key]: e.target.value })}
                      placeholder={`Enter your ${secret.key}`}
                      className="font-mono text-sm bg-[hsl(220,16%,20%)] border-[hsl(220,15%,28%)] text-[hsl(220,8%,98%)]"
                      data-testid={`input-secret-${secret.key}`}
                    />
                  </div>
                ))}
                
                <Button 
                  onClick={handleSecretsSubmit} 
                  className="w-full"
                  disabled={commandMutation.isPending}
                  data-testid="button-submit-secrets"
                >
                  {commandMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Generating Project...
                    </>
                  ) : (
                    <>
                      <Key className="w-4 h-4 mr-2" />
                      Continue with Secrets
                    </>
                  )}
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {/* Input - Sticky Bottom Toolbar */}
      <div className="sticky bottom-0 left-0 right-0 border-t border-[hsl(220,15%,28%)] bg-[hsl(220,20%,12%)] z-10">
        <div className="max-w-4xl mx-auto p-4">
          {/* File Status Display */}
          {streamState.currentFile && (
            <div className="mb-2 px-3 py-1.5 bg-[hsl(220,16%,20%)] border-l-2 border-[hsl(220,70%,60%)] rounded text-xs" data-testid="file-status-display">
              <p className="text-[hsl(220,10%,72%)] flex items-center gap-2">
                {streamState.currentFile.action === 'creating' && (
                  <>
                    <span>Creating</span>
                  </>
                )}
                {streamState.currentFile.action === 'updating' && (
                  <>
                    <span>Editing</span>
                  </>
                )}
                {streamState.currentFile.action === 'deleting' && (
                  <>
                    <span>Deleting</span>
                  </>
                )}
                <code className="text-[hsl(220,70%,60%)] font-mono">{streamState.currentFile.filename}</code>
                <Loader2 className="w-3 h-3 animate-spin ml-auto text-[hsl(220,70%,60%)]" />
              </p>
            </div>
          )}
          
          {/* File Summary Display */}
          {streamState.fileSummary && !streamState.currentFile && (
            <div className="mb-2 px-3 py-1.5 bg-[hsl(220,16%,20%)] border-l-2 border-green-500/60 rounded text-xs" data-testid="file-summary-display">
              <p className="text-[hsl(220,10%,72%)] flex items-center gap-2">
                <span>✓</span>
                <span>
                  Saved {streamState.fileSummary.filesChanged} file{streamState.fileSummary.filesChanged !== 1 ? 's' : ''}
                  {' '}({streamState.fileSummary.linesAdded.toLocaleString()} line{streamState.fileSummary.linesAdded !== 1 ? 's' : ''})
                </span>
              </p>
            </div>
          )}
          
          {/* WebSocket Stream: Thinking Display */}
          {streamState.currentThought && (
            <div className="mb-2 px-3 py-1.5 bg-[hsl(220,16%,20%)] border-l-2 border-blue-500/60 rounded text-xs" data-testid="stream-thinking-display">
              <p className="text-[hsl(220,10%,72%)] flex items-center gap-2">
                <span className="italic">{streamState.currentThought}</span>
                <Loader2 className="w-3 h-3 animate-spin ml-auto text-[hsl(220,70%,60%)]" />
              </p>
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
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              placeholder="Message SySop..."
              className="min-h-[44px] max-h-[200px] resize-none text-base bg-[hsl(220,18%,16%)] border-[hsl(220,15%,28%)] text-[hsl(220,8%,98%)] placeholder:text-[hsl(220,12%,55%)] focus-visible:ring-1 focus-visible:ring-[hsl(220,70%,60%)] rounded-2xl px-4 py-3"
              disabled={chatMutation.isPending}
              data-testid="input-chat-message"
              rows={1}
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending}
              size="icon"
              className="flex-shrink-0 h-11 w-11 rounded-full bg-[hsl(220,70%,60%)] hover:bg-[hsl(220,70%,65%)] text-[hsl(220,8%,98%)]"
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
