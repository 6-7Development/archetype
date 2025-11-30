import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { DiffViewer } from "./diff-viewer";
import {
  GitBranch,
  GitCommit as GitCommitIcon,
  FileText,
  Plus,
  Check,
  Clock,
  User,
  ChevronRight,
  ChevronDown,
  Hash,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";
import { cn } from "@/lib/utils";

interface GitCommit {
  hash: string;
  author: string;
  email: string;
  date: Date;
  message: string;
  files: string[];
}

interface GitStatus {
  modified: string[];
  added: string[];
  deleted: string[];
  untracked: string[];
  branch: string;
}

interface GitBranchInfo {
  branches: string[];
  current: string;
}

export function GitPanel() {
  const [selectedCommit, setSelectedCommit] = useState<GitCommit | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [expandedCommits, setExpandedCommits] = useState<Set<string>>(new Set());
  const [stagedFiles, setStagedFiles] = useState<Set<string>>(new Set());
  const [commitMessage, setCommitMessage] = useState("");

  // Fetch commit history
  const { data: commits = [], isLoading: commitsLoading } = useQuery<GitCommit[]>({
    queryKey: ["/api/git/history"],
    refetchInterval: 30000, // Refresh every 30s
  });

  // Fetch current status
  const { data: status } = useQuery<GitStatus>({
    queryKey: ["/api/git/status"],
    refetchInterval: 5000, // Refresh every 5s
  });

  // Fetch branches
  const { data: branchInfo } = useQuery<GitBranchInfo>({
    queryKey: ["/api/git/branches"],
    refetchInterval: 10000, // Refresh every 10s
  });

  // Fetch diff for selected file in selected commit
  const { data: fileDiff } = useQuery<{ diff: string }>({
    queryKey: ["/api/git/commit", selectedCommit?.hash, "file-diff", selectedFile],
    queryFn: async () => {
      if (!selectedCommit || !selectedFile) return { diff: "" };
      const params = new URLSearchParams({ file: selectedFile });
      const response = await fetch(`/api/git/commit/${selectedCommit.hash}/file-diff?${params}`);
      return response.json();
    },
    enabled: !!selectedCommit && !!selectedFile,
  });

  const toggleCommitExpand = (commitHash: string) => {
    const newExpanded = new Set(expandedCommits);
    if (newExpanded.has(commitHash)) {
      newExpanded.delete(commitHash);
    } else {
      newExpanded.add(commitHash);
    }
    setExpandedCommits(newExpanded);
  };

  const toggleStageFile = (file: string) => {
    const newStaged = new Set(stagedFiles);
    if (newStaged.has(file)) {
      newStaged.delete(file);
    } else {
      newStaged.add(file);
    }
    setStagedFiles(newStaged);
  };

  const handleCommit = async () => {
    if (!commitMessage.trim() || stagedFiles.size === 0) {
      return;
    }

    try {
      const response = await fetch("/api/git/commit", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: commitMessage,
          author: {
            name: "Platform User",
            email: "user@beehive.dev",
          },
        }),
      });

      if (response.ok) {
        setCommitMessage("");
        setStagedFiles(new Set());
      }
    } catch (error) {
      console.error("Failed to commit:", error);
    }
  };

  const allChangedFiles = [
    ...(status?.modified || []),
    ...(status?.added || []),
    ...(status?.deleted || []),
    ...(status?.untracked || []),
  ];

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  const getFileStatus = (file: string) => {
    if (status?.added.includes(file)) return "added";
    if (status?.deleted.includes(file)) return "deleted";
    if (status?.modified.includes(file)) return "modified";
    if (status?.untracked.includes(file)) return "untracked";
    return "unknown";
  };

  return (
    <div className="h-full flex flex-col bg-background">
      <Tabs defaultValue="history" className="h-full flex flex-col">
        <div className="border-b px-4 py-2">
          <TabsList className="w-full justify-start" data-testid="tabs-git-panel">
            <TabsTrigger value="changes" className="gap-2" data-testid="tab-changes">
              <FileText className="h-4 w-4" />
              Changes
              {allChangedFiles.length > 0 && (
                <Badge variant="secondary" className="ml-1 h-5 min-w-5 rounded-full px-1.5">
                  {allChangedFiles.length}
                </Badge>
              )}
            </TabsTrigger>
            <TabsTrigger value="history" className="gap-2" data-testid="tab-history">
              <Clock className="h-4 w-4" />
              History
            </TabsTrigger>
            <TabsTrigger value="branches" className="gap-2" data-testid="tab-branches">
              <GitBranch className="h-4 w-4" />
              Branches
            </TabsTrigger>
          </TabsList>
        </div>

        {/* Changes Tab */}
        <TabsContent value="changes" className="flex-1 m-0 overflow-hidden">
          <div className="h-full flex flex-col">
            {/* Current Branch */}
            <div className="px-4 py-3 border-b bg-muted/30">
              <div className="flex items-center gap-2 text-sm">
                <GitBranch className="h-4 w-4 text-muted-foreground" />
                <span className="font-medium">{status?.branch || "main"}</span>
              </div>
            </div>

            <ScrollArea className="flex-1">
              <div className="p-4 space-y-4">
                {allChangedFiles.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <FileText className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p className="text-sm">No changes</p>
                  </div>
                ) : (
                  <>
                    <div className="space-y-2">
                      {allChangedFiles.map((file) => {
                        const fileStatus = getFileStatus(file);
                        return (
                          <div
                            key={file}
                            className="flex items-center gap-3 p-2 rounded-md hover-elevate"
                            data-testid={`file-change-${file}`}
                          >
                            <Checkbox
                              checked={stagedFiles.has(file)}
                              onCheckedChange={() => toggleStageFile(file)}
                              data-testid={`checkbox-stage-${file}`}
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{file}</p>
                              <p className="text-xs text-muted-foreground capitalize">
                                {fileStatus}
                              </p>
                            </div>
                            <Badge variant={
                              fileStatus === "added" ? "default" :
                              fileStatus === "deleted" ? "destructive" :
                              "secondary"
                            } className="text-xs">
                              {fileStatus[0].toUpperCase()}
                            </Badge>
                          </div>
                        );
                      })}
                    </div>

                    {/* Commit Section */}
                    <div className="space-y-3 pt-4 border-t">
                      <Textarea
                        placeholder="Commit message..."
                        value={commitMessage}
                        onChange={(e) => setCommitMessage(e.target.value)}
                        className="min-h-[80px]"
                        data-testid="input-commit-message"
                      />
                      <Button
                        onClick={handleCommit}
                        disabled={!commitMessage.trim() || stagedFiles.size === 0}
                        className="w-full"
                        data-testid="button-commit"
                      >
                        <GitCommitIcon className="h-4 w-4 mr-2" />
                        Commit {stagedFiles.size > 0 && `(${stagedFiles.size} files)`}
                      </Button>
                      <p className="text-xs text-muted-foreground text-center">
                        Demo mode: Changes won't actually be committed
                      </p>
                    </div>
                  </>
                )}
              </div>
            </ScrollArea>
          </div>
        </TabsContent>

        {/* History Tab */}
        <TabsContent value="history" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              {commitsLoading ? (
                <div className="text-center py-8 text-muted-foreground">
                  <Clock className="h-8 w-8 mx-auto mb-2 opacity-50 animate-pulse" />
                  <p className="text-sm">Loading commits...</p>
                </div>
              ) : commits.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  <GitCommitIcon className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No commits yet</p>
                </div>
              ) : (
                commits.map((commit) => {
                  const isExpanded = expandedCommits.has(commit.hash);
                  return (
                    <div
                      key={commit.hash}
                      className="border rounded-lg overflow-hidden"
                      data-testid={`commit-${commit.hash.slice(0, 7)}`}
                    >
                      {/* Commit Header */}
                      <button
                        onClick={() => toggleCommitExpand(commit.hash)}
                        className="w-full p-3 flex items-start gap-3 hover-elevate active-elevate-2 text-left"
                      >
                        <Avatar className="h-8 w-8 mt-0.5">
                          <AvatarFallback className="bg-sparkling-lemon/20 text-sparkling-lemon-foreground text-xs">
                            {getInitials(commit.author)}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium mb-1">{commit.message}</p>
                          <div className="flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <User className="h-3 w-3" />
                              {commit.author}
                            </span>
                            <span className="flex items-center gap-1">
                              <Hash className="h-3 w-3" />
                              {commit.hash.slice(0, 7)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {formatDistanceToNow(new Date(commit.date), { addSuffix: true })}
                            </span>
                          </div>
                          <div className="mt-1.5">
                            <Badge variant="outline" className="text-xs">
                              {commit.files.length} {commit.files.length === 1 ? "file" : "files"}
                            </Badge>
                          </div>
                        </div>

                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-muted-foreground" />
                        )}
                      </button>

                      {/* Expanded Files */}
                      {isExpanded && commit.files.length > 0 && (
                        <div className="border-t bg-muted/30">
                          {commit.files.map((file) => (
                            <button
                              key={file}
                              onClick={() => {
                                setSelectedCommit(commit);
                                setSelectedFile(file);
                              }}
                              className={cn(
                                "w-full px-4 py-2 flex items-center gap-2 hover-elevate text-left text-sm",
                                selectedCommit?.hash === commit.hash && selectedFile === file && "bg-accent"
                              )}
                              data-testid={`commit-file-${file}`}
                            >
                              <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="flex-1 truncate">{file}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </ScrollArea>
        </TabsContent>

        {/* Branches Tab */}
        <TabsContent value="branches" className="flex-1 m-0 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 space-y-3">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-medium">All Branches</h3>
                <Button size="sm" variant="outline" disabled data-testid="button-new-branch">
                  <Plus className="h-3.5 w-3.5 mr-1.5" />
                  New Branch
                </Button>
              </div>

              {branchInfo?.branches.map((branch) => {
                const isCurrent = branch === branchInfo.current;
                return (
                  <div
                    key={branch}
                    className={cn(
                      "flex items-center gap-3 p-3 rounded-lg border",
                      isCurrent && "bg-accent border-accent-border"
                    )}
                    data-testid={`branch-${branch}`}
                  >
                    <GitBranch className="h-4 w-4 text-muted-foreground" />
                    <span className="flex-1 font-medium text-sm">{branch}</span>
                    {isCurrent ? (
                      <Badge variant="default" className="text-xs">
                        <Check className="h-3 w-3 mr-1" />
                        Current
                      </Badge>
                    ) : (
                      <Button size="sm" variant="ghost" disabled data-testid={`button-checkout-${branch}`}>
                        Checkout
                      </Button>
                    )}
                  </div>
                );
              })}

              {(!branchInfo?.branches || branchInfo.branches.length === 0) && (
                <div className="text-center py-8 text-muted-foreground">
                  <GitBranch className="h-8 w-8 mx-auto mb-2 opacity-50" />
                  <p className="text-sm">No branches found</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </TabsContent>
      </Tabs>

      {/* Diff Viewer Modal (when file is selected) */}
      {selectedCommit && selectedFile && (
        <div className="fixed inset-0 z-50 bg-background/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-card border rounded-lg w-full max-w-4xl h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-4 border-b">
              <div className="flex-1 min-w-0">
                <h3 className="font-medium truncate">{selectedFile}</h3>
                <p className="text-xs text-muted-foreground">
                  {selectedCommit.hash.slice(0, 7)} • {selectedCommit.message}
                </p>
              </div>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => {
                  setSelectedCommit(null);
                  setSelectedFile(null);
                }}
                data-testid="button-close-diff"
              >
                Close
              </Button>
            </div>
            <div className="flex-1 overflow-hidden">
              <DiffViewer diff={fileDiff?.diff || ""} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
