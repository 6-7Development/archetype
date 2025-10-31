import { useState, useEffect } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Command } from "@shared/schema";
import { Send, CheckCircle, XCircle, Loader2, ChevronDown, ChevronRight, Key, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { useToast } from "@/hooks/use-toast";
import { CheckpointUsage } from "@/components/checkpoint-usage";
import { AiStreamingIndicator } from "@/components/ai-streaming-indicator";
import { useWebSocketStream } from "@/hooks/use-websocket-stream";
import { ConnectionStatus } from "@/components/connection-status";
import { nanoid } from "nanoid";

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

interface CommandConsoleProps {
  onProjectGenerated?: (result: any) => void;
  viewMode?: "mobile" | "desktop";
}

export function CommandConsole({ onProjectGenerated, viewMode = "desktop" }: CommandConsoleProps) {
  const [command, setCommand] = useState("");
  const [expandedCommands, setExpandedCommands] = useState<Set<string>>(new Set());
  const [secretsRequest, setSecretsRequest] = useState<SecretsRequest | null>(null);
  const [secretsInput, setSecretsInput] = useState<Record<string, string>>({});
  const [sessionId] = useState(() => nanoid());
  const [useStreaming] = useState(true); // Enable streaming by default
  const { toast } = useToast();

  // WebSocket streaming
  const streamState = useWebSocketStream(sessionId, "demo-user");

  const { data: commands = [], isLoading: isLoadingCommands } = useQuery<Command[]>({
    queryKey: ["/api/commands"],
  });

  const commandMutation = useMutation<
    { commandId: string; result?: any; needsSecrets?: boolean; message?: string; requiredSecrets?: RequiredSecret[] },
    Error,
    { command: string; userId: string; projectId: string | null; secrets?: Record<string, string>; sessionId?: string }
  >({
    mutationFn: async (data) => {
      // Use streaming endpoint if enabled
      const endpoint = useStreaming ? "/api/commands/stream" : "/api/commands";
      return await apiRequest("POST", endpoint, data);
    },
    onSuccess: (data, variables) => {
      // Check if LomuAI is requesting secrets
      if (data.needsSecrets) {
        setSecretsRequest({
          commandId: data.commandId,
          command: variables.command,
          message: data.message || "This project requires secure credentials",
          requiredSecrets: data.requiredSecrets || [],
        });
        
        // Initialize secrets input state
        const initialSecrets: Record<string, string> = {};
        data.requiredSecrets?.forEach((secret) => {
          initialSecrets[secret.key] = "";
        });
        setSecretsInput(initialSecrets);
        
        // Don't clear command input - user may want to see what they asked for
        toast({ 
          title: "Secrets Required",
          description: data.message 
        });
        
        return;
      }
      
      // Normal project generation success
      queryClient.invalidateQueries({ queryKey: ["/api/commands"] });
      setCommand("");
      toast({ description: "Command executed successfully" });
      if (onProjectGenerated && data.result) {
        onProjectGenerated(data.result);
      }
    },
    onError: (error: any) => {
      toast({ 
        variant: "destructive",
        description: error.message || "Failed to execute command" 
      });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!command.trim()) return;

    // Reset streaming state before new command
    if (useStreaming) {
      streamState.resetState();
    }

    commandMutation.mutate({
      command: command.trim(),
      userId: "demo-user",
      projectId: null,
      sessionId: useStreaming ? sessionId : undefined,
    });
  };

  // Handle streaming completion
  useEffect(() => {
    if (streamState.currentStatus === 'completed' && streamState.usage) {
      // Refresh commands list when streaming completes
      queryClient.invalidateQueries({ queryKey: ["/api/commands"] });
    }
  }, [streamState.currentStatus, streamState.usage]);

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
    
    // Retry command with secrets
    commandMutation.mutate({
      command: secretsRequest.command,
      userId: "demo-user",
      projectId: null,
      secrets: secretsInput,
    });
    
    // Clear secrets request
    setSecretsRequest(null);
    setSecretsInput({});
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  const toggleCommandExpansion = (commandId: string) => {
    const newExpanded = new Set(expandedCommands);
    if (newExpanded.has(commandId)) {
      newExpanded.delete(commandId);
    } else {
      newExpanded.add(commandId);
    }
    setExpandedCommands(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-4 h-4 text-green-500" data-testid={`icon-status-completed`} />;
      case "failed":
        return <XCircle className="w-4 h-4 text-red-500" data-testid={`icon-status-failed`} />;
      case "processing":
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" data-testid={`icon-status-processing`} />;
      default:
        return <Loader2 className="w-4 h-4 text-gray-500" data-testid={`icon-status-pending`} />;
    }
  };

  const parseCommandResponse = (response: string | null) => {
    if (!response) return null;
    try {
      return JSON.parse(response);
    } catch {
      return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-gradient-to-br from-card/60 via-card/50 to-primary/5 backdrop-blur-md rounded-xl border border-primary/20 shadow-2xl shadow-primary/5 relative overflow-hidden" data-testid="container-command-console">
      {/* Animated glow effect */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-primary/10 pointer-events-none"></div>
      
      {/* Command History */}
      <div className="flex-1 overflow-y-auto p-4 lg:p-6 space-y-3 lg:space-y-4 relative z-10" data-testid="container-command-history">
        {isLoadingCommands ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : commands.length === 0 ? (
          <div className="text-center py-8 lg:py-12 text-muted-foreground">
            <div className="w-12 h-12 lg:w-16 lg:h-16 mx-auto mb-3 lg:mb-4 rounded-full bg-primary/10 flex items-center justify-center">
              <Send className="w-6 h-6 lg:w-8 lg:h-8 text-primary/60" />
            </div>
            <p className="text-sm lg:text-base font-medium" data-testid="text-empty-state">No commands yet</p>
            <p className="text-xs lg:text-sm mt-2 text-muted-foreground/60">Start by typing a command below</p>
            <div className="mt-4 p-3 lg:p-4 rounded-lg bg-muted/30 max-w-md mx-auto">
              <p className="text-xs text-muted-foreground mb-2">Try these commands:</p>
              <div className="space-y-1 text-xs font-mono text-left">
                <button
                  onClick={() => setCommand("build a landing page for a coffee shop")}
                  className="w-full text-left text-primary/80 hover:text-primary hover-elevate active-elevate-2 px-2 py-1 rounded transition-colors"
                  data-testid={`button-example-coffee-shop-${viewMode}`}
                  type="button"
                >
                  → build a landing page for a coffee shop
                </button>
                <button
                  onClick={() => setCommand("create a todo app with dark mode")}
                  className="w-full text-left text-primary/80 hover:text-primary hover-elevate active-elevate-2 px-2 py-1 rounded transition-colors"
                  data-testid={`button-example-todo-app-${viewMode}`}
                  type="button"
                >
                  → create a todo app with dark mode
                </button>
                <button
                  onClick={() => setCommand("make a portfolio website")}
                  className="w-full text-left text-primary/80 hover:text-primary hover-elevate active-elevate-2 px-2 py-1 rounded transition-colors"
                  data-testid={`button-example-portfolio-${viewMode}`}
                  type="button"
                >
                  → make a portfolio website
                </button>
              </div>
            </div>
          </div>
        ) : (
          [...commands].reverse().map((cmd) => {
            const isExpanded = expandedCommands.has(cmd.id);
            const parsedResponse = parseCommandResponse(cmd.response);
            
            return (
              <div 
                key={cmd.id} 
                className="font-mono text-sm lg:text-sm border-l-4 border-primary/40 pl-4 lg:pl-5 py-2 rounded-r-xl bg-gradient-to-r from-primary/5 via-primary/8 to-transparent hover-elevate active-elevate-2 transition-all duration-300 shadow-sm hover:shadow-md hover:border-primary/60 group"
                data-testid={`command-entry-${cmd.id}`}
              >
                <div className="flex items-start gap-2 lg:gap-3">
                  <span className="text-green-500 font-bold mt-0.5 text-lg group-hover:text-green-400 transition-colors" data-testid="text-prompt">$</span>
                  <div className="flex-1">
                    <p className="text-foreground" data-testid={`text-command-${cmd.id}`}>{cmd.command}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {getStatusIcon(cmd.status)}
                      <span className="text-xs text-muted-foreground" data-testid={`text-status-${cmd.id}`}>
                        {cmd.status}
                      </span>
                      {cmd.status === "completed" && parsedResponse?.files && (
                        <Badge variant="secondary" className="text-xs" data-testid={`badge-file-count-${cmd.id}`}>
                          {parsedResponse.files.length} files
                        </Badge>
                      )}
                      {cmd.response && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => toggleCommandExpansion(cmd.id)}
                          className="h-6 px-2 ml-auto"
                          data-testid={`button-toggle-details-${cmd.id}`}
                        >
                          {isExpanded ? (
                            <ChevronDown className="w-3 h-3" />
                          ) : (
                            <ChevronRight className="w-3 h-3" />
                          )}
                          <span className="text-xs ml-1">Details</span>
                        </Button>
                      )}
                    </div>
                    
                    {isExpanded && parsedResponse && (
                      <div className="mt-3 space-y-3" data-testid={`container-details-${cmd.id}`}>
                        {/* Checkpoint Usage Display */}
                        {parsedResponse.checkpoint && (
                          <CheckpointUsage
                            command={cmd.command}
                            checkpoint={{
                              complexity: parsedResponse.checkpoint.complexity,
                              cost: parsedResponse.checkpoint.cost,
                              estimatedTime: parsedResponse.checkpoint.estimatedTime,
                              actions: parsedResponse.checkpoint.actions
                            }}
                            timestamp={cmd.createdAt ? new Date(cmd.createdAt) : new Date()}
                            filesGenerated={parsedResponse.files?.length || 0}
                          />
                        )}
                        
                        <div className="p-3 bg-muted/50 rounded-md">
                          {parsedResponse.projectName && (
                            <div className="mb-2">
                              <span className="text-xs font-semibold text-foreground">Project: </span>
                              <span className="text-xs text-muted-foreground">{parsedResponse.projectName}</span>
                            </div>
                          )}
                          {parsedResponse.description && (
                            <div className="mb-2">
                              <span className="text-xs font-semibold text-foreground">Description: </span>
                              <span className="text-xs text-muted-foreground">{parsedResponse.description}</span>
                            </div>
                          )}
                          {parsedResponse.files && (
                            <div>
                              <span className="text-xs font-semibold text-foreground">Files:</span>
                              <ul className="mt-1 space-y-1">
                                {parsedResponse.files.map((file: any, idx: number) => (
                                  <li key={idx} className="text-xs text-muted-foreground flex items-center gap-2">
                                    <span className="text-primary">•</span>
                                    <span>{file.filename}</span>
                                    <Badge variant="outline" className="text-xs h-5">
                                      {file.language}
                                    </Badge>
                                  </li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {parsedResponse.error && (
                            <div className="text-xs text-red-500">
                              Error: {parsedResponse.error}
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
        
        {/* Secrets Request Form */}
        {secretsRequest && (
          <Card className="border-primary/50 bg-card mx-4" data-testid="secrets-request-card">
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
                  Your credentials will be stored securely and used only for this project generation.
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

      {/* Command Input */}
      <div className="border-t border-primary/20 bg-gradient-to-r from-card/90 via-card/80 to-primary/5 backdrop-blur-md p-3 lg:p-4 relative z-10" data-testid="container-command-input">
        {/* Connection Status */}
        {useStreaming && (
          <div className="mb-3">
            <ConnectionStatus
              isConnected={streamState.isConnected}
              isReconnecting={streamState.isReconnecting}
              reconnectAttempt={streamState.reconnectAttempt}
              onReconnect={streamState.forceReconnect}
            />
          </div>
        )}

        {/* Streaming Indicator */}
        {useStreaming && (commandMutation.isPending || streamState.currentStatus) && (
          <div className="mb-3">
            <AiStreamingIndicator
              status={streamState.currentStatus}
              currentThought={streamState.currentThought}
              currentAction={streamState.currentAction}
              currentStep={streamState.currentStep}
              totalSteps={streamState.totalSteps}
              fullMessage={streamState.fullMessage}
            />
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="flex flex-col lg:flex-row items-stretch lg:items-end gap-2 lg:gap-3">
          <div className="flex-1">
            <Textarea
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Type your command... (e.g., 'build a landing page for a coffee shop')"
              className="min-h-[80px] lg:min-h-[60px] font-mono resize-none text-sm lg:text-base bg-background/70 border-primary/20 focus:border-primary/40 focus:ring-primary/20 transition-all duration-200"
              disabled={commandMutation.isPending}
              data-testid="input-command"
            />
            <p className="text-xs text-muted-foreground mt-1.5 hidden lg:block">
              Press <kbd className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-semibold">Enter</kbd> to submit or{" "}
              <kbd className="px-1.5 py-0.5 bg-primary/10 text-primary rounded text-xs font-semibold">Shift+Enter</kbd> for new line
            </p>
          </div>
          <Button
            type="submit"
            disabled={!command.trim() || commandMutation.isPending}
            size="lg"
            className="h-12 lg:h-[60px] w-full lg:w-auto bg-gradient-to-r from-primary to-primary/90 hover:from-primary/90 hover:to-primary shadow-lg shadow-primary/25 hover:shadow-primary/40 transition-all duration-300"
            data-testid="button-submit-command"
          >
            {commandMutation.isPending ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                <span className="lg:hidden">Processing...</span>
              </>
            ) : (
              <>
                <Send className="w-5 h-5 lg:mr-0 mr-2" />
                <span className="lg:hidden">Send Command</span>
              </>
            )}
          </Button>
        </form>
      </div>
    </div>
  );
}
