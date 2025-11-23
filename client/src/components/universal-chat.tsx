import { useState, useRef, useEffect, useMemo } from "react";
import { flushSync } from "react-dom";
import { useMutation, useQuery } from "@tanstack/react-query";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { Send, Loader2, User, Key, AlertCircle, Square, ChevronDown, Copy, Check, ChevronRight, Menu } from "lucide-react";
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
    onRunCompleted: () => setIsGenerating(false),
    onRunFailed: () => setIsGenerating(false),
  });

  const { mutate: sendChatMessage } = useMutation({
    mutationFn: async ({ message, images }: { message: string; images?: string[] }) => {
      const response = await apiRequest(
        `/api/chat`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            message,
            projectId,
            targetContext,
            images, // Pass image URLs to the backend
          }),
        },
        true
      );
      return response.json();
    },
    onSuccess: (data) => {
      // The actual streaming response will update the UI, so no direct message update here
      // We might want to store the initial message in the state immediately for responsiveness
      // but the full message will come via SSE.
    },
    onError: (error) => {
      console.error("Error sending chat message:", error);
      toast({
        title: "Error",
        description: "Failed to send message. Please try again.",
        variant: "destructive",
      });
      setIsGenerating(false);
    },
  });

  const handleSend = () => {
    if (!input.trim() && uploadedImageUrls.length === 0) return;
    setIsGenerating(true);

    const messageToSend = input.trim();
    const imagesToSend = [...uploadedImageUrls];

    sendMessage({
      message: messageToSend,
      images: imagesToSend,
    });

    setInput("");
    setPendingImages([]);
    setUploadedImageUrls([]);
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
        const response = await apiRequest('/api/chat/upload-image', {
          method: 'POST',
          body: formData,
          // Don't set Content-Type - let browser set it with boundary for FormData
        }, true);

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

  return (
    <div className="flex h-full flex-col bg-background">
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
            <MessageHistory messages={runState.messages} latestMessageRef={latestMessageRef} />
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