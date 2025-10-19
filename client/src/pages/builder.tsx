import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AIChat } from "@/components/ai-chat";
import { ProjectUpload } from "@/components/project-upload";
import { ThemeToggle } from "@/components/theme-toggle";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card } from "@/components/ui/card";
import { 
  Sparkles, 
  LayoutDashboard, 
  Code, 
  FolderTree, 
  Eye,
  Activity,
  History
} from "lucide-react";
import { Command } from "@shared/schema";
import VersionHistory from "./version-history";

export default function Builder() {
  const [activeTab, setActiveTab] = useState("build");
  const [currentProjectId, setCurrentProjectId] = useState<string | null>(null);

  const { data: commands = [] } = useQuery<Command[]>({
    queryKey: ["/api/commands"],
  });

  const handleProjectGenerated = (result: any) => {
    if (result?.projectId) {
      setCurrentProjectId(result.projectId);
    }
  };

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Mobile-First Top Bar */}
      <header className="h-14 border-b bg-card flex items-center justify-between px-3 md:px-4" data-testid="header-builder">
        <div className="flex items-center gap-2 md:gap-3">
          {/* Archetype Logo Button - Icon only on mobile (44px touch target) */}
          <Button 
            variant="default" 
            className="bg-primary hover:bg-primary/90 gap-2 font-semibold min-h-[44px] min-w-[44px] md:min-w-auto px-2 md:px-4"
            data-testid="button-archetype-logo"
          >
            <Sparkles className="w-4 h-4" />
            <span className="hidden md:inline">Archetype</span>
          </Button>
          
          {/* SySop AI Badge - Hidden on very small screens */}
          <Badge 
            variant="secondary" 
            className="hidden sm:inline-flex bg-primary/10 text-primary border-primary/20 font-mono text-xs md:text-sm"
            data-testid="badge-sysop-ai"
          >
            SySop AI
          </Badge>
        </div>

        {/* Theme Toggle */}
        <ThemeToggle />
      </header>

      {/* Tab-Based Navigation (Replit Style) */}
      <div className="flex-1 overflow-hidden">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="h-full flex flex-col">
          {/* Tab Bar - Mobile Optimized (Icon-only < 640px) */}
          <div className="border-b bg-card px-2 sm:px-4">
            <TabsList className="bg-transparent h-12 p-0 gap-1 sm:gap-2 w-full justify-start overflow-x-auto" data-testid="tabs-main">
              <TabsTrigger 
                value="overview" 
                className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-2 rounded-t rounded-b-none min-h-[44px] min-w-[44px] px-3 sm:px-4 flex-shrink-0"
                data-testid="tab-overview"
              >
                <LayoutDashboard className="w-4 h-4" />
                <span className="hidden sm:inline">Overview</span>
              </TabsTrigger>
              <TabsTrigger 
                value="build" 
                className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-2 rounded-t rounded-b-none min-h-[44px] min-w-[44px] px-3 sm:px-4 flex-shrink-0"
                data-testid="tab-build"
              >
                <Code className="w-4 h-4" />
                <span className="hidden sm:inline">Build</span>
              </TabsTrigger>
              <TabsTrigger 
                value="files" 
                className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-2 rounded-t rounded-b-none min-h-[44px] min-w-[44px] px-3 sm:px-4 flex-shrink-0"
                data-testid="tab-files"
              >
                <FolderTree className="w-4 h-4" />
                <span className="hidden sm:inline">Files</span>
              </TabsTrigger>
              <TabsTrigger 
                value="preview" 
                className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-2 rounded-t rounded-b-none min-h-[44px] min-w-[44px] px-3 sm:px-4 flex-shrink-0"
                data-testid="tab-preview"
              >
                <Eye className="w-4 h-4" />
                <span className="hidden sm:inline">Preview</span>
              </TabsTrigger>
              <TabsTrigger 
                value="activity" 
                className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-2 rounded-t rounded-b-none min-h-[44px] min-w-[44px] px-3 sm:px-4 flex-shrink-0"
                data-testid="tab-activity"
              >
                <Activity className="w-4 h-4" />
                <span className="hidden sm:inline">Activity</span>
              </TabsTrigger>
              <TabsTrigger 
                value="versions" 
                className="data-[state=active]:bg-accent data-[state=active]:text-accent-foreground gap-2 rounded-t rounded-b-none min-h-[44px] min-w-[44px] px-3 sm:px-4 flex-shrink-0"
                data-testid="tab-versions"
              >
                <History className="w-4 h-4" />
                <span className="hidden sm:inline">Versions</span>
              </TabsTrigger>
            </TabsList>
          </div>

          {/* Tab Content - Mobile Optimized Padding */}
          <div className="flex-1 overflow-hidden">
            {/* Overview Tab */}
            <TabsContent value="overview" className="h-full m-0 p-3 sm:p-6" data-testid="content-overview">
              <Card className="p-4 sm:p-6">
                <h2 className="text-2xl font-bold mb-4">Welcome to Archetype</h2>
                <p className="text-muted-foreground mb-4">
                  Build complete web applications using natural language commands powered by Claude Sonnet 4.
                </p>
                <div className="space-y-2">
                  <p className="text-sm">✨ Generate full-stack applications</p>
                  <p className="text-sm">🎨 Professional designs by default</p>
                  <p className="text-sm">🚀 Deploy with one click</p>
                  <p className="text-sm">💬 Chat with AI to refine your project</p>
                </div>
              </Card>
            </TabsContent>

            {/* Build Tab (Main Interface) */}
            <TabsContent value="build" className="h-full m-0" data-testid="content-build">
              <div className="h-full flex flex-col bg-muted/20">
                {/* Project Upload Section */}
                <div className="p-3 sm:p-4 border-b bg-card">
                  <ProjectUpload />
                </div>
                
                {/* AI Chat Component (Full Height) */}
                <div className="flex-1 overflow-hidden">
                  <AIChat onProjectGenerated={handleProjectGenerated} />
                </div>
              </div>
            </TabsContent>

            {/* Files Tab */}
            <TabsContent value="files" className="h-full m-0 p-3 sm:p-6" data-testid="content-files">
              <Card className="p-4 sm:p-6">
                <h2 className="text-xl font-semibold mb-4">Project Files</h2>
                {commands.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No files yet. Use the Build tab to generate your first project.
                  </p>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    {commands.length} command{commands.length !== 1 ? 's' : ''} in history
                  </p>
                )}
              </Card>
            </TabsContent>

            {/* Preview Tab */}
            <TabsContent value="preview" className="h-full m-0 p-3 sm:p-6" data-testid="content-preview">
              <Card className="p-4 sm:p-6">
                <h2 className="text-xl font-semibold mb-4">Live Preview</h2>
                <p className="text-muted-foreground text-center py-8">
                  Generate a project in the Build tab to see a live preview here.
                </p>
              </Card>
            </TabsContent>

            {/* Activity Tab */}
            <TabsContent value="activity" className="h-full m-0 p-3 sm:p-6" data-testid="content-activity">
              <Card className="p-4 sm:p-6">
                <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
                {commands.length === 0 ? (
                  <p className="text-muted-foreground text-center py-8">
                    No activity yet. Start building to see your command history here.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {commands.slice(0, 10).map((cmd) => (
                      <div key={cmd.id} className="flex items-start gap-3 p-3 rounded-lg bg-muted/50">
                        <Code className="w-4 h-4 mt-0.5 text-muted-foreground" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">{cmd.command}</p>
                          <p className="text-xs text-muted-foreground">
                            {cmd.status} • {new Date(cmd.createdAt).toLocaleString()}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </Card>
            </TabsContent>

            {/* Versions Tab */}
            <TabsContent value="versions" className="h-full m-0" data-testid="content-versions">
              {currentProjectId ? (
                <VersionHistory projectId={currentProjectId} />
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-6">
                  <History className="w-16 h-16 text-muted-foreground mb-4" />
                  <h3 className="text-lg font-semibold mb-2">No Project Selected</h3>
                  <p className="text-sm text-muted-foreground text-center max-w-md">
                    Generate a project in the Build tab to access version history and snapshots
                  </p>
                </div>
              )}
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  );
}
