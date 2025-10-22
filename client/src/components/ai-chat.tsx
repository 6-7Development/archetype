import { useState, useRef, useEffect } from "react";
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
  const [zoomImage, setZoomImage] = useState<string | null>(null); // For image zoom modal
  const [secretsRequest, setSecretsRequest] = useState<SecretsRequest | null>(null);
  const [secretsInput, setSecretsInput] = useState<Record<string, string>>({});
  const [lastCommand, setLastCommand] = useState<string>("");
  const [currentProgress, setCurrentProgress] = useState<ProgressStep[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<ProgressMetrics>({});
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Fix sessionId persistence - scoped to project, survives remount
  const [sessionId] = useState(() => {
    const storageKey = `chat-session-${currentProjectId || 'default'}`;
    const existing = localStorage.getItem(storageKey);
    if (existing) return existing;
    
    const newSessionId = nanoid();
    localStorage.setItem(storageKey, newSessionId);
    return newSessionId;
  });
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

  // Load chat history on mount
  const { data: chatHistory, isLoading: isLoadingHistory } = useQuery<{ messages: Message[] }>({
    queryKey: ['/api/chat/history', currentProjectId],
    enabled: !!currentProjectId,
  });

  // Hydrate messages from API response or show default greeting
  useEffect(() => {
    if (chatHistory?.messages && chatHistory.messages.length > 0) {
      setMessages(chatHistory.messages.map(msg => ({
        ...msg,
        timestamp: msg.timestamp ? new Date(msg.timestamp) : new Date(),
      })));
    } else if (!isLoadingHistory && currentProjectId) {
      // No history found, show default greeting
      setMessages([DEFAULT_GREETING]);
    } else if (!currentProjectId) {
      // No project selected, show greeting
      setMessages([DEFAULT_GREETING]);
    }
  }, [chatHistory, isLoadingHistory, currentProjectId]);

  // Mutation to save messages to database
  const saveMessageMutation = useMutation<void, Error, { projectId: string; role: string; content: string }>({
    mutationFn: async (data) => {
      await apiRequest("POST", "/api/chat/messages", data);
    },
    onSuccess: () => {
      // Invalidate chat history to keep it in sync
      queryClient.invalidateQueries({ queryKey: ['/api/chat/history', currentProjectId] });
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

  const chatMutation = useMutation<{ response: string; shouldGenerate?: boolean; command?: string; checkpoint?: CheckpointData }, Error, { message: string; projectId?: number; images?: string[] }>({
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
      
      // Persist assistant message to database
      if (currentProjectId) {
        saveMessageMutation.mutate({
          projectId: currentProjectId,
          role: 'assistant',
          content: data.response,
        });
      }
      
      // If AI decides to generate code, show cost preview first
      if (data.shouldGenerate && data.command) {
        // Analyze complexity before executing
        complexityMutation.mutate({ command: data.command });
      }
    },
  });

  const commandMutation = useMutation<
    { commandId: string; result?: any; needsSecrets?: boolean; message?: string; requiredSecrets?: RequiredSecret[] }, 
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
    
    // Simulate progress steps
    const progressSteps: ProgressStep[] = [
      { id: "1", type: "thinking", message: "Analyzing your request..." },
      { id: "2", type: "thinking", message: "Designing project architecture..." },
      { id: "3", type: "action", message: "Generating code files..." },
      { id: "4", type: "action", message: "Testing syntax and logic..." },
      { id: "5", type: "action", message: "Validating security..." },
    ];
    
    // Simulate step-by-step progress
    let currentStep = 0;
    const progressInterval = setInterval(() => {
      if (currentStep < progressSteps.length) {
        setCurrentProgress(progressSteps.slice(0, currentStep + 1));
        currentStep++;
      }
    }, 600);
    
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
          
          // Show final success step
          setCurrentProgress([
            ...progressSteps,
            { id: "6", type: "success", message: "Project generated successfully!" },
          ]);
          
          // Clear progress after 2 seconds
          setTimeout(() => {
            setCurrentProgress([]);
          }, 2000);
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
    
    // Persist user message to database
    if (currentProjectId) {
      saveMessageMutation.mutate({
        projectId: currentProjectId,
        role: 'user',
        content: userMessage,
      });
    }
    
    chatMutation.mutate({ 
      message: userMessage,
      projectId: currentProjectId ? parseInt(currentProjectId) : undefined,
      images: messagesToSend,
    });
  };

  // Handle image paste from clipboard
  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      
      // Check if item is an image
      if (item.type.indexOf('image') !== -1) {
        e.preventDefault(); // Prevent default paste behavior for images
        
        const file = item.getAsFile();
        if (file) {
          // Upload image immediately
          uploadImageMutation.mutate(file);
        }
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
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  return (
    <div className="flex flex-col h-full bg-background">
      {/* Messages - Clean Scrollable Area */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto px-4 py-6 scroll-smooth"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="space-y-3 max-w-3xl mx-auto">
          {messages.map((message, idx) => (
            <div
              key={idx}
              className={cn(
                "flex gap-3 items-start",
                message.role === "user" && "flex-row-reverse"
              )}
              data-testid={`chat-message-${idx}`}
            >
              {/* Avatar */}
              {message.role === "assistant" && !message.isSummary && (
                <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                  <Sparkles className="w-3.5 h-3.5 text-primary" />
                </div>
              )}
              {message.isSummary && (
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
                  <AlertCircle className="w-3.5 h-3.5 text-muted-foreground" />
                </div>
              )}
              {message.role === "user" && (
                <div className="w-6 h-6 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                  <User className="w-3.5 h-3.5 text-primary-foreground" />
                </div>
              )}

              {/* Message Content */}
              <div className={cn("flex-1 space-y-2", message.role === "user" && "flex flex-col items-end")}>
                <div
                  className={cn(
                    "inline-block rounded-md px-3 py-2 text-sm max-w-[85%]",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : message.isSummary
                      ? "bg-muted/30 text-muted-foreground"
                      : "bg-muted/50 text-foreground"
                  )}
                >
                  {message.isSummary && (
                    <p className="text-xs font-medium mb-1.5 opacity-70">Previous conversation summary</p>
                  )}
                  <p className="whitespace-pre-wrap leading-relaxed break-words">{message.content}</p>
                  
                  {/* Display images if present */}
                  {message.images && message.images.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-2">
                      {message.images.map((imageUrl, imgIdx) => (
                        <img
                          key={imgIdx}
                          src={imageUrl}
                          alt={`Attachment ${imgIdx + 1}`}
                          className="max-w-xs max-h-48 object-contain rounded border border-border cursor-pointer hover-elevate transition-all"
                          onClick={() => setZoomImage(imageUrl)}
                          data-testid={`message-image-${idx}-${imgIdx}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
                
                {/* Checkpoint billing info */}
                {!isAdmin && message.role === "assistant" && message.checkpoint && (
                  <div className="text-xs text-muted-foreground bg-muted/30 rounded-md px-3 py-2 space-y-1 max-w-[85%]">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-medium">{message.checkpoint.complexity.toUpperCase()}</span>
                      <span className="font-semibold">${message.checkpoint.cost.toFixed(2)}</span>
                    </div>
                    <div className="text-[11px] opacity-70">{message.checkpoint.estimatedTime}</div>
                    {message.checkpoint.actions && message.checkpoint.actions.length > 0 && (
                      <div className="pt-1 border-t border-border/30 space-y-0.5">
                        {message.checkpoint.actions.map((action, i) => (
                          <div key={i} className="text-[11px] opacity-70">• {action}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading indicator */}
          {chatMutation.isPending && (
            <div className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Sparkles className="w-3.5 h-3.5 text-primary animate-pulse" />
              </div>
              <div className="bg-muted/50 rounded-md px-3 py-2">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            </div>
          )}
          
          {/* Progress Display */}
          {currentProgress.length > 0 && (
            <div className="flex gap-3 items-start">
              <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-1">
                <Sparkles className="w-3.5 h-3.5 text-primary" />
              </div>
              <div className="flex-1 max-w-[85%]">
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
            <Card className="border-primary/50 bg-card" data-testid="secrets-request-card">
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Key className="w-5 h-5 text-primary" />
                  <CardTitle className="text-lg">Secure Credentials Required</CardTitle>
                </div>
                <CardDescription>
                  {secretsRequest.message}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Alert>
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    Your credentials will be stored securely as environment variables and never exposed in generated code.
                  </AlertDescription>
                </Alert>
                
                {secretsRequest.requiredSecrets.map((secret) => (
                  <div key={secret.key} className="space-y-2">
                    <Label htmlFor={secret.key} className="text-sm font-medium">
                      {secret.key}
                    </Label>
                    <p className="text-xs text-muted-foreground">{secret.description}</p>
                    {secret.getInstructions && (
                      <p className="text-xs text-primary">
                        Get it from: <a href={secret.getInstructions} target="_blank" rel="noopener noreferrer" className="underline">{secret.getInstructions}</a>
                      </p>
                    )}
                    <Input
                      id={secret.key}
                      type="password"
                      value={secretsInput[secret.key] || ""}
                      onChange={(e) => setSecretsInput({ ...secretsInput, [secret.key]: e.target.value })}
                      placeholder={`Enter your ${secret.key}`}
                      className="font-mono text-sm"
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

      {/* Input - Clean Bottom Toolbar */}
      <div className="border-t border-border/50 bg-background/95 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto p-3">
          {/* Image Preview Section */}
          {pendingImages.length > 0 && (
            <div className="mb-3 flex flex-wrap gap-2">
              {pendingImages.map((imageUrl, index) => (
                <div key={index} className="relative group">
                  <img
                    src={imageUrl}
                    alt={`Preview ${index + 1}`}
                    className="h-20 w-20 object-cover rounded border border-border"
                    data-testid={`image-preview-${index}`}
                  />
                  <button
                    onClick={() => removeImage(imageUrl)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1 opacity-0 group-hover:opacity-100 transition-opacity"
                    data-testid={`button-remove-image-${index}`}
                  >
                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
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
              placeholder="Describe what you want to build or paste a screenshot..."
              className="min-h-[40px] max-h-[120px] resize-none text-sm border-border/50 focus-visible:ring-1"
              disabled={chatMutation.isPending}
              data-testid="input-chat-message"
            />
            <Button
              onClick={handleSend}
              disabled={!input.trim() || chatMutation.isPending}
              size="icon"
              className="flex-shrink-0 h-10 w-10"
              data-testid="button-send-chat"
            >
              {chatMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
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
