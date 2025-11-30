import { useState } from "react";
import { MonacoEditor } from "@/components/monaco-editor";
import { LivePreview } from "@/components/live-preview";
import { UniversalChat } from "@/components/universal-chat";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { FileCode, Eye, Bot, Plus, Trash, Sparkles } from "lucide-react";

interface FileData {
  id: string;
  filename: string;
  content: string;
  language: string;
}

interface MobileWorkspaceProps {
  projectId: string | null;
  files: FileData[];
  activeFile: FileData | null;
  onFileSelect: (file: FileData) => void;
  onFileCreate: () => void;
  onFileUpdate: (fileId: string, content: string) => Promise<void>;
  onFileDelete: (fileId: string) => void;
}

export function MobileWorkspace({
  projectId,
  files,
  activeFile,
  onFileSelect,
  onFileCreate,
  onFileUpdate,
  onFileDelete
}: MobileWorkspaceProps) {
  const [activeTab, setActiveTab] = useState("editor");
  const [editorContent, setEditorContent] = useState(activeFile?.content || "");

  const handleEditorChange = (value: string | undefined) => {
    setEditorContent(value || "");
  };

  const handleSave = async () => {
    if (activeFile) {
      await onFileUpdate(activeFile.id, editorContent);
    }
  };

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="border-b bg-card p-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          {activeFile && (
            <>
              <FileCode className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">{activeFile.filename}</span>
            </>
          )}
        </div>
        <div className="flex items-center gap-1">
          <Button size="sm" variant="ghost" onClick={handleSave} data-testid="button-save-mobile">
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={onFileCreate} data-testid="button-new-file-mobile">
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          <TabsList className="w-full rounded-none border-b bg-background">
            <TabsTrigger value="files" className="flex-1" data-testid="tab-files-mobile">
              <FileCode className="h-4 w-4 mr-1" />
              Files
            </TabsTrigger>
            <TabsTrigger value="editor" className="flex-1" data-testid="tab-editor-mobile">
              <FileCode className="h-4 w-4 mr-1" />
              Editor
            </TabsTrigger>
            <TabsTrigger value="preview" className="flex-1" data-testid="tab-preview-mobile">
              <Eye className="h-4 w-4 mr-1" />
              Preview
            </TabsTrigger>
            <TabsTrigger value="chat" className="flex-1" data-testid="tab-chat-mobile">
              <Bot className="h-4 w-4 mr-1" />
              BeeHiveAI
            </TabsTrigger>
          </TabsList>

          <TabsContent value="files" className="flex-1 m-0 overflow-hidden">
            <ScrollArea className="h-full">
              <div className="p-2 space-y-1">
                {files.map((file) => (
                  <div
                    key={file.id}
                    className={`p-3 rounded-md cursor-pointer flex items-center justify-between hover-elevate ${
                      activeFile?.id === file.id ? 'bg-accent' : ''
                    }`}
                    onClick={() => {
                      onFileSelect(file);
                      setEditorContent(file.content);
                      setActiveTab("editor");
                    }}
                    data-testid={`file-item-${file.id}`}
                  >
                    <div className="flex items-center gap-2">
                      <FileCode className="h-4 w-4 text-muted-foreground" />
                      <span className="text-sm">{file.filename}</span>
                    </div>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={(e) => {
                        e.stopPropagation();
                        onFileDelete(file.id);
                      }}
                      data-testid={`button-delete-file-${file.id}`}
                    >
                      <Trash className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {files.length === 0 && (
                  <div className="text-center text-muted-foreground py-8">
                    <p className="text-sm">No files yet</p>
                    <Button size="sm" variant="outline" onClick={onFileCreate} className="mt-2">
                      Create your first file
                    </Button>
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>

          <TabsContent value="editor" className="flex-1 m-0 overflow-hidden">
            {activeFile ? (
              <MonacoEditor
                language={activeFile.language}
                value={editorContent}
                onChange={handleEditorChange}
              />
            ) : (
              <div className="h-full flex items-center justify-center text-muted-foreground">
                <div className="text-center">
                  <FileCode className="h-12 w-12 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No file selected</p>
                  <Button size="sm" variant="outline" onClick={() => setActiveTab("files")} className="mt-2">
                    Browse files
                  </Button>
                </div>
              </div>
            )}
          </TabsContent>

          <TabsContent value="preview" className="flex-1 m-0 overflow-hidden">
            {projectId ? (
              <LivePreview projectId={projectId} />
            ) : (
              <div className="h-full flex items-center justify-center p-4">
                <Card>
                  <CardContent className="pt-6 text-center">
                    <div className="space-y-2">
                      <Eye className="w-12 h-12 text-muted-foreground mx-auto" />
                      <h3 className="font-semibold">No Active Project</h3>
                      <p className="text-sm text-muted-foreground">
                        Open a project to see the live preview
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>

          <TabsContent value="chat" className="flex-1 m-0 overflow-hidden">
            {projectId ? (
              <UniversalChat 
                targetContext="project"
                projectId={projectId}
                onProjectGenerated={(result) => {
                  console.log('[MOBILE] Project generated:', result);
                }}
              />
            ) : (
              <div className="h-full flex items-center justify-center p-4">
                <Card>
                  <CardContent className="pt-6">
                    <div className="text-center space-y-4">
                      <Sparkles className="w-12 h-12 text-muted-foreground mx-auto" />
                      <div>
                        <h3 className="font-semibold mb-2">No Active Project</h3>
                        <p className="text-sm text-muted-foreground">
                          Open a project to start coding with BeeHiveAI
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  );
}
