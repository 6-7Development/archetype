import { useState, useRef, useEffect, useMemo, useCallback } from "react";
import { flushSync } from "react-dom";
import { useRateLimitPolling } from "@/hooks/useRateLimitPolling";
import { ModelSelectorModal } from "@/components/model-selector-modal";
import { SubagentVisibilityPanel, type SubagentTask } from "@/components/subagent-visibility-panel";
import { ArchitectApprovalModal } from "@/components/architect-approval-modal";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { API_ENDPOINTS, getQueryKey, buildApiUrl } from "@/lib/api-utils";
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
import { MarkdownMessage } from "./chat/MarkdownMessage";
import { MessageBubble } from "./chat/MessageBubble";
import { WorkspaceStatus } from "@/components/workspace-status";
import { ConsoleViewer } from "@/components/console-viewer";
import { FileBrowser } from "@/components/file-browser";
import { EnvBrowser } from "@/components/env-browser";
import { IDETabs } from "@/components/ide-tabs";
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
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState<Map<string, boolean>>(new Map());
  const [uploadedImageUrls, setUploadedImageUrls] = useState<string[]>([]);
  
  // Console and Environment Browser State
  const [consoleOutput, setConsoleOutput] = useState<string>("");
  const [showConsole, setShowConsole] = useState<boolean>(false);
  const [showEnvBrowser, setShowEnvBrowser] = useState<boolean>(false);
  
  // Token & Rate Limit Tracking
  const [sessionTokens, setSessionTokens] = useState({ inputTokens: 0, outputTokens: 0, totalTokens: 0, estimatedCost: 0 });
  const [showModelSelector, setShowModelSelector] = useState(false);
  const [currentModel, setCurrentModel] = useState('gemini-2.5-flash');
  const [activeTasks, setActiveTasks] = useState<SubagentTask[]>([]);
  const [showArchitectApproval, setShowArchitectApproval] = useState(false);
  const [architectGuidance, setArchitectGuidance] = useState<any>(null);
  const { status: rateLimitStatus } = useRateLimitPolling(true);

  const chatContainerRef = useRef<HTMLDivElement>(null);
  const latestMessageRef = useRef<HTMLDivElement>(null);
  const isAutoScrolling = useRef(true);

  const { runState, sendMessage, stopRun, clearRunState, setRunState, clearChatHistory } = useStreamEvents({
    projectId,
    targetContext,
    onProjectGenerated,
    onArchitectResult: (result) => {
      // Show architect approval modal when guidance arrives
      setArchitectGuidance(result);
    },
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
    // Send on Enter (not Shift+Enter which adds newline)
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
    // Also support Cmd/Ctrl+Enter on Mac/Windows
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      handleSend();
    }
    // Arrow up to recall last assistant message
    if (e.key === "ArrowUp" && !input.trim() && runState.messages.length > 0) {
      const lastMsg = runState.messages[runState.messages.length - 1];
      if (lastMsg?.role === "assistant") {
        setInput(lastMsg.content);
        e.preventDefault();
      }
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
        const response = await fetch(buildApiUrl(API_ENDPOINTS.CHAT_UPLOAD_IMAGE), {
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

  // Auto-scroll to bottom of chat - ALWAYS scroll on new messages
  useEffect(() => {
    // Scroll to bottom using both methods for reliability
    if (chatContainerRef.current) {
      // Method 1: Direct scroll (works immediately)
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
      
      // Method 2: Defer scroll after DOM fully renders (handles async rendering)
      setTimeout(() => {
        if (chatContainerRef.current) {
          chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
        }
      }, 50);
      
      // Method 3: Scroll latest message into view if ref available
      if (latestMessageRef.current) {
        latestMessageRef.current.scrollIntoView({ behavior: 'smooth', block: 'end' });
      }
    }
  }, [runState.messages]);

  // Clear messages when context changes
  const handleClearChat = () => {
    clearRunState();
    try {
      const storageKey = `lomu-chat-messages:${targetContext || 'platform'}:${projectId || 'general'}`;
      localStorage.removeItem(storageKey);
    } catch (e) {
      console.warn('Failed to clear chat history:', e);
    }
  };

  const handleScroll = () => {
    // Track scroll position but always allow auto-scroll on new messages
    if (chatContainerRef.current) {
      const { scrollTop, scrollHeight, clientHeight } = chatContainerRef.current;
      const isAtBottom = scrollHeight - scrollTop - clientHeight < 50;
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

  // Track token usage from responses
  const updateTokenUsage = useCallback((inputTokens: number, outputTokens: number) => {
    setSessionTokens(prev => {
      const newTotal = prev.totalTokens + inputTokens + outputTokens;
      // Pricing: Gemini $0.075 input / $0.30 output per 1M tokens
      const costPerM = (inputTokens * 0.075 + outputTokens * 0.30) / 1000000;
      return {
        inputTokens: prev.inputTokens + inputTokens,
        outputTokens: prev.outputTokens + outputTokens,
        totalTokens: newTotal,
        estimatedCost: prev.estimatedCost + costPerM,
      };
    });
  }, []);

  // Monitor streaming messages for token data
  useEffect(() => {
    if (runState.messages.length > 0) {
      const lastMessage = runState.messages[runState.messages.length - 1];
      // Extract token data if present in message metadata
      if (lastMessage?.role === 'assistant' && lastMessage?.tokenUsage) {
        const { input = 0, output = 0 } = lastMessage.tokenUsage as any;
        updateTokenUsage(input, output);
      }
    }
  }, [runState.messages, updateTokenUsage]);

  // Persist chat session to database on message update
  const saveChatSession = async (messages: typeof runState.messages) => {
    if (!projectId || messages.length === 0) return;
    
    try {
      await fetch(buildApiUrl(API_ENDPOINTS.CHAT_SESSION), {
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

  // Handle architect result events
  useEffect(() => {
    if (architectGuidance) {
      setShowArchitectApproval(true);
    }
  }, [architectGuidance]);

  return (
    <div className="flex h-full flex-col bg-background dark:from-[hsl(var(--background))] dark:to-[hsl(220,25%,10%)]">
      {/* Architect Approval Modal */}
      <ArchitectApprovalModal
        open={showArchitectApproval}
        onOpenChange={setShowArchitectApproval}
        guidance={architectGuidance?.guidance || ''}
        reasoning={architectGuidance?.reasoning}
        filesInspected={architectGuidance?.filesInspected}
        evidenceUsed={architectGuidance?.evidenceUsed}
        risk={architectGuidance?.risk || 'medium'}
        recommendations={
          architectGuidance?.recommendations?.map((rec: string) => ({
            filePath: 'File',
            changes: rec,
            confidence: architectGuidance.confidence || 50,
            risk: architectGuidance.risk || 'medium',
          })) || []
        }
        confidence={architectGuidance?.confidence || 0}
        onApprove={(notes?: string) => {
          // Emit approval event to backend
          fetch('/api/architect/approve', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              guidance: architectGuidance,
              approvalNotes: notes,
            }),
            credentials: 'include',
          }).catch(err => console.error('Approval failed:', err));
          
          toast({ title: 'Architect guidance approved', description: 'Implementing changes...' });
          setArchitectGuidance(null);
        }}
        onReject={(reason?: string) => {
          // Emit rejection event
          fetch('/api/architect/reject', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              guidance: architectGuidance,
              rejectionReason: reason,
            }),
            credentials: 'include',
          }).catch(err => console.error('Rejection failed:', err));
          
          toast({ title: 'Guidance rejected', description: 'HexadAI will try a different approach' });
          setArchitectGuidance(null);
        }}
      />

      {/* Model Selector Modal */}
      <ModelSelectorModal
        open={showModelSelector}
        onOpenChange={setShowModelSelector}
        currentModel={currentModel}
        onModelSelect={(model) => {
          setCurrentModel(model);
          toast({ title: `Switched to ${model}` });
        }}
      />

      {/* Compact Chat Header */}
      <ChatHeader
        targetContext={targetContext}
        creditBalance={user?.credits || 0}
        isFreeAccess={targetContext === 'platform'}
        isConnected={true}
        sessionTokens={sessionTokens}
        onHistoryClick={() => window.location.href = '/consultation-history'}
        onSettingsClick={() => setShowModelSelector(true)}
      />

      {/* Chat Container - Full Height */}
      <div className="flex flex-col flex-1 min-h-0 overflow-hidden">
          {/* Subagent Panel - Only when active */}
          {activeTasks.length > 0 && (
            <div className="px-3 py-1.5 border-b bg-muted/20 flex-shrink-0">
              <SubagentVisibilityPanel tasks={activeTasks} isActive={true} />
            </div>
          )}

          {/* Mobile: Full-width chat, Desktop: Resizable panels */}
          <div className="flex-1 flex flex-col md:hidden">
            {/* Mobile Chat - Full width */}
            <div
              ref={chatContainerRef}
              className="flex-1 overflow-y-auto px-4 py-3 space-y-4 scroll-smooth min-h-0"
              onScroll={handleScroll}
              data-testid="chat-messages-container-mobile"
            >
              {runState.error && (
                <Alert variant="destructive" className="mb-2" data-testid="error-alert-mobile">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">{runState.error}</AlertDescription>
                </Alert>
              )}
              {runState.messages.length === 0 ? (
                <div className="flex items-center justify-center h-full text-muted-foreground" data-testid="empty-state-chat-mobile">
                  <div className="text-center space-y-4 px-4">
                    <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[hsl(var(--primary))]/15">
                      <Zap className="w-8 h-8 text-[hsl(var(--primary))]" />
                    </div>
                    <div>
                      <p className="text-lg font-bold text-[hsl(var(--primary))]">Start your project</p>
                      <p className="text-sm text-muted-foreground/70 mt-2">Send a message to get started</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="space-y-3">
                    {runState.messages.map((message, index) => (
                      <MessageBubble
                        key={`mobile-${message.id || message.messageId || index}-${index}`}
                        message={message}
                        index={index}
                        totalMessages={runState.messages.length}
                      />
                    ))}
                  </div>
                  {isGenerating && (
                    <div className="flex gap-3 group flex-row" data-testid="loading-indicator-mobile">
                      <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center bg-[hsl(var(--secondary))]/20 text-[hsl(var(--secondary))] border-2 border-[hsl(var(--secondary))]/40 font-bold text-sm button-glow-mint">
                        AI
                      </div>
                      <div className="flex-1 min-w-0 flex flex-col items-start">
                        <div className="text-sm font-bold mb-1 text-[hsl(var(--secondary))]">HexadAI</div>
                        <div className="bg-[hsl(var(--card))]/60 rounded-2xl rounded-bl-none px-4 py-3 flex items-center gap-2 border border-[hsl(var(--secondary))]/20">
                          <Loader2 className="h-5 w-5 animate-spin text-[hsl(var(--secondary))]" />
                          <span className="text-base text-[hsl(var(--secondary))] font-semibold">Thinking...</span>
                        </div>
                      </div>
                    </div>
                  )}
                  <div ref={latestMessageRef} />
                </>
              )}
            </div>
            {/* Mobile Chat Input - Fixed at bottom */}
            <div className="flex-shrink-0 border-t bg-background dark:border-[hsl(var(--primary))]/20 p-3">
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
          </div>

          {/* Desktop: Resizable panels */}
          <ResizablePanelGroup direction="horizontal" className="flex-1 hidden md:flex">
        {/* Left Panel: Chat Messages (88%) */}
        <ResizablePanel defaultSize={88} minSize={70} maxSize={95} className="flex flex-col h-full">
          <div
            ref={chatContainerRef}
            className="flex-1 overflow-y-auto px-3 py-2 space-y-2 scroll-smooth min-h-0"
            onScroll={handleScroll}
            data-testid="chat-messages-container"
          >
            {/* Error Display */}
            {runState.error && (
              <Alert variant="destructive" className="mb-3" data-testid="error-alert">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription className="text-base">{runState.error}</AlertDescription>
              </Alert>
            )}

            {/* Messages Display */}
            {runState.messages.length === 0 ? (
              <div className="flex items-center justify-center h-full text-muted-foreground" data-testid="empty-state-chat">
                <div className="text-center space-y-4">
                  <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-[hsl(var(--primary))]/15">
                    <Zap className="w-8 h-8 text-[hsl(var(--primary))]" />
                  </div>
                  <div>
                    <p className="text-lg font-bold text-[hsl(var(--primary))]">Start your project</p>
                    <p className="text-sm text-muted-foreground/70 mt-2">Send a message to get started</p>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {/* In Progress Tasks (Replit Agent 3 style) */}
                {runState.messages.length > 0 && (
                  <div className="mb-2 bg-slate-100 dark:bg-slate-800/50 rounded-md border border-slate-200 dark:border-slate-700 overflow-hidden">
                    <Collapsible defaultOpen={true}>
                      <CollapsibleTrigger className="w-full px-3 py-1.5 flex items-center justify-between hover:bg-slate-200 dark:hover:bg-slate-700/50 transition-colors">
                        <div className="flex items-center gap-1.5">
                          <ChevronDown className="h-3.5 w-3.5 text-slate-600 dark:text-slate-400" />
                          <span className="font-semibold text-xs text-slate-700 dark:text-slate-200">In progress tasks</span>
                        </div>
                        <span className="text-xs font-mono text-slate-500 dark:text-slate-400">{Math.min(runState.messages.filter(m => m.role === 'assistant').length, 6)} / 6</span>
                      </CollapsibleTrigger>
                      <CollapsibleContent className="px-3 pb-1.5 space-y-1 border-t border-slate-200 dark:border-slate-700">
                        {runState.messages.filter(m => m.role === 'assistant').slice(0, 6).map((msg, idx) => (
                          <div key={idx} className="flex items-start gap-1.5 text-xs">
                            <Check className="h-3 w-3 text-emerald-600 dark:text-emerald-400 flex-shrink-0 mt-0.5" />
                            <span className="text-slate-600 dark:text-slate-300 line-clamp-1">{msg.content.slice(0, 40)}...</span>
                          </div>
                        ))}
                        {isGenerating && (
                          <div className="flex items-center gap-1.5 text-xs">
                            <Loader2 className="h-3 w-3 text-blue-500 animate-spin flex-shrink-0" />
                            <span className="text-slate-600 dark:text-slate-300">Thinking</span>
                          </div>
                        )}
                      </CollapsibleContent>
                    </Collapsible>
                  </div>
                )}

                {/* Messages with image rendering */}
                <div className="space-y-2">
                  {runState.messages.map((message, index) => (
                    <MessageBubble
                      key={`${message.id || message.messageId || index}-${index}`}
                      message={message}
                      index={index}
                      totalMessages={runState.messages.length}
                    />
                  ))}
                </div>

                {/* Loading indicator */}
                {isGenerating && (
                  <div className="flex gap-3 group flex-row" data-testid="loading-indicator">
                    <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center bg-blue-500/20 text-blue-600 dark:text-blue-400 border-2 border-blue-500/40 font-bold text-xs">
                      AI
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col items-start">
                      <div className="text-xs font-bold mb-1 text-blue-600 dark:text-blue-400">Hexad</div>
                      <div className="bg-slate-100 dark:bg-slate-800 rounded-2xl rounded-bl-none px-4 py-2.5 flex items-center gap-2 border border-slate-300 dark:border-slate-700">
                        <Loader2 className="h-4 w-4 animate-spin text-blue-500" />
                        <span className="text-sm text-slate-700 dark:text-slate-200 font-semibold">Thinking...</span>
                      </div>
                    </div>
                  </div>
                )}
                <div ref={latestMessageRef} />
              </>
            )}
          </div>

          {/* Chat Input - Fixed at bottom */}
          <div className="flex-shrink-0 border-t bg-background dark:border-[hsl(var(--primary))]/20 p-2">
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

        {/* Right Panel: Context Rail (12%) - Hidden on mobile */}
        <ResizablePanel defaultSize={12} minSize={5} maxSize={30} className="hidden md:flex flex-col overflow-hidden">
          <ContextRail
            tasks={agentTasks}
            artifacts={artifacts}
            runState={currentRun}
          />
        </ResizablePanel>
      </ResizablePanelGroup>

      {/* Footer Status Bar */}
      <div className="border-t bg-muted/20 dark:border-[hsl(var(--primary))]/20 px-3 py-1 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          {runState.error && (
            <div className="flex items-center gap-1 text-destructive font-semibold">
              <AlertTriangle className="w-3 h-3" />
              <span>Error occurred</span>
            </div>
          )}
          {runState.messages.length > 0 && (
            <span className="dark:text-[hsl(var(--primary))]/70">
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
          className="h-6 text-xs hover:text-[hsl(var(--primary))] hover:bg-[hsl(var(--primary))]/10"
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
      </div>

      {/* Console Output Panel */}
      <ConsoleViewer
        output={consoleOutput}
        isOpen={showConsole}
        onClose={() => setShowConsole(false)}
      />

      {/* Environment Variables Browser */}
      <EnvBrowser
        isOpen={showEnvBrowser}
        onClose={() => setShowEnvBrowser(false)}
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