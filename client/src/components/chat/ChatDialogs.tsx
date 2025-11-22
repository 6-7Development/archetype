import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Drawer, DrawerContent } from "@/components/ui/drawer";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Key, AlertCircle, Loader2 } from "lucide-react";
import CostPreview from "@/components/cost-preview";
import { DeploymentStatusModal } from "@/components/deployment-status-modal";
import { MessageHistory } from "./MessageHistory";
import { ContextRail } from "./ContextRail";
import { TestingPanel } from "@/components/testing-panel";
import type { RunState } from "@shared/agentEvents";
import type { Artifact as ArtifactItem } from "@/components/agent/ArtifactsDrawer";
import type { AgentTask } from "@/components/agent-task-list";

// Re-export types for use in other components
export interface RequiredSecret {
  key: string;
  description: string;
  getInstructions?: string;
}

export interface SecretsRequest {
  commandId: string;
  command: string;
  message: string;
  requiredSecrets: RequiredSecret[];
}

export interface TestingSession {
  sessionId: string;
  url: string;
  status: 'initializing' | 'running' | 'completed' | 'failed';
  narration: string[];
  steps: Array<{
    id: string;
    type: 'navigate' | 'action' | 'assertion' | 'screenshot';
    description: string;
    status: 'pending' | 'running' | 'passed' | 'failed';
    timestamp: number;
    screenshot?: string;
    error?: string;
  }>;
  startedAt: number;
  completedAt?: number;
}

export interface CostData {
  complexity: 'simple' | 'medium' | 'complex' | 'enterprise';
  estimatedTokens: number;
  tokensRemaining: number;
  tokenLimit: number;
  overageTokens: number;
  overageCost: number;
  reasons: string[];
}

export interface DeploymentData {
  deploymentId: string;
  commitHash: string;
  commitMessage: string;
  commitUrl?: string;
  timestamp: number;
  platform: string;
  steps: Array<{
    id: string;
    name: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    timestamp?: number;
    error?: string;
  }>;
  status: 'pending' | 'running' | 'completed' | 'failed';
  deploymentUrl?: string;
  errorMessage?: string;
}

interface ChatDialogsProps {
  // Secrets dialog
  secretsRequest: SecretsRequest | null;
  setSecretsRequest: (value: SecretsRequest | null) => void;
  secretsInput: Record<string, string>;
  setSecretsInput: (value: Record<string, string> | ((prev: Record<string, string>) => Record<string, string>)) => void;
  onSecretsSubmit: () => void;
  isSubmittingSecrets: boolean;

  // Cost preview dialog
  showCostPreview: boolean;
  setShowCostPreview: (value: boolean) => void;
  isFreeAccess: boolean;
  costData: CostData | null;
  onCostPreviewProceed: () => void;
  pendingCommand: string;
  setPendingCommand: (value: string) => void;
  setCostData: (value: any) => void;

  // Complexity error dialog
  showComplexityError: boolean;
  setShowComplexityError: (value: boolean) => void;
  complexityErrorMessage: string;
  onComplexityErrorProceed: () => void;

  // Deployment modal
  showDeploymentModal: boolean;
  setShowDeploymentModal: (value: boolean) => void;
  deployment: DeploymentData | null;

  // Insufficient credits dialog
  showInsufficientCredits: boolean;
  setShowInsufficientCredits: (value: boolean) => void;

  // Image zoom modal
  zoomImage: string | null;
  setZoomImage: (value: string | null) => void;

  // Testing panel
  testingSession: TestingSession | null;
  setTestingSession: (value: TestingSession | null) => void;

  // Message history dialog
  showHistoryDialog: boolean;
  setShowHistoryDialog: (value: boolean) => void;
  selectedSessionId: string | null;
  onSessionSelect: (session: any) => void;

  // Context drawer (mobile)
  contextDrawerOpen: boolean;
  setContextDrawerOpen: (value: boolean) => void;
  agentTasks: AgentTask[];
  artifacts: ArtifactItem[];
  runState: RunState | null;
  setActiveTaskId: (value: string | null) => void;
  setShowArtifactsDrawer: (value: boolean) => void;
}

export function ChatDialogs({
  secretsRequest,
  setSecretsRequest,
  secretsInput,
  setSecretsInput,
  onSecretsSubmit,
  isSubmittingSecrets,
  showCostPreview,
  setShowCostPreview,
  isFreeAccess,
  costData,
  onCostPreviewProceed,
  pendingCommand,
  setPendingCommand,
  setCostData,
  showComplexityError,
  setShowComplexityError,
  complexityErrorMessage,
  onComplexityErrorProceed,
  showDeploymentModal,
  setShowDeploymentModal,
  deployment,
  showInsufficientCredits,
  setShowInsufficientCredits,
  zoomImage,
  setZoomImage,
  testingSession,
  setTestingSession,
  showHistoryDialog,
  setShowHistoryDialog,
  selectedSessionId,
  onSessionSelect,
  contextDrawerOpen,
  setContextDrawerOpen,
  agentTasks,
  artifacts,
  runState,
  setActiveTaskId,
  setShowArtifactsDrawer,
}: ChatDialogsProps) {
  return (
    <>
      {/* Secrets Request Dialog */}
      <Dialog open={!!secretsRequest} onOpenChange={() => setSecretsRequest(null)}>
        <DialogContent className="max-w-[95vw] sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Key className="w-5 h-5" />
              Secure Credentials Required
            </DialogTitle>
            <DialogDescription>
              {secretsRequest?.message}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {secretsRequest?.requiredSecrets.map((secret) => (
              <div key={secret.key} className="space-y-2">
                <Label htmlFor={secret.key}>{secret.key}</Label>
                <Input
                  id={secret.key}
                  type="password"
                  placeholder={secret.description}
                  value={secretsInput[secret.key] || ""}
                  onChange={(e) =>
                    setSecretsInput((prev) => ({
                      ...prev,
                      [secret.key]: e.target.value,
                    }))
                  }
                  data-testid={`input-secret-${secret.key}`}
                />
                {secret.getInstructions && (
                  <p className="text-xs text-muted-foreground">
                    {secret.getInstructions}
                  </p>
                )}
              </div>
            ))}

            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Your credentials are encrypted and never stored. They're used only for this project generation.
              </AlertDescription>
            </Alert>
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setSecretsRequest(null)}
              data-testid="button-cancel-secrets"
            >
              Cancel
            </Button>
            <Button
              onClick={onSecretsSubmit}
              disabled={isSubmittingSecrets}
              data-testid="button-submit-secrets"
            >
              {isSubmittingSecrets ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                "Continue Generation"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* Cost Preview Dialog - Only show when NOT free access */}
      {!isFreeAccess && (
        <Dialog open={showCostPreview} onOpenChange={setShowCostPreview}>
          <DialogContent className="max-w-[95vw] sm:max-w-2xl">
            {costData && (
              <CostPreview
                complexity={costData?.complexity}
                estimatedTokens={costData?.estimatedTokens}
                tokensRemaining={costData?.tokensRemaining}
                tokenLimit={costData?.tokenLimit}
                overageTokens={costData?.overageTokens}
                overageCost={costData?.overageCost}
                reasons={costData?.reasons}
                onConfirm={onCostPreviewProceed}
                onCancel={() => {
                  setShowCostPreview(false);
                  setPendingCommand("");
                  setCostData(null);
                }}
              />
            )}
          </DialogContent>
        </Dialog>
      )}

      {/* Complexity Error Dialog */}
      <Dialog open={showComplexityError} onOpenChange={setShowComplexityError}>
        <DialogContent className="max-w-[95vw] sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Token Estimation Failed</DialogTitle>
            <DialogDescription>
              {complexityErrorMessage}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowComplexityError(false)}>
              Cancel
            </Button>
            <Button onClick={onComplexityErrorProceed}>
              Proceed Anyway
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Deployment Modal */}
      {deployment && (
        <DeploymentStatusModal
          open={showDeploymentModal}
          onOpenChange={setShowDeploymentModal}
          deploymentId={deployment.deploymentId}
          commitHash={deployment.commitHash}
          commitMessage={deployment.commitMessage}
          commitUrl={deployment.commitUrl}
          timestamp={deployment.timestamp}
          platform={deployment.platform}
          steps={deployment.steps}
          status={deployment.status}
          deploymentUrl={deployment.deploymentUrl}
          errorMessage={deployment.errorMessage}
        />
      )}

      {/* Insufficient Credits Dialog */}
      <AlertDialog open={showInsufficientCredits} onOpenChange={setShowInsufficientCredits}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Insufficient Credits</AlertDialogTitle>
            <AlertDialogDescription>
              You don't have enough credits to complete this request. 
              Please purchase more credits to continue using LomuAI.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel data-testid="button-insufficient-credits-cancel">Cancel</AlertDialogCancel>
            <AlertDialogAction 
              onClick={() => window.location.href = '/pricing'}
              data-testid="button-insufficient-credits-purchase"
            >
              Purchase Credits
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Image Zoom Modal */}
      {zoomImage && (
        <Dialog open={!!zoomImage} onOpenChange={() => setZoomImage(null)}>
          <DialogContent className="max-w-[95vw] max-h-[95vh] p-0">
            <img
              src={zoomImage}
              alt="Zoomed"
              className="w-full h-full object-contain"
            />
          </DialogContent>
        </Dialog>
      )}

      {/* Testing Panel */}
      {testingSession && (
        <TestingPanel
          session={testingSession}
          onClose={() => setTestingSession(null)}
        />
      )}

      {/* Message History Dialog */}
      <Dialog open={showHistoryDialog} onOpenChange={setShowHistoryDialog}>
        <DialogContent className="max-w-2xl h-[80vh] p-0">
          <MessageHistory
            currentSessionId={selectedSessionId}
            onSessionSelect={onSessionSelect}
            onClose={() => setShowHistoryDialog(false)}
          />
        </DialogContent>
      </Dialog>

      {/* Mobile: Context Drawer */}
      <Drawer open={contextDrawerOpen} onOpenChange={setContextDrawerOpen}>
        <DrawerContent className="h-[80vh] md:hidden">
          <div className="overflow-y-auto h-full">
            <ContextRail
              tasks={agentTasks}
              artifacts={artifacts}
              runState={runState}
              onTaskClick={(taskId) => {
                setActiveTaskId(taskId);
                setContextDrawerOpen(false);
              }}
              onArtifactView={() => {
                setShowArtifactsDrawer(true);
                setContextDrawerOpen(false);
              }}
            />
          </div>
        </DrawerContent>
      </Drawer>
    </>
  );
}
