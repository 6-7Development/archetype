/**
 * Agent Chatroom UX + Orchestration Event System
 * Based on external expert guidance for professional agent UX
 */

// Simple ULID-like generator (timestamp + random)
function generateId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 15);
  return `${timestamp}-${random}`.toUpperCase();
}

// ============================================================================
// EVENT ENVELOPE SYSTEM
// ============================================================================

export type EventType =
  | "message.user"
  | "message.agent"
  | "plan.created"
  | "task.created"
  | "task.updated"
  | "tool.called"
  | "tool.succeeded"
  | "tool.failed"
  | "verify.requested"
  | "verify.result"
  | "artifact.created"
  | "artifact.updated"
  | "run.phase"
  | "agent.delegated"
  | "agent.guidance"
  | "deploy.started"
  | "deploy.step_update"
  | "deploy.complete"
  | "deploy.failed";

export type Actor = "user" | "agent" | "subagent" | "system";

export interface EventEnvelope<T = unknown> {
  id: string;              // ULID for ordering and unique identification
  ts: string;              // ISO 8601 timestamp
  type: EventType;
  actor: Actor;
  data: T;
}

// ============================================================================
// RUN PHASES (State Machine)
// ============================================================================

export type RunPhase = 
  | "thinking"    // 🤔 Analyzing context, understanding request
  | "planning"    // 📝 Creating task breakdown
  | "working"     // 🛠️ Executing tasks, calling tools
  | "verifying"   // 🧪 Running verification checks
  | "complete";   // ✅ All tasks done and verified

export interface RunPhaseData {
  phase: RunPhase;
  message?: string;  // Human-readable description
}

// ============================================================================
// TASK MODEL
// ============================================================================

export type TaskStatus = 
  | "backlog" 
  | "in_progress" 
  | "verifying" 
  | "done" 
  | "blocked";

export type TaskOwner = "agent" | "user" | `subagent:${string}`;

export interface VerificationCheck {
  id: string;
  kind: "assert_file_exists" | "assert_file_contains" | "run_tests" | "fetch_url" | "bash_check";
  status: "pending" | "passed" | "failed";
  details?: any;
  timestamp?: string;
}

export interface TaskVerification {
  checks: VerificationCheck[];
  summary?: string;  // Short human summary for UI badge
}

export interface Task {
  id: string;
  title: string;
  status: TaskStatus;
  owner: TaskOwner;
  dependsOn?: string[];
  createdAt: string;
  updatedAt: string;
  verification?: TaskVerification;
  artifacts?: string[];  // Paths/URLs from tool results
}

export interface TaskCreatedData {
  task: Task;
}

export interface TaskUpdatedData {
  taskId: string;
  status?: TaskStatus;
  verification?: TaskVerification;
  artifacts?: string[];
}

// ============================================================================
// TOOL EVENTS
// ============================================================================

export interface ToolCalledData {
  name: string;
  args: Record<string, any>;
  correlationId: string;  // Unique ID to match call → result
  taskId?: string;
}

export interface ToolSucceededData {
  name: string;
  correlationId: string;
  durationMs: number;
  result: any;
  taskId?: string;
}

export interface ToolFailedData {
  name: string;
  correlationId: string;
  durationMs: number;
  error: string;
  exitCode?: number;
  stderr?: string;
  taskId?: string;
}

// ============================================================================
// VERIFICATION EVENTS
// ============================================================================

export interface VerifyRequestedData {
  check: VerificationCheck;
  taskId: string;
}

export interface VerifyResultData {
  check: VerificationCheck;
  taskId: string;
  passed: boolean;
}

// ============================================================================
// ARTIFACT EVENTS
// ============================================================================

export interface ArtifactCreatedData {
  path: string;
  type: "file" | "url" | "report";
  size?: number;
  taskId?: string;
}

export interface ArtifactUpdatedData {
  path: string;
  type: "file" | "url" | "report";
  operation: "modify" | "delete";
  taskId?: string;
}

// ============================================================================
// DELEGATION EVENTS
// ============================================================================

export interface AgentDelegatedData {
  subagentName: string;
  taskId: string;
  reason: string;
  capabilities?: string[];
}

// ============================================================================
// GUIDANCE EVENTS
// ============================================================================

export interface AgentGuidanceData {
  question: string;
  options?: string[];  // Multiple choice options, if applicable
  context?: string;
  requiresResponse: boolean;
}

// ============================================================================
// MESSAGE EVENTS
// ============================================================================

export interface MessageUserData {
  messageId: string;
  content: string;
  timestamp: string;
}

export interface MessageAgentData {
  messageId: string;
  content: string;
  timestamp: string;
}

// ============================================================================
// PLAN EVENTS
// ============================================================================

export interface PlanCreatedData {
  planId: string;
  tasks: Task[];
  summary: string;
}

// ============================================================================
// EVENT FACTORY (Helper for creating properly formatted events)
// ============================================================================

export function createEvent<T>(
  type: EventType,
  actor: Actor,
  data: T
): EventEnvelope<T> {
  return {
    id: generateId(),
    ts: new Date().toISOString(),
    type,
    actor,
    data
  };
}

// ============================================================================
// UX COPY CONSTANTS
// ============================================================================

export const PHASE_MESSAGES: Record<RunPhase, string> = {
  thinking: "scanning context",
  planning: "drafting checklist",
  working: "executing step",
  verifying: "running checks",
  complete: "all steps passed"
};

export const PHASE_EMOJIS: Record<RunPhase, string> = {
  thinking: "🤔",
  planning: "📝",
  working: "🛠️",
  verifying: "🧪",
  complete: "✅"
};

// ============================================================================
// OBSERVABILITY METRICS
// ============================================================================

export interface RunMetrics {
  runId: string;
  totalToolCalls: number;
  successfulToolCalls: number;
  failedToolCalls: number;
  averageDurationMs: number;
  topFailingTools: Array<{ name: string; count: number }>;
  startTime: string;
  endTime?: string;
}

export interface TaskMetrics {
  taskId: string;
  timeInStateMs: Record<TaskStatus, number>;
  retryCount: number;
  verificationPassRate: number;
}

// ============================================================================
// DEPLOYMENT EVENTS
// ============================================================================

export type DeploymentStepStatus = "pending" | "in_progress" | "complete" | "failed";

export interface DeploymentStep {
  name: string;
  status: DeploymentStepStatus;
  durationMs?: number;
  startTime?: string;
  endTime?: string;
}

export interface DeploymentStartedData {
  deploymentId: string;
  commitHash: string;
  commitMessage: string;
  commitUrl: string;
  timestamp: string;
  platform: "github" | "railway" | "replit";
}

export interface DeploymentStepUpdateData {
  deploymentId: string;
  stepName: string;
  status: DeploymentStepStatus;
  durationMs?: number;
  message?: string;
}

export interface DeploymentCompleteData {
  deploymentId: string;
  status: "successful" | "failed";
  totalDurationMs: number;
  steps: DeploymentStep[];
  deploymentUrl?: string;
  errorMessage?: string;
}

export interface DeploymentFailedData {
  deploymentId: string;
  stepName: string;
  errorMessage: string;
  timestamp: string;
}
