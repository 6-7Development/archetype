import { useState, useRef, useEffect, useMemo } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Loader2, User, Key, AlertCircle, Square, ChevronDown, Copy, Check, ChevronRight, Menu, Zap, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { cn } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/useAuth";
import { AgentProgress, type ProgressStep, type ProgressMetrics } from "@/components/agent-progress";
import { useWebSocketStream } from "@/hooks/use-websocket-stream";
import { ConnectionStatus } from "@/components/connection-status";
import { nanoid } from "nanoid";
import CostPreview from "@/components/cost-preview";
import { ChangesPanel } from "@/components/changes-panel";
import { MarkdownRenderer } from "@/components/markdown-renderer";
import { AgentTaskList, type AgentTask } from "@/components/agent-task-list";
import { AgentProgressDisplay } from "@/components/agent-progress-display";
import { RunProgressTable } from "@/components/run-progress-table";
import { ChatInputToolbar } from "@/components/ui/chat-input-toolbar";
import { AIModelSelector } from "@/components/ai-model-selector";
import { parseMessageContent, cleanAIResponse } from "@/lib/message-parser";
import { ScratchpadDisplay } from "@/components/scratchpad-display";
import { ArchitectNotesPanel } from "@/components/architect-notes-panel";
import { DeploymentStatusModal } from "@/components/deployment-status-modal";
import { StatusStrip } from "@/components/agent/StatusStrip";
import { ArtifactsDrawer, type Artifact as ArtifactItem } from "@/components/agent/ArtifactsDrawer";
import { EnhancedMessageDisplay } from "@/components/enhanced-message-display";
import { TestingPanel } from "@/components/testing-panel";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ChatHeader } from "@/components/chat/ChatHeader";
import { ContextRail } from "@/components/chat/ContextRail";
import { MessageHistory } from "@/components/chat/MessageHistory";
import { useStreamEvents } from "./chat/useStreamEvents";
import { ChatMessages } from "./chat/ChatMessages";
import { ChatInput } from "./chat/ChatInput";
import { StatusBar } from "./chat/StatusBar";
import { ChatDialogs } from "./chat/ChatDialogs";
import { PlatformHealthIndicator } from "@/components/platform-health-indicator";
import type {
  RunPhase,
  RunState,
  Task as RunTask,
  RunStartedData,
  RunStateUpdateData,
  TaskCreatedData,
  TaskUpdatedData,
  RunCompletedData,
  RunFailedData
} from "@shared/agentEvents";

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
  id?: string;              // REQUIRED for rendering - prevents crashes
  messageId?: string;       // REQUIRED for rendering - prevents crashes
  source?: string;          // Optional - identifies message origin
  progressSteps?: ProgressStep[];
  checkpoint?: CheckpointData;
  isSummary?: boolean;
  images?: string[];
  progressMessages?: Array<{
    id: string;
    message: string;
    timestamp: number;
    category?: 'thinking' | 'action' | 'result';
  }>; // Store thinking/tool calls inline
  // ✅ GAP FIX #3: Add validation metadata field for tool results
  validationMetadata?: {
    valid?: boolean;
    truncated?: boolean;
    warnings?: string[];
    schemaValidated?: boolean;
  };
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

export interface UniversalChatProps {
  targetContext: 'platform' | 'project' | 'architect';
  projectId?: string | null;
  onProjectGenerated?: (result: any) => void;
}

// ============================================================================
// Component now uses extracted useStreamEvents hook for run state management
// ============================================================================

export function UniversalChat({
  targetContext,
  projectId,
  onProjectGenerated,
}: UniversalChatProps) {
  const { toast } = useToast();
  const { user } = useAuth();

  const [input, setInput] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState<boolean>(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]); // Stores data URLs for preview
  const [uploadingImages, setUploadingImages] = useState<Map<string, boolean>>(new Map()); // Stores tempId -> isUploading
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]); // Stores final URLs from backend

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const isAutoScrolling = useRef(true);

  const { runState, sendMessage, stopRun, clearRunState, setRunState } = useStreamEvents({
    projectId,
    targetContext,
    onProjectGenerated,
  });

  // Sync isGenerating with runState.isLoading
  useEffect(() => {
    setIsGenerating(runState.isLoading || false);
  }, [runState.isLoading]);

  // Show error toast when error occurs
  useEffect(() => {
    if (runState.error) {
      toast({
        title: "Error",
        description: runState.error,
        variant: "destructive",
      });
    }
  }, [runState.error, toast]);

  const handleSend = async () => {
    if (!input.trim() && uploadedImageUrls.length === 0) return;

    const messageToSend = input.trim();
    const imagesToSend = [...uploadedImageUrls];

    // Clear input immediately for responsive UX
    setInput("");
    setPendingImages([]);
    setUploadedImageUrls([]);

    // Send message (loading state will be managed by runState.isLoading)
    await sendMessage({
      message: messageToSend,
      images: imagesToSend,
    });
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePaste = async (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.indexOf("image") !== -1) {
        e.preventDefault();
        const file = item.getAsFile();
        if (file) {
          // Create a FileList from the single file
          const dataTransfer = new DataTransfer();
          dataTransfer.items.add(file);
          handleImageSelect(dataTransfer.files);
        }
      }
    }
  };

  const handleImageSelect = async (files: FileList) => {
    if (files.length === 0) return;

    const newPendingImages: string[] = [];
    const newUploadingImages = new Map<string, boolean>();
    const filesToUpload: File[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      if (file.type.startsWith("image/")) {
        const tempId = nanoid();
        newUploadingImages.set(tempId, true);
        filesToUpload.push(file);

        // Create a local URL for immediate preview
        const reader = new FileReader();
        reader.onload = (e) => {
          if (e.target?.result) {
            setPendingImages((prev) => [...prev, e.target!.result as string]);
          }
        };
        reader.readAsDataURL(file);
      }
    }

    setUploadingImages((prev) => new Map([...prev, ...newUploadingImages]));

    // Upload files to the backend
    for (const file of filesToUpload) {
      const tempId = nanoid(); // Use a new tempId for tracking upload status
      const formData = new FormData();
      formData.append('image', file);

      try {
        const response = await fetch('/api/chat/upload-image', {
          method: 'POST',
          body: formData,
          credentials: 'include',
          // Browser automatically sets Content-Type with boundary for FormData
        });

        if (response.ok) {
          const data = await response.json();
          setUploadedImageUrls((prev) => [...prev, data.imageUrl]);
          toast({
            title: "Image Uploaded",
            description: "Your image has been successfully uploaded.",
          });
        } else {
          const errorData = await response.json();
          throw new Error(errorData.error || 'Failed to upload image');
        }
      } catch (error) {
        console.error('Error uploading image:', error);
        toast({
          title: "Upload Failed",
          description: `Failed to upload image: ${(error as Error).message}`,
          variant: "destructive",
        });
      } finally {
        setUploadingImages((prev) => {
          const newState = new Map(prev);
          newState.delete(tempId);
          return newState;
        });
        // Remove the pending image preview once upload is done (success or failure)
        setPendingImages((prev) => prev.filter(url => !url.includes(file.name))); // This might need a more robust way to match
      }
    }
  };

  const removeImage = (imageUrlToRemove: string) => {
    setPendingImages((prev) => prev.filter((url) => url !== imageUrlToRemove));
    setUploadedImageUrls((prev) => prev.filter((url) => url !== imageUrlToRemove));
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (chatContainerRef.current && isAutoScrolling.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [runState.messages]);

  // Clear messages when context changes
  const handleClearChat = () => {
    dispatchRunState({ type: 'messages.clear' });
    try {
      const storageKey = `lomu-chat-messages:${targetContext || 'platform'}:${projectId || 'general'}`;
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.warn('Failed to clear chat history:', e);
    }
  };

  const handleScroll = () => {
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50; // 50px threshold
      isAutoScrolling.current = isAtBottom;
    }
  };

  const currentRun = runState.currentRunId ? runState.runs.get(runState.currentRunId) : null;
  const currentRunMessages = useMemo(() => {
    if (!currentRun) return [];
    return runState.messages.filter(msg => msg.runId === currentRun.id);
  }, [runState.messages, currentRun]);

  const latestMessage = currentRunMessages[currentRunMessages.length - 1];

  const showCostPreview = useMemo(() => {
    if (!currentRun) return false;
    const lastMessage = currentRunMessages[currentRunMessages.length - 1];
    return currentRun.status === 'completed' && lastMessage?.role === 'assistant' && lastMessage?.content.includes('Cost Estimate');
  }, [currentRun, currentRunMessages]);

  const showChangesPanel = useMemo(() => {
    if (!currentRun) return false;
    const lastMessage = currentRunMessages[currentRunMessages.length - 1];
    return currentRun.status === 'completed' && lastMessage?.role === 'assistant' && lastMessage?.content.includes('Proposed Changes');
  }, [currentRun, currentRunMessages]);

  const showArchitectNotes = useMemo(() => {
    if (!currentRun) return false;
    const lastMessage = currentRunMessages[currentRunMessages.length - 1];
    return currentRun.status === 'completed' && lastMessage?.role === 'assistant' && lastMessage?.content.includes('Architect Notes');
  }, [currentRun, currentRunMessages]);

  const showDeploymentStatus = useMemo(() => {
    if (!currentRun) return false;
    const lastMessage = currentRunMessages[currentRunMessages.length - 1];
    return currentRun.status === 'completed' && lastMessage?.role === 'assistant' && lastMessage?.content.includes('Deployment Status');
  }, [currentRun, currentRunMessages]);

  const showTestingPanel = useMemo(() => {
    if (!currentRun) return false;
    const lastMessage = currentRunMessages[currentRunMessages.length - 1];
    return currentRun.status === 'completed' && lastMessage?.role === 'assistant' && lastMessage?.content.includes('Testing Results');
  }, [currentRun, currentRunMessages]);

  const showArtifactsDrawer = useMemo(() => {
    if (!currentRun) return false;
    const lastMessage = currentRunMessages[currentRunMessages.length - 1];
    return currentRun.status === 'completed' && lastMessage?.role === 'assistant' && lastMessage?.content.includes('Artifacts');
  }, [currentRun, currentRunMessages]);

  const showTaskList = useMemo(() => {
    if (!currentRun) return false;
    const lastMessage = currentRunMessages[currentRunMessages.length - 1];
    return currentRun.status === 'completed' && lastMessage?.role === 'assistant' && lastMessage?.content.includes('Task List');
  }, [currentRun, currentRunMessages]);

  const showRunProgressTable = useMemo(() => {
    if (!currentRun) return false;
    const lastMessage = currentRunMessages[currentRunMessages.length - 1];
    return currentRun.status === 'completed' && lastMessage?.role === 'assistant' && lastMessage?.content.includes('Run Progress');
  }, [currentRun, currentRunMessages]);

  const showScratchpad = useMemo(() => {
    if (!currentRun) return false;
    const lastMessage = currentRunMessages[currentRunMessages.length - 1];
    return currentRun.status === 'completed' && lastMessage?.role === 'assistant' && lastMessage?.content.includes('Scratchpad');
  }, [currentRun, currentRunMessages]);

  // Derived state for task and artifact displays
  const agentTasks = useMemo(() => {
    return currentRun?.tasks || [];
  }, [currentRun]);

  const artifacts = useMemo(() => {
    return currentRun?.artifacts || [];
  }, [currentRun]);

  // Persist chat session to database on message update
  const saveChatSession = async (messages: typeof runState.messages) => {
    if (!projectId || messages.length === 0) return;
    
    try {
      await fetch('/api/chat/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectId,
          targetContext,
          messages: messages.map(m => ({
            role: m.role,
            content: m.content,
            images: m.images,
            timestamp: m.timestamp,
          })),
        }),
      });
    } catch (error) {
      console.warn('[CHAT] Failed to save session:', error);
    }
  };

  // Auto-save on message update
  useEffect(() => {
    if (runState.messages.length > 0) {
      const timer = setTimeout(() => {
        saveChatSession(runState.messages);
      }, 2000); // Debounce save
      return () => clearTimeout(timer);
    }
  }, [runState.messages]);

  return (
    <div className="flex h-full flex-col bg-background">
      {/* Workspace Header with Status */}
      <div className="border-b bg-muted/30 px-4 py-2 flex items-center justify-between text-xs gap-4">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-muted-foreground truncate">
            <strong>Workspace:</strong> {targetContext}
            {projectId && ` • Project: ${projectId.slice(0, 8)}`}
          </span>
        </div>
        <div className="flex items-center gap-3 flex-wrap justify-end">
          {/* Platform Health Indicator - Only show for owners/platform context */}
          {(targetContext === 'platform' || targetContext === 'architect') && (
            <PlatformHealthIndicator />
          )}
          
          {isGenerating && (
            <div className="flex items-center gap-1 text-amber-600 dark:text-amber-400">
              <Loader2 className="w-3 h-3 animate-spin" />
              <span>Processing...</span>
            </div>
          )}
          <span className="text-muted-foreground">
            Messages: <strong>{runState.messages.length}</strong>
          </span>
        </div>
      </div>

      <ChatHeader
        currentRun={currentRun}
        stopRun={stopRun}
        clearRunState={clearRunState}
        isGenerating={isGenerating}
        setRunState={setRunState}
      />

      <ResizablePanelGroup direction="horizontal" className="flex-1">
        {/* Left Panel: Chat Messages (70%) */}
        <ResizablePanel defaultSize={70} minSize={50} maxSize={80}>
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
            onScroll={handleScroll}
            data-testid="chat-messages-container"
          >
            {/* Error Display */}
            {runState.error && (
              <Alert variant="destructive" className="mb-4">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{runState.error}</AlertDescription>
              </Alert>
            )}

            {/* Messages Display */}
            {runState.messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground">
                <div className="text-center">
                  <p className="text-lg font-medium mb-2">Start a conversation</p>
                  <p className="text-sm">Send a message to get started with LomuAI</p>
                </div>
              </div>
            ) : (
              <>
                {/* Messages with image rendering */}
                <div className="space-y-4">
                  {runState.messages.map((message, index) => {
                    const isUser = message.role === 'user';
                    const isLast = index === runState.messages.length - 1;
                    const [copied, setCopied] = useState(false);

                    const copyMessage = () => {
                      navigator.clipboard.writeText(message.content);
                      setCopied(true);
                      setTimeout(() => setCopied(false), 2000);
                      toast({ title: "Message copied!" });
                    };
                    
                    return (
                      <div 
                        key={message.id || message.messageId} 
                        className={`flex gap-3 group ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
                        data-testid={`message-container-${message.id}`}
                      >
                        {/* Avatar */}
                        <div 
                          className={`flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-semibold text-xs ${
                            isUser 
                              ? 'bg-primary/20 text-primary border border-primary/30' 
                              : 'bg-secondary/20 text-secondary-foreground border border-secondary/30'
                          }`}
                          data-testid={`avatar-${message.role}`}
                          title={isUser ? 'You' : 'LomuAI'}
                        >
                          {isUser ? (
                            <User className="w-5 h-5" />
                          ) : (
                            <span className="font-bold">AI</span>
                          )}
                        </div>

                        {/* Message Content */}
                        <div className={`flex-1 min-w-0 flex flex-col ${isUser ? 'items-end' : 'items-start'}`}>
                          {/* Sender label */}
                          <div className={`text-xs font-semibold mb-1 ${isUser ? 'text-primary' : 'text-secondary-foreground'}`}>
                            {isUser ? 'You' : 'LomuAI'}
                          </div>

                          {/* Message bubble */}
                          <div 
                            className={`rounded-2xl px-4 py-2.5 max-w-md break-words ${
                              isUser
                                ? 'bg-primary text-primary-foreground rounded-br-none'
                                : 'bg-muted text-foreground rounded-bl-none'
                            }`}
                            data-testid={`message-bubble-${message.id}`}
                          >
                            <div className="text-sm leading-relaxed whitespace-pre-wrap">
                              {message.content}
                            </div>

                            {/* Image Rendering */}
                            {message.images && message.images.length > 0 && (
                              <div className="mt-3 flex flex-wrap gap-2">
                                {message.images.map((imageUrl, idx) => (
                                  <div 
                                    key={idx} 
                                    className="rounded-lg border border-current/20 overflow-hidden bg-background/50 cursor-pointer hover:opacity-80 transition-opacity"
                                    onClick={() => window.open(imageUrl, '_blank')}
                                    data-testid={`message-image-${message.id}-${idx}`}
                                  >
                                    <img 
                                      src={imageUrl} 
                                      alt={`Message image ${idx + 1}`}
                                      className="max-w-xs max-h-64 object-cover"
                                    />
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>

                          {/* Timestamp + Actions */}
                          <div className={`flex items-center gap-2 mt-1 ${isUser ? 'flex-row-reverse' : 'flex-row'} text-xs text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity`}>
                            {message.timestamp && (
                              <span>
                                {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              </span>
                            )}
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-6 w-6"
                              onClick={copyMessage}
                              data-testid={`button-copy-message-${message.id}`}
                              title="Copy message"
                            >
                              {copied ? (
                                <Check className="w-3 h-3 text-green-600" />
                              ) : (
                                <Copy className="w-3 h-3" />
                              )}
                            </Button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Loading indicator */}
                {isGenerating && (
                  <div className="flex gap-3 group flex-row" data-testid="loading-indicator">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-secondary/20 text-secondary-foreground border border-secondary/30">
                      <span className="font-bold text-xs">AI</span>
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col items-start">
                      <div className="text-xs font-semibold mb-1 text-secondary-foreground">LomuAI</div>
                      <div className="bg-muted rounded-2xl rounded-bl-none px-4 py-2.5 flex items-center gap-2">
                        <Loader2 className="h-4 w-4 animate-spin" />
                        <span className="text-sm text-muted-foreground">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={latestMessageRef} />
              </>
            )}
          </div>

          {/* Chat Input */}
          <div className="border-t bg-background p-4">
            <ChatInput
              input={input}
              setInput={setInput}
              onSend={handleSend}
              onKeyDown={handleKeyDown}
              onPaste={handlePaste}
              onImageSelect={(files: FileList | null) => {
                if (files) {
                  handleImageSelect(files);
                }
              }}
              pendingImages={pendingImages}
              uploadingImages={uploadingImages}
              onRemoveImage={removeImage}
              isGenerating={isGenerating}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle className="hidden md:flex" />

        {/* Right Panel: Context Rail (30%) - Hidden on mobile */}
        <ResizablePanel defaultSize={30} minSize={20} maxSize={40} className="hidden md:block">
          <ContextRail
            tasks={agentTasks}
            artifacts={artifacts}
            runState={currentRun}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Footer Status Bar */}
      <div className="border-t bg-muted/20 px-4 py-2 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          {runState.error && (
            <div className="flex items-center gap-1 text-destructive">
              <AlertTriangle className="w-3 h-3" />
              <span>Error occurred</span>
            </div>
          )}
          {runState.messages.length > 0 && (
            <span>
              Last message: {runState.messages[runState.messages.length - 1].timestamp ? 
                new Date(runState.messages[runState.messages.length - 1].timestamp!).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                : 'N/A'
              }
            </span>
          )}
        </div>
        <Button
          size="sm"
          variant="ghost"
          onClick={handleClearChat}
          className="h-6 text-xs"
          data-testid="button-clear-all-messages"
        >
          Clear all
        </Button>
      </div>

      <StatusBar
        currentRun={currentRun}
        isGenerating={isGenerating}
        latestMessage={latestMessage}
      />

      <ChatDialogs
        currentRun={currentRun}
        showCostPreview={showCostPreview}
        showChangesPanel={showChangesPanel}
        showArchitectNotes={showArchitectNotes}
        showDeploymentStatus={showDeploymentStatus}
        showTestingPanel={showTestingPanel}
        showArtifactsDrawer={showArtifactsDrawer}
        showTaskList={showTaskList}
        showRunProgressTable={showRunProgressTable}
        showScratchpad={showScratchpad}
        latestMessage={latestMessage}
        projectId={projectId}
        targetContext={targetContext}
      />
    </div>
  );
}