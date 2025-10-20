import { useState, useRef, useEffect } from "react";
import { useMutation } from "@tanstack/react-query";
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
  role: "user" | "assistant";
  content: string;
  timestamp?: Date;
  progressSteps?: ProgressStep[];
  checkpoint?: CheckpointData; // Checkpoint billing data
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
  
  const [messages, setMessages] = useState<Message[]>([
    {
      role: "assistant",
      content: "👋 Hi friend! I'm SySop - think of me as your personal coding teacher and builder!\n\n📚 I LOVE teaching! I'll explain everything step-by-step in plain English. No confusing tech words - promise!\n\n✨ Here's how I work:\n\n🧠 **Step 1: Listen carefully** - Tell me what you want to build, even if you don't know the \"right\" words\n\n📝 **Step 2: Plan it out** - I'll organize everything neatly (like sorting LEGO blocks before building)\n\n🔨 **Step 3: Build it** - I write all the code while explaining what each piece does\n\n🧪 **Step 4: Test it** - I try everything to make sure it works perfectly (like checking a cake with a toothpick)\n\n🔧 **Step 5: Fix any issues** - If something's not right, I fix it and tell you what I did\n\n💡 What can I build for you?\n\n• 🌐 **Websites** - Like an online store, blog, or portfolio (I build the whole thing!)\n• 🎮 **Games** - Fun 2D or 3D games you can play in your browser\n• 📱 **Apps** - Todo lists, calculators, anything you can imagine\n• 💼 **Business tools** - Systems to help run your business smoothly\n\n🔒 **Safety First**: I'll never create fake passwords or security keys. If you need real ones, I'll guide you step-by-step on how to get them safely.\n\n⚡ **Real-time progress**: You can watch me work - I'll show you each step as I go!\n\nSo... what would you like to build today? Don't worry if you're not sure how to explain it - just describe your idea and I'll help! 🚀",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [secretsRequest, setSecretsRequest] = useState<SecretsRequest | null>(null);
  const [secretsInput, setSecretsInput] = useState<Record<string, string>>({});
  const [lastCommand, setLastCommand] = useState<string>("");
  const [currentProgress, setCurrentProgress] = useState<ProgressStep[]>([]);
  const [currentMetrics, setCurrentMetrics] = useState<ProgressMetrics>({});
  const [isGenerating, setIsGenerating] = useState(false);
  const [sessionId] = useState(() => nanoid());
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

  // Check for quickstart prompt from onboarding
  useEffect(() => {
    const quickstartPrompt = localStorage.getItem('archetype_ai_prompt');
    if (quickstartPrompt) {
      setInput(quickstartPrompt);
      localStorage.removeItem('archetype_ai_prompt');
    }
  }, []);

  // WebSocket streaming for AI chat (use anonymous if not logged in)
  const streamState = useWebSocketStream(sessionId, "demo-user");
  
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

  const chatMutation = useMutation<{ response: string; shouldGenerate?: boolean; command?: string; checkpoint?: CheckpointData }, Error, { message: string }>({
    mutationFn: async (data) => {
      return await apiRequest<{ response: string; shouldGenerate?: boolean; command?: string; checkpoint?: CheckpointData }>("POST", "/api/ai-chat-conversation", data);
    },
    onSuccess: (data) => {
      setMessages((prev) => [
        ...prev,
        {
          role: "assistant",
          content: data.response,
          timestamp: new Date(),
          checkpoint: data.checkpoint, // Include checkpoint data for billing display
        },
      ]);
      
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
            content: `🔐 ${data.message}\n\nI've detected that this project requires secure API keys or credentials. Please provide them below, and I'll continue building your project.`,
            timestamp: new Date(),
          },
        ]);
        
        return;
      }
      
      // Normal project generation success
      queryClient.invalidateQueries({ queryKey: ["/api/commands"] });
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
        userId: "demo-user",
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
        content: "✅ Secrets received securely. Continuing with project generation...",
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
    setMessages((prev) => [
      ...prev,
      {
        role: "user",
        content: userMessage,
        timestamp: new Date(),
      },
    ]);
    setInput("");
    chatMutation.mutate({ message: userMessage });
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
      {/* Messages - Mobile-First Scrollable Area */}
      <div 
        ref={scrollRef} 
        className="flex-1 overflow-y-auto px-2 sm:px-4 py-3 sm:py-6 scroll-smooth"
        style={{ scrollBehavior: 'smooth' }}
      >
        <div className="space-y-4 sm:space-y-6 max-w-4xl mx-auto">
          {messages.map((message, idx) => (
            <div
              key={idx}
              className={cn(
                "flex gap-2 sm:gap-3 items-start",
                message.role === "user" && "justify-end"
              )}
              data-testid={`chat-message-${idx}`}
            >
              {message.role === "assistant" && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                  <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                </div>
              )}
              <div className="flex-1 max-w-[85%] sm:max-w-[80%] space-y-2">
                <div
                  className={cn(
                    "rounded-lg px-3 sm:px-4 py-2 sm:py-2.5 text-sm",
                    message.role === "user"
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-foreground"
                  )}
                >
                  <p className="whitespace-pre-wrap leading-relaxed break-words">{message.content}</p>
                </div>
                
                {/* Display checkpoint data for assistant messages (hide for admins - they have unlimited free access) */}
                {!isAdmin && message.role === "assistant" && message.checkpoint && (
                  <div className="text-xs text-muted-foreground bg-muted/50 rounded px-3 py-2 space-y-1">
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Checkpoint: {message.checkpoint.complexity.toUpperCase()}</span>
                      <span className="font-semibold">${message.checkpoint.cost.toFixed(2)}</span>
                    </div>
                    <div className="text-[10px] opacity-70">{message.checkpoint.estimatedTime}</div>
                    {message.checkpoint.actions && message.checkpoint.actions.length > 0 && (
                      <div className="pt-1 border-t border-border/50">
                        {message.checkpoint.actions.map((action, i) => (
                          <div key={i} className="text-[10px] opacity-70">• {action}</div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
              {message.role === "user" && (
                <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0">
                  <User className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary" />
                </div>
              )}
            </div>
          ))}
          {chatMutation.isPending && (
            <div className="flex gap-2 sm:gap-3 items-start">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary animate-pulse" />
              </div>
              <div className="bg-muted rounded-lg px-3 sm:px-4 py-2 sm:py-2.5">
                <Loader2 className="w-4 h-4 animate-spin text-primary" />
              </div>
            </div>
          )}
          
          {/* Replit-style Progress Display - Mobile Optimized */}
          {currentProgress.length > 0 && (
            <div className="flex gap-2 sm:gap-3 items-start">
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                <Sparkles className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-primary animate-pulse" />
              </div>
              <div className="flex-1 max-w-[85%] sm:max-w-[80%]">
                <AgentProgress
                  steps={currentProgress}
                  isWorking={isGenerating}
                  showTeachingEmojis={true}
                  metrics={currentMetrics}
                  onStop={async () => {
                    // Call abort API
                    try {
                      await apiRequest("POST", "/api/commands/abort", { sessionId });
                      setIsGenerating(false);
                      setCurrentProgress([]);
                      setCurrentMetrics({});
                      toast({ description: "Generation stopped successfully" });
                    } catch (error: any) {
                      console.error('Failed to abort generation:', error);
                      // Still update UI even if API call fails
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

      {/* Input - Mobile-First Bottom Area (44px touch targets) */}
      <div className="border-t bg-background p-2 sm:p-4 safe-area-bottom">
        <div className="max-w-4xl mx-auto flex gap-2 items-end">
          <Textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Describe what you want to build..."
            className="min-h-[44px] max-h-[120px] resize-none text-sm sm:text-base"
            disabled={chatMutation.isPending}
            data-testid="input-chat-message"
          />
          <Button
            onClick={handleSend}
            disabled={!input.trim() || chatMutation.isPending}
            size="icon"
            className="flex-shrink-0 min-h-[44px] min-w-[44px]"
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
    </div>
  );
}
