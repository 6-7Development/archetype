import { useState, useEffect, useRef } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { MonacoEditor } from "@/components/monaco-editor";
import { FileExplorer } from "@/components/file-explorer";
import { AiChatPanel } from "@/components/ai-chat-panel";
import { NewFileDialog } from "@/components/new-file-dialog";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { Card } from "@/components/ui/card";
import { Code2, MessageSquare, Save, Loader2, FileCode, Sparkles } from "lucide-react";
import type { File, ChatMessage } from "@shared/schema";
import { apiRequest, queryClient } from "@/lib/queryClient";

export default function IDE() {
  const [activeFile, setActiveFile] = useState<File | null>(null);
  const [editorContent, setEditorContent] = useState("");
  const [showChat, setShowChat] = useState(false);
  const [newFileDialogOpen, setNewFileDialogOpen] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const { toast } = useToast();

  const { data: files = [] } = useQuery<File[]>({
    queryKey: ["/api/files"],
  });

  const { data: chatMessages = [] } = useQuery<ChatMessage[]>({
    queryKey: ["/api/chat/messages", activeFile?.id],
    enabled: !!activeFile?.id,
  });

  const createFileMutation = useMutation<File, Error, { filename: string; language: string; userId: string; content: string }>({
    mutationFn: async (data) => {
      return await apiRequest<File>("POST", "/api/files", data);
    },
    onSuccess: (newFile) => {
      queryClient.invalidateQueries({ queryKey: ["/api/files"] });
      setActiveFile(newFile);
      setEditorContent(newFile.content);
      toast({ description: "File created successfully" });
    },
  });

  const saveFileMutation = useMutation<File, Error, { id: string; content: string }>({
    mutationFn: async (data) => {
      return await apiRequest<File>("PUT", `/api/files/${data.id}`, { content: data.content });
    },
    onSuccess: (updatedFile) => {
      queryClient.setQueryData<File[]>(["/api/files"], (oldFiles) => {
        if (!oldFiles) return oldFiles;
        return oldFiles.map((file) =>
          file.id === updatedFile.id ? updatedFile : file
        );
      });
      
      setActiveFile((prev) => prev?.id === updatedFile.id ? updatedFile : prev);
      
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'file-update',
          fileId: updatedFile.id,
          content: updatedFile.content,
        }));
      }
      
      toast({ description: "File saved successfully" });
    },
  });

  const chatMutation = useMutation<{ code: string; message: string }, Error, { prompt: string; fileContent: string; fileId: string; userId: string }>({
    mutationFn: async (data) => {
      return await apiRequest<{ code: string; message: string }>("POST", "/api/ai-chat", data);
    },
    onSuccess: (data) => {
      setEditorContent(data.code);
      queryClient.invalidateQueries({ queryKey: ["/api/chat/messages", activeFile?.id] });
    },
  });

  useEffect(() => {
    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = `${protocol}//${window.location.host}/ws`;
    
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      console.log('WebSocket connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        
        if (data.type === 'file-updated') {
          queryClient.setQueryData<File[]>(["/api/files"], (oldFiles) => {
            if (!oldFiles) return oldFiles;
            return oldFiles.map((file) =>
              file.id === data.fileId
                ? { ...file, content: data.content }
                : file
            );
          });
          
          setActiveFile((prev) => {
            if (prev && prev.id === data.fileId) {
              setEditorContent(data.content);
              toast({ description: "File updated by another user" });
              return { ...prev, content: data.content };
            }
            return prev;
          });
        }
      } catch (error) {
        console.error('WebSocket message error:', error);
      }
    };

    ws.onerror = (error) => {
      console.error('WebSocket error:', error);
    };

    ws.onclose = () => {
      console.log('WebSocket disconnected');
    };

    return () => {
      ws.close();
    };
  }, [toast]);

  useEffect(() => {
    if (activeFile) {
      setEditorContent(activeFile.content);
    }
  }, [activeFile]);

  const handleCreateFile = (filename: string, language: string) => {
    createFileMutation.mutate({
      filename,
      language,
      userId: "demo-user",
      content: "",
    });
  };

  const handleFileSelect = (file: File) => {
    if (activeFile && editorContent !== activeFile.content) {
      saveFileMutation.mutate({
        id: activeFile.id,
        content: editorContent,
      });
    }
    setActiveFile(file);
  };

  const handleSave = () => {
    if (activeFile) {
      saveFileMutation.mutate({
        id: activeFile.id,
        content: editorContent,
      });
    }
  };

  const handleSendMessage = (content: string) => {
    if (activeFile) {
      chatMutation.mutate({
        prompt: content,
        fileContent: editorContent,
        fileId: activeFile.id,
        userId: "demo-user",
      });
    }
  };

  return (
    <div className="h-screen flex flex-col bg-background">
      {/* Professional Top Navigation */}
      <header className="h-14 border-b border-border bg-card shadow-sm flex items-center justify-between px-6">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-primary/10 rounded-lg">
              <Code2 className="h-5 w-5 text-primary" data-testid="icon-logo" />
            </div>
            <div>
              <h1 className="font-semibold text-base tracking-tight" data-testid="text-app-name">CodeIDE</h1>
              <p className="text-xs text-muted-foreground">Enterprise Web IDE</p>
            </div>
          </div>
          {activeFile && (
            <div className="flex items-center gap-2 ml-6 pl-6 border-l border-border">
              <FileCode className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium" data-testid="text-active-file">
                {activeFile.filename}
              </span>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="default"
            onClick={() => setShowChat(!showChat)}
            className="gap-2"
            data-testid="button-toggle-chat"
          >
            <Sparkles className="h-4 w-4" />
            AI Assistant
          </Button>
          <Button
            variant="default"
            size="default"
            onClick={handleSave}
            disabled={!activeFile || saveFileMutation.isPending}
            className="gap-2 shadow-md hover:shadow-lg transition-all"
            data-testid="button-save-file"
          >
            {saveFileMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Save className="h-4 w-4" />
            )}
            Save
          </Button>
          <ThemeToggle />
        </div>
      </header>

      {/* Main IDE Workspace */}
      <div className="flex-1 flex overflow-hidden p-4 gap-4">
        {/* File Explorer Card */}
        <Card className="w-80 flex flex-col shadow-lg border-card-border overflow-hidden">
          <FileExplorer
            files={files}
            activeFileId={activeFile?.id || null}
            onFileSelect={handleFileSelect}
            onCreateFile={() => setNewFileDialogOpen(true)}
          />
        </Card>

        {/* Editor Card */}
        <Card className="flex-1 flex flex-col shadow-lg border-card-border overflow-hidden">
          {activeFile ? (
            <MonacoEditor
              value={editorContent}
              onChange={(value) => setEditorContent(value || "")}
              language={activeFile.language}
            />
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-center p-8">
              <div className="p-6 bg-primary/10 rounded-2xl mb-6">
                <Code2 className="h-16 w-16 text-primary" />
              </div>
              <h2 className="text-2xl font-semibold mb-3 tracking-tight">Welcome to CodeIDE</h2>
              <p className="text-sm text-muted-foreground max-w-md leading-relaxed">
                Create a new file or select an existing one from the file explorer to start coding with AI assistance.
              </p>
            </div>
          )}
        </Card>

        {/* AI Chat Panel Card */}
        {showChat && (
          <Card className="w-[420px] flex flex-col shadow-xl border-card-border overflow-hidden">
            <AiChatPanel
              messages={chatMessages}
              onSendMessage={handleSendMessage}
              isLoading={chatMutation.isPending}
              onClose={() => setShowChat(false)}
            />
          </Card>
        )}
      </div>

      {/* Professional Status Bar */}
      <footer className="h-8 border-t border-border bg-card shadow-inner flex items-center justify-between px-6">
        <div className="flex items-center gap-6">
          <div className="flex items-center gap-2">
            <div className={`w-2 h-2 rounded-full ${wsRef.current?.readyState === WebSocket.OPEN ? 'bg-green-500' : 'bg-gray-400'}`} data-testid="status-connection" />
            <span className="text-xs text-muted-foreground font-medium">
              {wsRef.current?.readyState === WebSocket.OPEN ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          {activeFile && (
            <span className="text-xs text-muted-foreground font-medium uppercase tracking-wide" data-testid="text-language">
              {activeFile.language}
            </span>
          )}
        </div>
        <div className="flex items-center gap-6">
          <span className="text-xs text-muted-foreground" data-testid="text-file-count">
            {files.length} {files.length === 1 ? 'File' : 'Files'}
          </span>
        </div>
      </footer>

      <NewFileDialog
        open={newFileDialogOpen}
        onOpenChange={setNewFileDialogOpen}
        onCreateFile={handleCreateFile}
      />
    </div>
  );
}
