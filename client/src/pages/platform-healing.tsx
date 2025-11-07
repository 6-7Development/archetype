import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'wouter';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AdminGuard } from '@/components/admin-guard';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Send, Upload, Rocket, Plus, Loader2, Database, Activity, AlertCircle, CheckCircle, RefreshCw, Trash2, BarChart3, ListTodo } from 'lucide-react';
import { cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { AgentTaskList, type AgentTask } from '@/components/agent-task-list';
import { MarkdownRenderer } from '@/components/markdown-renderer';
import { Skeleton } from '@/components/ui/skeleton';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { parseMessageContent, cleanAIResponse } from '@/lib/message-parser';
import { ChatInputToolbar } from '@/components/ui/chat-input-toolbar';
import { nanoid } from 'nanoid';

interface HealingTarget {
  id: string;
  type: 'platform' | 'user_project' | 'customer_project';
  name: string;
  projectId?: string;
  customerId?: string;
}

interface HealingConversation {
  id: string;
  targetId: string;
  title: string;
  status: 'active' | 'completed' | 'paused';
  updatedAt: string;
}

interface HealingMessage {
  id: string;
  conversationId: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  metadata?: { type?: string; [key: string]: any };
  createdAt: string;
}


/**
 * Format error messages for user-friendly display
 * Converts technical errors into clear, actionable messages
 */
function formatUserError(error: any, context: string): { title: string; description: string } {
  const errorMessage = error?.message || String(error);
  
  // Network/connectivity errors
  if (errorMessage.includes('fetch') || errorMessage.includes('network') || errorMessage.includes('Failed to load')) {
    return {
      title: `Connection Issue`,
      description: `Could not connect to ${context}. Please check your connection and try again.`
    };
  }
  
  // Authentication errors
  if (errorMessage.includes('401') || errorMessage.includes('unauthorized') || errorMessage.includes('authentication')) {
    return {
      title: `Authentication Required`,
      description: `Your session may have expired. Please refresh the page and sign in again.`
    };
  }
  
  // Permission errors
  if (errorMessage.includes('403') || errorMessage.includes('forbidden') || errorMessage.includes('permission')) {
    return {
      title: `Access Denied`,
      description: `You don't have permission to ${context}. Contact your administrator if this is unexpected.`
    };
  }
  
  // Server errors
  if (errorMessage.includes('500') || errorMessage.includes('Internal Server Error')) {
    return {
      title: `Server Error`,
      description: `Something went wrong on our end. Our team has been notified. Please try again in a few moments.`
    };
  }
  
  // Timeout errors
  if (errorMessage.includes('timeout') || errorMessage.includes('timed out')) {
    return {
      title: `Request Timeout`,
      description: `The operation took too long to complete. Please try again with a simpler request.`
    };
  }
  
  // Default: clean up technical jargon but keep useful info
  const cleanedError = errorMessage
    .replace(/Error:/gi, '')
    .replace(/Failed to /gi, 'Could not ')
    .trim();
  
  // Title-case the context string
  const titleCasedContext = context.charAt(0).toUpperCase() + context.slice(1);
  
  return {
    title: `${titleCasedContext} Failed`,
    description: cleanedError || 'An unexpected error occurred. Please try again.'
  };
}

function PlatformHealingContent() {
  const { toast } = useToast();
  const [targetId, setTargetId] = useState<string | null>(null);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<HealingMessage[]>([]);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const [tasks, setTasks] = useState<AgentTask[]>([]);
  const [showTaskDrawer, setShowTaskDrawer] = useState(false);
  const [attachedFiles, setAttachedFiles] = useState<Array<{
    name: string;
    size: number;
    type: string;
    content?: string;
    url?: string;
  }>>([]);
  const [isUploadingFiles, setIsUploadingFiles] = useState(false);
  const [pendingImages, setPendingImages] = useState<string[]>([]);
  const [uploadingImages, setUploadingImages] = useState<Map<string, boolean>>(new Map());
  const [progressMessages, setProgressMessages] = useState<Array<{id: string, message: string, timestamp: number}>>([]);
  
  // Deployment and healing status tracking
  const [deploymentStatus, setDeploymentStatus] = useState<{
    sessionId?: string;
    status?: 'deploying' | 'success' | 'failed';
    url?: string;
  }>({});
  const [healingSessions, setHealingSessions] = useState<any[]>([]);
  
  // WebSocket connection for real-time deployment and healing updates
  useEffect(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const wsUrl = `${protocol}//${window.location.host}`;
    const ws = new WebSocket(wsUrl);
    
    ws.onopen = () => {
      console.log('[PLATFORM-HEALING] WebSocket connected for deployment updates');
    };
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        // Handle deployment status updates
        if (data.type === 'deployment-status') {
          console.log('[PLATFORM-HEALING] Deployment status update:', data);
          setDeploymentStatus({
            sessionId: data.sessionId,
            status: data.deploymentStatus,
            url: data.deploymentUrl,
          });
          
          // Show toast notification
          if (data.deploymentStatus === 'deploying') {
            toast({
              title: '🚀 Deployment Started',
              description: 'Deploying fix to production...',
            });
          } else if (data.deploymentStatus === 'success') {
            toast({
              title: '✅ Deployment Successful',
              description: data.deploymentUrl ? `Live at ${data.deploymentUrl}` : 'Fix deployed successfully',
            });
          } else if (data.deploymentStatus === 'failed') {
            toast({
              title: '❌ Deployment Failed',
              description: 'Fix could not be deployed. Check logs for details.',
              variant: 'destructive',
            });
          }
        }
        
        // Handle healing event updates
        if (data.type === 'platform-healing') {
          console.log('[PLATFORM-HEALING] Healing event:', data);
          
          if (data.type === 'healing-complete') {
            toast({
              title: '✅ Auto-Healing Complete',
              description: data.message || 'Platform issue fixed automatically',
            });
            
            // Refresh healing sessions list
            queryClient.invalidateQueries({ queryKey: ['/api/platform/healing/sessions'] });
          }
          
          if (data.type === 'kill-switch-activated') {
            toast({
              title: '⛔ Auto-Healing Disabled',
              description: data.message || 'Auto-healing disabled due to consecutive failures',
              variant: 'destructive',
            });
          }
        }
      } catch (error) {
        console.error('[PLATFORM-HEALING] WebSocket message parse error:', error);
      }
    };
    
    ws.onerror = (error) => {
      console.error('[PLATFORM-HEALING] WebSocket error:', error);
    };
    
    ws.onclose = () => {
      console.log('[PLATFORM-HEALING] WebSocket disconnected');
    };
    
    return () => {
      ws.close();
    };
  }, [toast]);

  // Load healing targets
  const { data: targets, isLoading: targetsLoading, error: targetsError } = useQuery<HealingTarget[]>({
    queryKey: ['/api/healing/targets'],
    queryFn: async () => {
      console.log('[HEALING-UI] Fetching targets...');
      const res = await fetch('/api/healing/targets', { credentials: 'include' });
      console.log('[HEALING-UI] Targets response status:', res.status);
      if (!res.ok) {
        const errorText = await res.text();
        console.error('[HEALING-UI] Targets fetch failed:', errorText);
        throw new Error('Failed to load targets');
      }
      const data = await res.json();
      console.log('[HEALING-UI] Targets loaded:', data);
      return data;
    },
  });
  
  // Log targets state
  useEffect(() => {
    console.log('[HEALING-UI] Targets state:', { targets, targetsLoading, targetsError });
  }, [targets, targetsLoading, targetsError]);

  // Load conversations for selected target
  const { data: conversations } = useQuery<HealingConversation[]>({
    queryKey: ['/api/healing/conversations', targetId],
    enabled: !!targetId,
    queryFn: async () => {
      const res = await fetch(`/api/healing/conversations/${targetId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load conversations');
      return res.json();
    },
  });

  // Load messages for selected conversation
  const { data: loadedMessages, isLoading: messagesLoading } = useQuery<HealingMessage[]>({
    queryKey: ['/api/healing/messages', conversationId],
    enabled: !!conversationId,
    queryFn: async () => {
      const res = await fetch(`/api/healing/messages/${conversationId}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load messages');
      return res.json();
    },
  });

  // Update messages when loaded
  useEffect(() => {
    if (loadedMessages) {
      setMessages(loadedMessages);
    }
  }, [loadedMessages]);

  // Load active task list for current user
  const { data: taskListData } = useQuery({
    queryKey: ['/api/task-lists/active'],
    queryFn: async () => {
      const res = await fetch('/api/task-lists/active', { credentials: 'include' });
      if (!res.ok) return null;
      const data = await res.json();
      return data;
    },
    refetchInterval: 2000, // Poll every 2 seconds for real-time updates
  });

  // Update tasks when task list data changes
  useEffect(() => {
    if (taskListData?.tasks) {
      setTasks(taskListData.tasks);
    } else {
      setTasks([]);
    }
  }, [taskListData]);

  // Auto-scroll to bottom
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingContent]);

  // Clear conversation state when target changes (prevents message bleeding between targets)
  useEffect(() => {
    setConversationId(null);
    setMessages([]);
    setTasks([]); // Clear tasks when changing targets
  }, [targetId]);

  // DISABLED: Auto-loading chat breaks LomuAI workflow by loading old context
  // Users must manually select "New Chat" or choose existing conversation
  // This ensures clean state for each healing session
  // useEffect(() => {
  //   if (!targetId) return;
  //   const lastConvId = localStorage.getItem(`last-conv-${targetId}`);
  //   if (lastConvId && conversations?.some(c => c.id === lastConvId)) {
  //     setConversationId(lastConvId);
  //   } else if (conversations && conversations.length > 0) {
  //     const mostRecent = conversations.sort((a, b) => 
  //       new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  //     )[0];
  //     setConversationId(mostRecent.id);
  //     localStorage.setItem(`last-conv-${targetId}`, mostRecent.id);
  //   }
  // }, [targetId, conversations]);

  // Create new conversation mutation
  const createConversationMutation = useMutation({
    mutationFn: async () => {
      if (!targetId) throw new Error('No target selected');
      return await apiRequest('POST', '/api/healing/conversations', {
        targetId,
        title: `New Session - ${new Date().toLocaleDateString()}`,
        status: 'active',
      });
    },
    onSuccess: (conversation: HealingConversation) => {
      setConversationId(conversation.id);
      localStorage.setItem(`last-conv-${targetId}`, conversation.id);
      queryClient.invalidateQueries({ queryKey: ['/api/healing/conversations', targetId] });
      toast({ title: 'New conversation started' });
    },
    onError: (error: any) => {
      const formatted = formatUserError(error, 'create conversation');
      toast({
        title: formatted.title,
        description: formatted.description,
        variant: 'destructive',
      });
    },
  });

  // Clear conversation mutation
  const clearConversationMutation = useMutation({
    mutationFn: async () => {
      if (!conversationId) throw new Error('No conversation selected');
      return await apiRequest('DELETE', `/api/healing/messages/${conversationId}`);
    },
    onSuccess: () => {
      setMessages([]);
      queryClient.invalidateQueries({ queryKey: ['/api/healing/messages', conversationId] });
      toast({ title: 'Chat cleared', description: 'Conversation history has been cleared' });
    },
    onError: (error: any) => {
      const formatted = formatUserError(error, 'clear chat');
      toast({
        title: formatted.title,
        description: formatted.description,
        variant: 'destructive',
      });
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

  // Send message with AI streaming
  const handleSendMessage = async () => {
    if (!input.trim() || isStreaming || !targetId) return;

    // Verify conversation belongs to current target (prevent message bleeding)
    let activeConversationId = conversationId;
    if (activeConversationId) {
      const conversation = conversations?.find(c => c.id === activeConversationId);
      if (!conversation || conversation.targetId !== targetId) {
        // Conversation doesn't belong to current target, create new one
        activeConversationId = null;
      }
    }

    // Create conversation if needed and get the ID immediately
    if (!activeConversationId) {
      const newConversation = await createConversationMutation.mutateAsync();
      activeConversationId = newConversation.id;
    }

    const userMessage = input.trim();
    setInput('');

    // Add user message immediately
    const tempUserMsg: HealingMessage = {
      id: `temp-${Date.now()}`,
      conversationId: activeConversationId,
      role: 'user',
      content: userMessage,
      createdAt: new Date().toISOString(),
    };
    setMessages(prev => [...prev, tempUserMsg]);

    // Save user message to database using the active conversation ID
    try {
      if (!activeConversationId) throw new Error('No conversation ID available');
      await apiRequest('POST', '/api/healing/messages', {
        conversationId: activeConversationId,
        role: 'user',
        content: userMessage,
      });
      queryClient.invalidateQueries({ queryKey: ['/api/healing/messages', activeConversationId] });
    } catch (error) {
      console.error('Failed to save user message:', error);
    }

    // Start streaming AI response
    setIsStreaming(true);
    setStreamingContent('');

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    try {
      const response = await fetch('/api/lomu-ai/stream', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        signal: abortController.signal,
        body: JSON.stringify({
          message: userMessage,
          projectId: targets?.find(t => t.id === targetId)?.projectId,
          autoCommit: true,
          autoPush: true,
        }),
      });

      if (!response.ok || !response.body) {
        throw new Error(`Failed to start stream: ${response.statusText}`);
      }

      // Parse SSE stream
      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let fullResponse = '';

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

              if (data.type === 'content') {
                fullResponse += data.content || '';
                setStreamingContent(fullResponse);
              } else if (data.type === 'progress') {
                // Handle inline progress messages
                const progressId = `progress-${Date.now()}-${Math.random()}`;
                setProgressMessages(prev => [
                  ...prev,
                  {
                    id: progressId,
                    message: data.message || '',
                    timestamp: Date.now(),
                  }
                ]);
              } else if (data.type === 'error') {
                throw new Error(data.error || 'Stream error');
              }
            } catch (err) {
              console.error('Failed to parse SSE event:', err);
            }
          }
        }
      }

      // Save assistant message to database (let React Query refetch to avoid duplicates)
      if (fullResponse) {
        try {
          if (!activeConversationId) throw new Error('No conversation ID available');
          await apiRequest('POST', '/api/healing/messages', {
            conversationId: activeConversationId,
            role: 'assistant',
            content: fullResponse,
          });
          // Refetch messages - React Query will update UI with the saved message
          queryClient.invalidateQueries({ queryKey: ['/api/healing/messages', activeConversationId] });
        } catch (error) {
          console.error('Failed to save assistant message:', error);
        }
      }

      setStreamingContent('');
      setProgressMessages([]); // Clear progress messages when streaming completes
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        const formatted = formatUserError(error, 'get AI response');
        toast({
          title: formatted.title,
          description: formatted.description,
          variant: 'destructive',
        });
      }
    } finally {
      setIsStreaming(false);
      abortControllerRef.current = null;
    }
  };

  // Stop streaming
  const handleStopStreaming = () => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setIsStreaming(false);
      setStreamingContent('');
      setProgressMessages([]); // Clear progress messages when stopping
    }
  };

  // Deploy mutation
  const forceDeployMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/force-deploy', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: 'Force deploy from Platform Healing' }),
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.details || error.error || 'Deploy failed');
      }
      return res.json();
    },
    onSuccess: (data: any) => {
      toast({
        title: '🚀 Deploy Successful!',
        description: `Deployed ${data.filesDeployed} files. Railway will auto-deploy in 2-3 minutes.`,
      });
    },
    onError: (error: any) => {
      const formatted = formatUserError(error, 'deploy changes');
      toast({
        title: '❌ ' + formatted.title,
        description: formatted.description,
        variant: 'destructive',
      });
    },
  });

  // Format target display name with icon
  const getTargetIcon = (type: HealingTarget['type']) => {
    switch (type) {
      case 'platform': return '🔧';
      case 'user_project': return '📦';
      case 'customer_project': return '🎯';
      default: return '📁';
    }
  };

  const selectedTarget = targets?.find(t => t.id === targetId);

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Header */}
      <div className="flex items-center gap-2 sm:gap-4 p-3 sm:p-4 border-b border-border">
        <h1 className="text-lg sm:text-xl font-bold">Platform Healing</h1>
        <Badge variant="secondary" className="text-xs bg-gradient-to-r from-blue-50 to-purple-50 text-blue-700 border-blue-200">
          Brigido 👨‍💼
        </Badge>
        
        {/* Target Selector */}
        <Select value={targetId || undefined} onValueChange={setTargetId}>
          <SelectTrigger className="w-[200px] sm:w-[280px]" data-testid="select-target">
            <SelectValue placeholder="Select target..." />
          </SelectTrigger>
          <SelectContent>
            {targetsLoading && (
              <SelectItem value="_loading" disabled>
                Loading targets...
              </SelectItem>
            )}
            {targets?.map((target) => (
              <SelectItem key={target.id} value={target.id} data-testid={`target-${target.type}`}>
                {getTargetIcon(target.type)} {target.name}
              </SelectItem>
            ))}
            {targets && targets.length === 0 && (
              <SelectItem value="_empty" disabled>
                No targets available
              </SelectItem>
            )}
          </SelectContent>
        </Select>

        {/* Workflow Analytics Link */}
        <Link href="/workflow-analytics">
          <Button
            variant="outline"
            size="sm"
            data-testid="link-workflow-analytics"
          >
            <BarChart3 className="w-4 h-4 mr-1" />
            <span className="hidden sm:inline">Analytics</span>
          </Button>
        </Link>

        {/* New Conversation Button */}
        {targetId && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => createConversationMutation.mutate()}
              disabled={createConversationMutation.isPending}
              data-testid="button-new-conversation"
            >
              <Plus className="w-4 h-4 mr-1" />
              <span className="hidden sm:inline">New</span>
            </Button>

            {/* Clear Chat Button with Confirmation */}
            {conversationId && messages.length > 0 && (
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button
                    variant="ghost"
                    size="sm"
                    data-testid="button-clear-chat"
                  >
                    <Trash2 className="w-4 h-4 sm:mr-1" />
                    <span className="hidden sm:inline">Clear</span>
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>Clear Chat History?</AlertDialogTitle>
                    <AlertDialogDescription>
                      This will clear all messages from this conversation. The history will still be saved in the database for audit purposes, but it won't be visible in the UI.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel data-testid="button-cancel-clear">Cancel</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => clearConversationMutation.mutate()}
                      disabled={clearConversationMutation.isPending}
                      data-testid="button-confirm-clear"
                    >
                      {clearConversationMutation.isPending ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          Clearing...
                        </>
                      ) : (
                        'Clear Chat'
                      )}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            )}
          </>
        )}

        <div className="ml-auto flex items-center gap-2">
          {/* Deploy Button */}
          <Button
            size="sm"
            onClick={() => forceDeployMutation.mutate()}
            disabled={forceDeployMutation.isPending}
            className="bg-gradient-to-b from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800"
            data-testid="button-force-deploy"
          >
            {forceDeployMutation.isPending ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                <Rocket className="w-4 h-4 sm:mr-1" />
                <span className="hidden sm:inline">Deploy</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Main Content - 2-Panel Layout */}
      <div className="flex-1 min-h-0">
        {!targetId ? (
          // Empty state
          <div className="h-full flex items-center justify-center p-4">
            <div className="text-center max-w-md">
              <h2 className="text-xl font-semibold mb-2">Welcome to Platform Healing</h2>
              <p className="text-muted-foreground mb-4">
                Select a target to start a conversation with Lomu, your AI healing assistant.
              </p>
              <Badge variant="outline" className="text-xs">
                Choose "🔧 Platform Code" to heal the platform itself
              </Badge>
            </div>
          </div>
        ) : (
          <ResizablePanelGroup direction="horizontal" className="h-full">
            {/* Left Panel: Chat */}
            <ResizablePanel defaultSize={60} minSize={30}>
              <div className="h-full flex flex-col">
                {/* Chat Messages */}
                <div
                  ref={scrollRef}
                  className="flex-1 overflow-y-auto p-4 space-y-4"
                  data-testid="chat-messages"
                >
                  {/* Loading state with skeleton */}
                  {messagesLoading && (
                    <div className="space-y-4">
                      {/* Skeleton for user message */}
                      <div className="flex gap-3 justify-end">
                        <div className="flex flex-col gap-1 max-w-[85%]">
                          <Skeleton className="h-16 w-64 rounded-lg" />
                          <Skeleton className="h-3 w-20 ml-auto" />
                        </div>
                      </div>
                      {/* Skeleton for AI response */}
                      <div className="flex gap-3 justify-start">
                        <div className="flex flex-col gap-1 max-w-[85%]">
                          <Skeleton className="h-32 w-96 rounded-lg" />
                          <Skeleton className="h-3 w-24" />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Empty state */}
                  {!messagesLoading && messages.length === 0 && !isStreaming && (
                    <div className="flex flex-col items-center justify-center py-12 text-center">
                      <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
                        <Activity className="w-8 h-8 text-primary" />
                      </div>
                      <h3 className="text-lg font-semibold mb-2">Ready to Help</h3>
                      <p className="text-muted-foreground max-w-sm">
                        I'm Lomu, your AI platform healing assistant. Ask me to fix bugs, improve code, or analyze issues with {selectedTarget?.name || 'the platform'}.
                      </p>
                      <div className="mt-6 flex flex-wrap gap-2 justify-center">
                        <Badge variant="outline" className="text-xs">
                          Code Analysis
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Bug Fixing
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          Auto-Commit
                        </Badge>
                      </div>
                    </div>
                  )}

                  {/* Messages */}
                  {!messagesLoading && messages
                    .filter(msg => {
                      // Hide internal tool messages (used for Gemini multi-turn but not for display)
                      const metadata = msg.metadata as any;
                      return metadata?.type !== 'tool_calls' && metadata?.type !== 'tool_results';
                    })
                    .map((msg, idx) => (
                    <div
                      key={msg.id || idx}
                      className={cn(
                        'flex gap-3',
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      <div className="flex flex-col gap-1 max-w-[85%]">
                        <div
                          className={cn(
                            'rounded-lg px-4 py-3',
                            msg.role === 'user'
                              ? 'bg-primary text-primary-foreground'
                              : 'bg-card border'
                          )}
                        >
                          {msg.role === 'user' ? (
                            <p className="text-sm leading-relaxed">{msg.content}</p>
                          ) : (
                            <MarkdownRenderer content={cleanAIResponse(parseMessageContent(msg.content))} />
                          )}
                        </div>
                        {/* Timestamp */}
                        <p 
                          className={cn(
                            "text-xs text-muted-foreground",
                            msg.role === 'user' ? 'text-right' : 'text-left'
                          )}
                        >
                          {formatDistanceToNow(new Date(msg.createdAt), { addSuffix: true })}
                        </p>
                      </div>
                    </div>
                  ))}

                  {/* Progress Messages - Inline step-by-step updates */}
                  {progressMessages.length > 0 && (
                    <div className="flex flex-col gap-2">
                      {progressMessages.map((progress) => (
                        <div key={progress.id} className="flex gap-3 justify-start">
                          <div className="max-w-[75%] rounded-lg px-3 py-2 bg-muted/50 border border-muted-foreground/20">
                            <p className="text-xs text-muted-foreground leading-relaxed">{progress.message}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Streaming message */}
                  {isStreaming && streamingContent && (
                    <div className="flex gap-3 justify-start">
                      <div className="max-w-[85%] rounded-lg px-4 py-3 bg-card border">
                        <MarkdownRenderer content={cleanAIResponse(streamingContent)} />
                      </div>
                    </div>
                  )}

                  {/* Typing indicator */}
                  {isStreaming && !streamingContent && (
                    <div className="flex gap-3 justify-start">
                      <div className="max-w-[80%] rounded-lg px-4 py-3 bg-muted border">
                        <div className="flex items-center gap-2">
                          <div className="flex gap-1">
                            <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-2 h-2 rounded-full bg-primary/60 animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </div>
                          <p className="text-sm text-muted-foreground">Lomu is thinking...</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Task Progress Indicator */}
                  {isStreaming && tasks.length > 0 && (
                    <div className="px-4 py-2 flex justify-center">
                      <Badge variant="secondary" className="text-xs gap-1.5" data-testid="badge-task-progress">
                        {tasks.filter(t => t.status === 'completed').length === tasks.length ? '✓' : '⏳'}
                        <span>
                          {tasks.filter(t => t.status === 'completed').length}/{tasks.length} tasks
                        </span>
                      </Badge>
                    </div>
                  )}
                </div>

                {/* Input Box */}
                <div className="p-4 border-t border-border">
                  {/* Image Preview Section */}
                  {(pendingImages.length > 0 || uploadingImages.size > 0) && (
                    <div className="mb-3 flex flex-wrap gap-2">
                      {/* Show uploading images with loading spinner */}
                      {Array.from(uploadingImages.keys()).map((tempId) => (
                        <div key={tempId} className="relative">
                          <div className="h-20 w-20 rounded border border-border bg-muted flex items-center justify-center">
                            <Loader2 className="w-6 h-6 animate-spin text-primary" />
                          </div>
                          <div className="absolute inset-0 flex items-center justify-center">
                            <span className="text-xs text-muted-foreground bg-background/80 px-2 py-1 rounded">
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
                            className="h-20 w-20 object-cover rounded border border-border"
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

                  <div className="flex gap-2">
                    <div className="flex-1 relative">
                      <Textarea
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            handleSendMessage();
                          }
                        }}
                        onPaste={handlePaste}
                        placeholder={
                          conversationId
                            ? 'Ask Lomu anything...'
                            : 'Start a new conversation...'
                        }
                        className="min-h-[60px] resize-none pr-12"
                        disabled={isStreaming}
                        data-testid="input-message"
                      />
                      <div className="absolute bottom-2 right-2">
                        <ChatInputToolbar
                          onImageSelect={handleImageSelect}
                          disabled={isStreaming}
                        />
                      </div>
                    </div>
                    <div className="flex flex-col gap-2">
                      {isStreaming ? (
                        <Button
                          variant="outline"
                          size="icon"
                          onClick={handleStopStreaming}
                          data-testid="button-stop"
                        >
                          <div className="w-3 h-3 bg-destructive rounded-sm" />
                        </Button>
                      ) : (
                        <Button
                          size="icon"
                          onClick={handleSendMessage}
                          disabled={!input.trim()}
                          data-testid="button-send"
                        >
                          <Send className="w-4 h-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </ResizablePanel>

            <ResizableHandle className="hidden md:flex" />

            {/* Right Panel: Tasks, Info & Log Tabs (Desktop only) */}
            <ResizablePanel defaultSize={40} minSize={30} className="hidden md:block">
              <Tabs defaultValue={tasks.length > 0 ? "tasks" : "info"} className="h-full flex flex-col">
                <TabsList className="mx-4 mt-4">
                  <TabsTrigger value="tasks" data-testid="tab-tasks">
                    <ListTodo className="w-4 h-4 mr-1.5" />
                    Tasks {tasks.length > 0 && `(${tasks.length})`}
                  </TabsTrigger>
                  <TabsTrigger value="info" data-testid="tab-info">Info</TabsTrigger>
                  <TabsTrigger value="log" data-testid="tab-log">Log</TabsTrigger>
                </TabsList>

                {/* Tasks Tab */}
                <TabsContent value="tasks" className="flex-1 overflow-y-auto mt-0">
                  <div className="p-4">
                    <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
                      <ListTodo className="w-5 h-5" />
                      Agent Tasks
                    </h3>
                    {tasks.length > 0 ? (
                      <AgentTaskList tasks={tasks} />
                    ) : (
                      <div className="text-center py-8 text-muted-foreground">
                        <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-20" />
                        <p className="text-sm">No active tasks</p>
                        <p className="text-xs mt-1">Tasks will appear here when Lomu starts working</p>
                      </div>
                    )}
                  </div>
                </TabsContent>

                {/* Info Tab */}
                <TabsContent value="info" className="flex-1 overflow-y-auto p-4 mt-0">
                  <h3 className="text-lg font-semibold mb-4">Target Info</h3>
                  {selectedTarget && (
                    <div className="space-y-3">
                      <div>
                        <p className="text-sm text-muted-foreground">Type</p>
                        <p className="font-medium">
                          {getTargetIcon(selectedTarget.type)} {selectedTarget.type}
                        </p>
                      </div>
                      <div>
                        <p className="text-sm text-muted-foreground">Name</p>
                        <p className="font-medium">{selectedTarget.name}</p>
                      </div>
                      {conversations && conversations.length > 0 && (
                        <div>
                          <p className="text-sm text-muted-foreground mb-2">Recent Conversations</p>
                          <div className="space-y-1">
                            {conversations
                              .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())
                              .slice(0, 5)
                              .map((conv) => (
                                <button
                                  key={conv.id}
                                  onClick={() => {
                                    setConversationId(conv.id);
                                    localStorage.setItem(`last-conv-${targetId}`, conv.id);
                                  }}
                                  className={cn(
                                    'w-full text-left text-sm p-2 rounded hover-elevate active-elevate-2',
                                    conv.id === conversationId ? 'bg-accent' : 'bg-card'
                                  )}
                                  data-testid={`conversation-${conv.id}`}
                                >
                                  <p className="font-medium truncate">{conv.title}</p>
                                  <p className="text-xs text-muted-foreground">
                                    {new Date(conv.updatedAt).toLocaleDateString()}
                                  </p>
                                </button>
                              ))}
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </TabsContent>

                {/* Log Tab */}
                <TabsContent value="log" className="flex-1 overflow-hidden mt-0">
                  <DiagnosticsLog />
                </TabsContent>
              </Tabs>
            </ResizablePanel>
          </ResizablePanelGroup>
        )}
      </div>

      {/* Floating Task Button (Mobile Only) */}
      {tasks.length > 0 && (
        <div className="md:hidden fixed bottom-20 right-4 z-50 w-14 h-14 flex items-center justify-center">
          <Button
            size="icon"
            onClick={() => setShowTaskDrawer(true)}
            className="bg-primary text-primary-foreground hover-elevate shadow-lg rounded-full w-full h-full"
            aria-label="View active tasks"
            data-testid="button-mobile-tasks"
          >
            <div className="relative">
              <ListTodo className="w-6 h-6" />
              {tasks.length > 0 && (
                <span className="absolute -top-2 -right-2 bg-accent text-accent-foreground text-xs font-bold rounded-full w-5 h-5 flex items-center justify-center">
                  {tasks.length}
                </span>
              )}
            </div>
          </Button>
        </div>
      )}

      {/* Slide-Up Task Drawer (Mobile Only) */}
      <Sheet open={showTaskDrawer} onOpenChange={setShowTaskDrawer}>
        <SheetContent 
          side="bottom" 
          className="md:hidden max-h-[80vh] rounded-t-2xl p-0"
          data-testid="drawer-tasks"
        >
          <SheetHeader className="p-4 border-b">
            <div className="flex items-center gap-2">
              <ListTodo className="w-5 h-5 text-primary" />
              <SheetTitle>Agent Tasks</SheetTitle>
              {tasks.length > 0 && (
                <Badge variant="secondary">
                  {tasks.length}
                </Badge>
              )}
            </div>
          </SheetHeader>
          
          <div className="overflow-y-auto max-h-[calc(80vh-5rem)] p-2">
            {tasks.length > 0 ? (
              <AgentTaskList tasks={tasks} />
            ) : (
              <div className="text-center py-8 text-muted-foreground">
                <ListTodo className="w-12 h-12 mx-auto mb-3 opacity-20" />
                <p className="text-sm">No active tasks</p>
                <p className="text-xs mt-1">Tasks will appear here when Lomu starts working</p>
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
}

// Diagnostics Log Component
function DiagnosticsLog() {
  const [autoRefresh, setAutoRefresh] = useState(true);

  const { data: activityLog, isLoading, refetch } = useQuery({
    queryKey: ['/api/diagnostics/activity'],
    queryFn: async () => {
      const res = await fetch('/api/diagnostics/activity', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load activity log');
      return res.json();
    },
    refetchInterval: autoRefresh ? 5000 : false, // Auto-refresh every 5 seconds if enabled
  });

  const getSeverityIcon = (severity: string) => {
    switch (severity) {
      case 'success': return <CheckCircle className="w-4 h-4 text-green-500" />;
      case 'error': return <AlertCircle className="w-4 h-4 text-red-500" />;
      case 'info': return <Activity className="w-4 h-4 text-blue-500" />;
      case 'high':
      case 'medium': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
      default: return <Activity className="w-4 h-4" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'success': return 'bg-green-500/10 border-green-500/20 text-green-700 dark:text-green-400';
      case 'error': return 'bg-red-500/10 border-red-500/20 text-red-700 dark:text-red-400';
      case 'info': return 'bg-blue-500/10 border-blue-500/20 text-blue-700 dark:text-blue-400';
      case 'high': return 'bg-orange-500/10 border-orange-500/20 text-orange-700 dark:text-orange-400';
      case 'medium': return 'bg-yellow-500/10 border-yellow-500/20 text-yellow-700 dark:text-yellow-400';
      default: return 'bg-muted/50 border-border';
    }
  };

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Header */}
      <div className="p-4 border-b flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">Platform Activity Log</h3>
          {activityLog && (
            <p className="text-xs text-muted-foreground mt-1">
              {activityLog.openIncidents} open incidents • {activityLog.recentSessions} recent sessions
            </p>
          )}
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => refetch()}
          disabled={isLoading}
          data-testid="button-refresh-log"
        >
          <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
        </Button>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {isLoading && !activityLog ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          </div>
        ) : activityLog?.activities && activityLog.activities.length > 0 ? (
          <>
            {activityLog.activities.map((activity: any, i: number) => (
              <div
                key={i}
                className={cn(
                  'rounded-lg p-4 space-y-2 text-sm border',
                  getSeverityColor(activity.severity)
                )}
              >
                <div className="flex items-start gap-3">
                  {getSeverityIcon(activity.severity)}
                  <div className="flex-1 space-y-2">
                    {/* Title and timestamp */}
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-semibold">{activity.title}</p>
                      <p className="text-xs opacity-70 whitespace-nowrap">
                        {new Date(activity.timestamp).toLocaleTimeString()}
                      </p>
                    </div>

                    {/* Message */}
                    <p className="text-sm">{activity.message}</p>

                    {/* Details */}
                    {activity.details && (
                      <div className="bg-black/5 dark:bg-white/5 rounded p-2 space-y-1 text-xs">
                        {activity.details.strategy && (
                          <p>• <span className="font-medium">AI Strategy:</span> {activity.details.strategy}</p>
                        )}
                        {activity.details.filesModified !== undefined && (
                          <p>• <span className="font-medium">Files Modified:</span> {activity.details.filesModified}</p>
                        )}
                        {activity.details.commitHash && (
                          <p>• <span className="font-medium">Commit:</span> {activity.details.commitHash}</p>
                        )}
                        {activity.details.phase && (
                          <p>• <span className="font-medium">Phase:</span> {activity.details.phase}</p>
                        )}
                      </div>
                    )}

                    {/* Action */}
                    {activity.action && (
                      <p className="text-xs font-medium opacity-80">
                        → {activity.action}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}

            {/* Timestamp */}
            <p className="text-xs text-muted-foreground text-center pt-2">
              Last updated: {new Date(activityLog.timestamp).toLocaleTimeString()}
            </p>
          </>
        ) : (
          <div className="text-center py-8 space-y-2">
            <Activity className="w-8 h-8 mx-auto text-muted-foreground/50" />
            <p className="text-sm text-muted-foreground">No recent activity</p>
            <p className="text-xs text-muted-foreground">
              Platform healing sessions and incidents will appear here
            </p>
          </div>
        )}
      </div>
    </div>
  );
}

// Export with admin guard
export default function PlatformHealing() {
  return (
    <AdminGuard>
      <PlatformHealingContent />
    </AdminGuard>
  );
}
