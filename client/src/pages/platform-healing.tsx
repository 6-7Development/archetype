import { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { apiRequest, queryClient } from '@/lib/queryClient';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { AdminGuard } from '@/components/admin-guard';
import { LomuAvatar } from '@/components/lomu-avatar';
import { ResizableHandle, ResizablePanel, ResizablePanelGroup } from '@/components/ui/resizable';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Send, Upload, Rocket, Plus, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  createdAt: string;
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

  // Load healing targets
  const { data: targets, isLoading: targetsLoading } = useQuery<HealingTarget[]>({
    queryKey: ['/api/healing/targets'],
    queryFn: async () => {
      const res = await fetch('/api/healing/targets', { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to load targets');
      return res.json();
    },
  });

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
  const { data: loadedMessages } = useQuery<HealingMessage[]>({
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
  }, [targetId]);

  // Resume last conversation on target change
  useEffect(() => {
    if (!targetId) return;

    // Try to resume last conversation from localStorage
    const lastConvId = localStorage.getItem(`last-conv-${targetId}`);
    if (lastConvId && conversations?.some(c => c.id === lastConvId)) {
      setConversationId(lastConvId);
    } else if (conversations && conversations.length > 0) {
      // Otherwise, load most recent conversation
      const mostRecent = conversations.sort((a, b) => 
        new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
      )[0];
      setConversationId(mostRecent.id);
      localStorage.setItem(`last-conv-${targetId}`, mostRecent.id);
    }
  }, [targetId, conversations]);

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
      toast({
        title: 'Failed to create conversation',
        description: error.message,
        variant: 'destructive',
      });
    },
  });

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
    } catch (error: any) {
      if (error.name !== 'AbortError') {
        toast({
          title: 'Failed to get response',
          description: error.message,
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
      toast({
        title: '❌ Deploy Failed',
        description: error.message || 'Failed to deploy changes',
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

        {/* New Conversation Button */}
        {targetId && (
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
              <LomuAvatar expression="default" size="large" className="mx-auto mb-4" />
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
                  {messages.length === 0 && !isStreaming && (
                    <div className="text-center text-muted-foreground py-8">
                      <LomuAvatar expression="happy" size="medium" className="mx-auto mb-3" />
                      <p>Hi! I'm Lomu. Ask me anything about this target.</p>
                    </div>
                  )}

                  {messages.map((msg, idx) => (
                    <div
                      key={msg.id || idx}
                      className={cn(
                        'flex gap-3',
                        msg.role === 'user' ? 'justify-end' : 'justify-start'
                      )}
                    >
                      {msg.role === 'assistant' && (
                        <LomuAvatar expression="happy" size="small" className="flex-shrink-0" />
                      )}
                      <div
                        className={cn(
                          'max-w-[80%] rounded-lg px-4 py-2',
                          msg.role === 'user'
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted'
                        )}
                      >
                        <p className="text-sm whitespace-pre-wrap">{msg.content}</p>
                      </div>
                    </div>
                  ))}

                  {/* Streaming message */}
                  {isStreaming && streamingContent && (
                    <div className="flex gap-3 justify-start">
                      <LomuAvatar expression="default" size="small" className="flex-shrink-0" />
                      <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                        <p className="text-sm whitespace-pre-wrap">{streamingContent}</p>
                      </div>
                    </div>
                  )}

                  {/* Typing indicator */}
                  {isStreaming && !streamingContent && (
                    <div className="flex gap-3 justify-start">
                      <LomuAvatar expression="default" size="small" className="flex-shrink-0" />
                      <div className="max-w-[80%] rounded-lg px-4 py-2 bg-muted">
                        <p className="text-sm text-muted-foreground">Lomu is working...</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Input Box */}
                <div className="p-4 border-t border-border">
                  <div className="flex gap-2">
                    <Textarea
                      value={input}
                      onChange={(e) => setInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' && !e.shiftKey) {
                          e.preventDefault();
                          handleSendMessage();
                        }
                      }}
                      placeholder={
                        conversationId
                          ? 'Ask Lomu anything...'
                          : 'Start a new conversation...'
                      }
                      className="min-h-[60px] resize-none"
                      disabled={isStreaming}
                      data-testid="input-message"
                    />
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

            {/* Right Panel: Context/Preview (Desktop only) */}
            <ResizablePanel defaultSize={40} minSize={30} className="hidden md:block">
              <div className="h-full p-4 overflow-y-auto bg-muted/20">
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
              </div>
            </ResizablePanel>
          </ResizablePanelGroup>
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
