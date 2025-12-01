/**
 * Workspace Layout - Replit-inspired IDE Layout
 * Left: Task/Activity Panel | Right: Editor/Preview/Terminal Tabs
 * Supports both user projects and platform healing (admin mode)
 */

import { useState, useEffect, useRef } from 'react';
import { useLocation } from 'wouter';
import { Terminal as TerminalIcon, Eye, FileText, Settings, ChevronDown, Plus, X, GitBranch, TestTube, Database, Key, Zap, Package, Search, Box, Bug, AlertCircle, Zap as API, Sparkles } from 'lucide-react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Terminal } from '@/components/terminal';
import { FileExplorer } from '@/components/file-explorer';
import { FileBrowser } from '@/components/file-browser';
import { GitPanel } from '@/components/git-panel';
import { TestingPanel } from '@/components/testing-panel';
import { DatabaseViewer } from '@/components/database-viewer';
import { EnvironmentEditor } from '@/components/environment-editor';
import { LogsViewer } from '@/components/logs-viewer';
import { LivePreview } from '@/components/live-preview';
import { PackageManager } from '@/components/package-manager';
import { SearchPanel } from '@/components/search-panel';
import { IDESettings } from '@/components/ide-settings';
import { DebuggerPanel } from '@/components/debugger-panel';
import { ProblemsPanel } from '@/components/problems-panel';
import { APIClient } from '@/components/api-client';
import { AIAssistant } from '@/components/ai-assistant';
import { SwarmModeButton } from '@/components/swarm-mode-button';
import { BeeHiveLogo } from '@/components/beehive-logo';

interface WorkspaceLayoutProps {
  projectId: string;
  projectName: string;
  mode: 'project' | 'platform-healing'; // project = user, platform-healing = admin
  isAdmin: boolean;
  userRole: 'owner' | 'member' | 'admin' | 'super_admin';
  files?: Array<{ id: string; filename: string; content: string; language?: string; createdAt?: string; updatedAt?: string }>;
  
  // Left panel content
  tasks?: Array<{
    id: string;
    title: string;
    status: 'pending' | 'in_progress' | 'completed';
    duration?: string;
    description?: string;
    subtasks?: number;
  }>;
  activityLog?: Array<{
    id: string;
    action: string;
    timestamp: Date;
    user: string;
  }>;
  
  // Right panel content
  children?: React.ReactNode;
  onTaskSelect?: (taskId: string) => void;
  onEditorChange?: (content: string) => void;
}

export function WorkspaceLayout({
  projectId,
  projectName,
  mode,
  isAdmin,
  userRole,
  files = [],
  tasks = [],
  activityLog = [],
  children,
  onTaskSelect,
}: WorkspaceLayoutProps) {
  const [, setLocation] = useLocation();
  const [leftPanelOpen, setLeftPanelOpen] = useState(true);
  const [selectedTab, setSelectedTab] = useState<'editor' | 'preview' | 'terminal' | 'files' | 'git' | 'tests' | 'database' | 'env' | 'logs' | 'packages' | 'search' | 'deploy' | 'debugger' | 'problems' | 'api' | 'ai' | 'settings' | 'healing'>('editor');
  const [selectedTask, setSelectedTask] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const prevProjectIdRef = useRef<string | null>(null);

  // Detect project change and force all tabs to refresh
  useEffect(() => {
    if (projectId && projectId !== prevProjectIdRef.current) {
      console.log('[WORKSPACE] 🔄 Project changed:', prevProjectIdRef.current, '→', projectId);
      prevProjectIdRef.current = projectId;
      setRefreshKey(prev => prev + 1);
      console.log('[WORKSPACE] ⚡ Force refresh triggered for ALL tabs');
    }
  }, [projectId]);

  // RBAC: Only show appropriate content
  const canEditProject = userRole === 'owner' || userRole === 'admin' || userRole === 'super_admin';
  const canHeal = isAdmin && mode === 'platform-healing';

  return (
    <div className="h-screen flex flex-col overflow-hidden">
      {/* Header Bar */}
      <header className="border-b bg-gradient-to-r from-slate-900 to-slate-800 dark:from-slate-950 dark:to-slate-900 backdrop-blur-sm px-4 py-2 flex items-center justify-between h-12">
        <div className="flex items-center gap-3">
          {/* Queen Bee Logo */}
          <BeeHiveLogo iconSize={24} variant="dark" showText={false} />
          {mode === 'platform-healing' && (
            <Badge variant="destructive" className="text-xs">Platform Healing</Badge>
          )}
          <h1 className="font-semibold text-sm">{projectName}</h1>
          {mode === 'project' && (
            <Badge variant="outline" className="text-xs">
              {userRole === 'owner' ? 'Owner' : 'Member'}
            </Badge>
          )}
        </div>
        <div className="flex items-center gap-2">
          <SwarmModeButton
            onActivate={() => setLocation('/swarm-dashboard')}
            disabled={mode === 'platform-healing'}
            data-testid="button-swarm-mode-header"
          />
          <Button size="sm" variant="ghost" data-testid="button-publish">
            <Eye className="w-4 h-4 mr-1" />
            Publishing
          </Button>
          <Button size="sm" variant="ghost" data-testid="button-settings">
            <Settings className="w-4 h-4" />
          </Button>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 overflow-hidden gap-px bg-border">
        {/* LEFT PANEL - Activity/Task List */}
        {leftPanelOpen && (
          <div className="w-72 border-r bg-card flex flex-col overflow-hidden">
            {/* Left Panel Header */}
            <div className="border-b p-4 space-y-2">
              <div className="flex items-center justify-between">
                <h2 className="font-semibold text-sm">Tasks & Activity</h2>
                <Button
                  size="icon"
                  variant="ghost"
                  className="h-6 w-6"
                  onClick={() => setLeftPanelOpen(false)}
                  data-testid="button-close-left-panel"
                >
                  <X className="w-3 h-3" />
                </Button>
              </div>
            </div>

            {/* Scrollable Task List */}
            <div className="flex-1 overflow-y-auto">
              {tasks.length === 0 ? (
                <div className="p-4 text-center text-muted-foreground text-xs">
                  {mode === 'platform-healing' 
                    ? 'No platform healing tasks' 
                    : 'No active tasks'}
                </div>
              ) : (
                <div className="divide-y">
                  {tasks.map((task) => (
                    <Card
                      key={task.id}
                      className={cn(
                        'rounded-none border-0 border-b cursor-pointer transition-colors p-4',
                        selectedTask === task.id
                          ? 'bg-primary/10 border-primary'
                          : 'hover:bg-accent/50'
                      )}
                      onClick={() => {
                        setSelectedTask(task.id);
                        onTaskSelect?.(task.id);
                      }}
                      data-testid={`task-card-${task.id}`}
                    >
                      <div className="space-y-2">
                        {/* Status Badge */}
                        <div className="flex items-center gap-2">
                          <div
                            className={cn(
                              'w-2 h-2 rounded-full',
                              task.status === 'completed'
                                ? 'bg-green-500'
                                : task.status === 'in_progress'
                                ? 'bg-blue-500'
                                : 'bg-yellow-500'
                            )}
                          />
                          <span className="text-xs font-medium capitalize">
                            {task.status.replace('_', ' ')}
                          </span>
                          {task.duration && (
                            <span className="text-xs text-muted-foreground ml-auto">
                              {task.duration}
                            </span>
                          )}
                        </div>

                        {/* Task Title */}
                        <h3 className="font-semibold text-sm line-clamp-2">{task.title}</h3>

                        {/* Task Description */}
                        {task.description && (
                          <p className="text-xs text-muted-foreground line-clamp-3">
                            {task.description}
                          </p>
                        )}

                        {/* Subtasks Counter */}
                        {task.subtasks && (
                          <div className="flex items-center gap-1 text-xs text-muted-foreground">
                            <ChevronDown className="w-3 h-3" />
                            {task.subtasks} subtask{task.subtasks !== 1 ? 's' : ''}
                          </div>
                        )}
                      </div>
                    </Card>
                  ))}
                </div>
              )}

              {/* Activity Log */}
              {activityLog.length > 0 && (
                <div className="border-t pt-4 px-4">
                  <h3 className="text-xs font-semibold text-muted-foreground mb-3 uppercase">
                    Recent Activity
                  </h3>
                  <div className="space-y-3">
                    {activityLog.slice(0, 5).map((entry) => (
                      <div key={entry.id} className="text-xs space-y-1">
                        <p className="font-medium truncate">{entry.action}</p>
                        <p className="text-muted-foreground text-[11px]">
                          {entry.user} • {entry.timestamp.toLocaleTimeString()}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Left Panel Footer - Action Buttons */}
            {canEditProject && (
              <div className="border-t p-3 space-y-2">
                <Button size="sm" className="w-full" variant="outline" data-testid="button-new-task">
                  <Plus className="w-3 h-3 mr-2" />
                  New Task
                </Button>
              </div>
            )}
          </div>
        )}

        {/* RIGHT PANEL - Editor/Preview/Console Tabs */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tab Bar */}
          <Tabs
            value={selectedTab}
            onValueChange={(v) => setSelectedTab(v as any)}
            className="w-full h-full flex flex-col border-b"
          >
            <TabsList className="w-full justify-start h-10 rounded-none border-b bg-transparent p-0">
              <TabsTrigger
                value="editor"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-editor"
              >
                <FileText className="w-4 h-4 mr-2" />
                Editor
              </TabsTrigger>
              <TabsTrigger
                value="preview"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-preview"
              >
                <Eye className="w-4 h-4 mr-2" />
                Preview
              </TabsTrigger>
              <TabsTrigger
                value="files"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-files"
              >
                <FileText className="w-4 h-4 mr-2" />
                Files
              </TabsTrigger>
              <TabsTrigger
                value="git"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-git"
              >
                <GitBranch className="w-4 h-4 mr-2" />
                Git
              </TabsTrigger>
              <TabsTrigger
                value="database"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-database"
              >
                <Database className="w-4 h-4 mr-2" />
                Database
              </TabsTrigger>
              <TabsTrigger
                value="terminal"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-terminal"
              >
                <TerminalIcon className="w-4 h-4 mr-2" />
                Terminal
              </TabsTrigger>
              <TabsTrigger
                value="env"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-env"
              >
                <Key className="w-4 h-4 mr-2" />
                Env
              </TabsTrigger>
              <TabsTrigger
                value="logs"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-logs"
              >
                <Zap className="w-4 h-4 mr-2" />
                Logs
              </TabsTrigger>
              <TabsTrigger
                value="tests"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-tests"
              >
                <TestTube className="w-4 h-4 mr-2" />
                Tests
              </TabsTrigger>
              <TabsTrigger
                value="packages"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-packages"
              >
                <Package className="w-4 h-4 mr-2" />
                Packages
              </TabsTrigger>
              <TabsTrigger
                value="search"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-search"
              >
                <Search className="w-4 h-4 mr-2" />
                Search
              </TabsTrigger>
              <TabsTrigger
                value="deploy"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-deploy"
              >
                <Box className="w-4 h-4 mr-2" />
                Deploy
              </TabsTrigger>
              <TabsTrigger
                value="debugger"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-debugger"
              >
                <Bug className="w-4 h-4 mr-2" />
                Debug
              </TabsTrigger>
              <TabsTrigger
                value="problems"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-problems"
              >
                <AlertCircle className="w-4 h-4 mr-2" />
                Problems
              </TabsTrigger>
              <TabsTrigger
                value="api"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-api"
              >
                <API className="w-4 h-4 mr-2" />
                API
              </TabsTrigger>
              <TabsTrigger
                value="ai"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-ai"
              >
                <Sparkles className="w-4 h-4 mr-2" />
                AI
              </TabsTrigger>
              <TabsTrigger
                value="settings"
                className="rounded-none border-b-2 border-transparent data-[state=active]:border-primary px-4 py-2"
                data-testid="tab-settings"
              >
                <Settings className="w-4 h-4 mr-2" />
                Settings
              </TabsTrigger>
              
              {/* RBAC: Show platform controls only for admins */}
              {isAdmin && mode === 'platform-healing' && (
                <TabsTrigger
                  value="healing"
                  className="rounded-none border-b-2 border-transparent data-[state=active]:border-destructive px-4 py-2 ml-auto"
                  data-testid="tab-healing"
                >
                  <Badge variant="destructive" className="text-xs">Heal</Badge>
                </TabsTrigger>
              )}

              {/* Tab Controls */}
              <Button
                size="sm"
                variant="ghost"
                className="ml-auto h-6 w-6 rounded"
                onClick={() => setLeftPanelOpen(!leftPanelOpen)}
                data-testid="button-toggle-left-panel"
              >
                {leftPanelOpen ? <ChevronDown className="w-3 h-3" /> : <Plus className="w-3 h-3" />}
              </Button>
            </TabsList>

            {/* Tab Content Areas */}
            <TabsContent value="editor" className="flex-1 overflow-hidden p-0">
              <div className="h-full w-full overflow-auto bg-card/50">
                {children || (
                  <div className="h-full flex items-center justify-center text-muted-foreground">
                    <div className="text-center space-y-2">
                      <FileText className="w-12 h-12 mx-auto opacity-50" />
                      <p className="text-sm">
                        {mode === 'platform-healing'
                          ? 'Select a file to edit'
                          : 'Open a file to start editing'}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>

            <TabsContent value="preview" className="flex-1 overflow-hidden p-0">
              <LivePreview projectId={projectId} refreshKey={refreshKey} />
            </TabsContent>

            <TabsContent value="files" className="flex-1 overflow-hidden p-0">
              <FileBrowser 
                projectId={projectId}
                refreshKey={refreshKey}
                onFileSelect={(path) => console.log('[FILES] Selected:', path)}
                onFileDoubleClick={(path) => console.log('[FILES] Double-clicked:', path)}
              />
            </TabsContent>

            <TabsContent value="git" className="flex-1 overflow-hidden p-0">
              <div className="h-full overflow-auto">
                <GitPanel />
              </div>
            </TabsContent>

            <TabsContent value="database" className="flex-1 overflow-hidden p-0">
              <DatabaseViewer refreshKey={refreshKey} />
            </TabsContent>

            <TabsContent value="terminal" className="flex-1 overflow-hidden p-0">
              <Terminal projectId={projectId} refreshKey={refreshKey} />
            </TabsContent>

            <TabsContent value="env" className="flex-1 overflow-hidden p-0">
              <EnvironmentEditor refreshKey={refreshKey} />
            </TabsContent>

            <TabsContent value="logs" className="flex-1 overflow-hidden p-0">
              <LogsViewer refreshKey={refreshKey} />
            </TabsContent>

            <TabsContent value="tests" className="flex-1 overflow-hidden p-0">
              <TestingPanel session={null} onClose={() => {}} />
            </TabsContent>

            <TabsContent value="packages" className="flex-1 overflow-hidden p-0">
              <PackageManager />
            </TabsContent>

            <TabsContent value="search" className="flex-1 overflow-hidden p-0">
              <SearchPanel />
            </TabsContent>

            <TabsContent value="deploy" className="flex-1 overflow-hidden p-0">
              <Card className="m-4 p-4">
                <div className="text-center space-y-3">
                  <Box className="w-12 h-12 mx-auto opacity-50" />
                  <h3 className="font-semibold">Deployment</h3>
                  <p className="text-xs text-muted-foreground">Publish your app to production</p>
                  <Button data-testid="button-deploy-now">Deploy Now</Button>
                </div>
              </Card>
            </TabsContent>

            <TabsContent value="debugger" className="flex-1 overflow-hidden p-0">
              <DebuggerPanel />
            </TabsContent>

            <TabsContent value="problems" className="flex-1 overflow-hidden p-0">
              <ProblemsPanel />
            </TabsContent>

            <TabsContent value="api" className="flex-1 overflow-hidden p-0">
              <APIClient />
            </TabsContent>

            <TabsContent value="ai" className="flex-1 overflow-hidden p-0">
              <AIAssistant />
            </TabsContent>

            <TabsContent value="settings" className="flex-1 overflow-hidden p-0">
              <IDESettings />
            </TabsContent>

            {/* Platform Healing Tab - Admin Only */}
            {isAdmin && (
              <TabsContent value="healing" className="flex-1 overflow-hidden p-4">
                <div className="space-y-4 h-full overflow-y-auto">
                  <Card className="p-4">
                    <h3 className="font-semibold mb-2 flex items-center gap-2">
                      <Badge variant="destructive">Admin</Badge>
                      Platform Healing Controls
                    </h3>
                    <p className="text-sm text-muted-foreground">
                      Full platform access. Can modify user projects and core platform code.
                    </p>
                  </Card>

                  <Card className="p-4 space-y-4">
                    <h4 className="font-semibold text-sm">Healing Actions:</h4>
                    <Button 
                      className="w-full" 
                      data-testid="button-trigger-healing"
                      onClick={() => onTaskSelect?.('heal_platform')}
                    >
                      🔧 Trigger Platform Healing
                    </Button>
                  </Card>

                  <Card className="p-4">
                    <h4 className="font-semibold text-sm mb-2">Available Actions:</h4>
                    <ul className="text-sm space-y-2 text-muted-foreground">
                      <li>• View all projects (user & platform)</li>
                      <li>• Modify any file with approval tracking</li>
                      <li>• Access platform protection settings</li>
                      <li>• View platform healing history</li>
                      <li>• Approve/reject critical changes</li>
                    </ul>
                  </Card>
                </div>
              </TabsContent>
            )}
          </Tabs>
        </div>
      </div>

      {/* Bottom Status Bar */}
      <footer className="border-t bg-card/50 px-4 py-2 h-10 flex items-center justify-between text-xs text-muted-foreground">
        <div className="flex items-center gap-4">
          <span data-testid="status-mode">{mode === 'platform-healing' ? '🔧 Platform Healing' : '📦 Project'}</span>
          <span data-testid="status-role">Role: {userRole}</span>
        </div>
        <div className="flex items-center gap-2">
          <span>Connection: <span className="text-green-500">●</span> Connected</span>
        </div>
      </footer>
    </div>
  );
}
