/**
 * Agent Communication System
 * 
 * This module provides cross-agent communication patterns for:
 * - SySop (The Coder) - Builds user projects
 * - LomuAI - Platform self-healing system
 * - I AM (The Architect) - Architectural consultant
 * 
 * COMMUNICATION PATTERNS:
 * 1. Status Broadcasting - Real-time agent status updates
 * 2. Approval Workflows - Request architect approval for critical changes
 * 3. Escalation Patterns - Escalate when stuck or in deadlock
 * 4. Delegation Protocol - Standardized task handoff between agents
 * 5. Evidence Sharing - Pass code, logs, diagnostics between agents
 */

import type { WebSocketServer } from 'ws';
import { broadcastToUser, broadcastToAll } from './routes/websocket';

// ═══════════════════════════════════════════════════════════════════
// INTERFACES & TYPES
// ═══════════════════════════════════════════════════════════════════

/**
 * Agent Types in the Archetype Platform
 */
export type AgentType = 'sysop' | 'lomu-ai' | 'architect' | 'sub-agent';

/**
 * Agent Status States
 */
export type AgentStatus = 
  | 'idle'           // Not actively working
  | 'thinking'       // Analyzing the problem
  | 'working'        // Actively executing tasks
  | 'waiting_approval' // Waiting for architect approval
  | 'blocked'        // Stuck, needs escalation
  | 'delegating'     // Delegating to sub-agent
  | 'completed'      // Task completed successfully
  | 'failed';        // Task failed

/**
 * Agent Capabilities Registry
 * Defines what each agent can do
 */
export interface AgentCapabilities {
  agentType: AgentType;
  capabilities: string[];
  restrictions: string[];
  expertiseAreas: string[];
}

/**
 * Agent Status Message
 * Broadcast to clients for real-time updates
 */
export interface AgentStatusMessage {
  type: 'agent_status';
  agentType: AgentType;
  agentId?: string;
  status: AgentStatus;
  currentTask?: string;
  progress?: number; // 0-100
  timestamp: string;
  metadata?: Record<string, any>;
}

/**
 * Architect Approval Request
 * Formal request for I AM to review critical changes
 */
export interface ArchitectApprovalRequest {
  requestId: string;
  requestedBy: AgentType;
  userId: string;
  projectId?: string;
  changeType: 'architecture' | 'security' | 'performance' | 'breaking_change';
  description: string;
  proposedChanges: {
    filePath: string;
    operation: 'create' | 'modify' | 'delete';
    currentContent?: string;
    proposedContent?: string;
    reason: string;
  }[];
  context: {
    problemStatement: string;
    alternativesConsidered?: string[];
    riskAssessment?: string;
    impactAnalysis?: string;
  };
  evidence?: {
    codeSnapshots?: Record<string, string>;
    logs?: string[];
    diagnostics?: any;
  };
  urgency: 'low' | 'medium' | 'high' | 'critical';
  timestamp: string;
}

/**
 * Architect Approval Response
 */
export interface ArchitectApprovalResponse {
  requestId: string;
  approved: boolean;
  architectId: string;
  guidance: string;
  recommendations: string[];
  conditions?: string[]; // Conditions that must be met
  alternativeApproach?: string;
  evidenceUsed?: string[];
  filesInspected?: string[];
  timestamp: string;
}

/**
 * Escalation Request
 * When an agent is stuck and needs help
 */
export interface EscalationRequest {
  escalationId: string;
  escalatedBy: AgentType;
  escalatedTo: AgentType;
  userId: string;
  projectId?: string;
  reason: 'deadlock' | 'complexity' | 'security_concern' | 'architectural_decision' | 'unknown_error';
  description: string;
  context: {
    problemStatement: string;
    attemptedSolutions: string[];
    failureReasons: string[];
    currentState: any;
  };
  evidence: {
    codeSnapshot?: Record<string, string>;
    errorLogs?: string[];
    stackTraces?: string[];
    diagnostics?: any;
  };
  timestamp: string;
}

/**
 * Escalation Response
 */
export interface EscalationResponse {
  escalationId: string;
  respondedBy: AgentType;
  success: boolean;
  guidance: string;
  actionItems: string[];
  suggestedApproach?: string;
  codeExamples?: Record<string, string>;
  referenceDocs?: string[];
  timestamp: string;
}

/**
 * Task Delegation
 * Standardized protocol for passing work between agents
 */
export interface TaskDelegation {
  delegationId: string;
  delegatedBy: AgentType;
  delegatedTo: AgentType | 'sub-agent';
  subAgentType?: 'specialist' | 'tester' | 'reviewer' | 'analyzer';
  userId: string;
  projectId?: string;
  taskId?: string;
  task: {
    title: string;
    description: string;
    acceptanceCriteria: string[];
    priority: 'low' | 'medium' | 'high';
    estimatedEffort?: string;
  };
  context: {
    relevantFiles?: string[];
    dependencies?: string[];
    constraints?: string[];
    backgroundInfo?: string;
  };
  handoff: {
    currentProgress?: string;
    nextSteps?: string[];
    warningsOrCaveats?: string[];
  };
  timestamp: string;
}

/**
 * Task Handoff Response
 */
export interface TaskHandoffResponse {
  delegationId: string;
  acceptedBy: AgentType;
  accepted: boolean;
  reason?: string;
  estimatedCompletion?: string;
  timestamp: string;
}

/**
 * Evidence Package
 * Structured evidence sharing between agents
 */
export interface EvidencePackage {
  packageId: string;
  providedBy: AgentType;
  receivedBy: AgentType;
  userId: string;
  projectId?: string;
  evidenceType: 'code' | 'logs' | 'diagnostics' | 'test_results' | 'performance_metrics';
  title: string;
  description: string;
  data: {
    files?: Record<string, string>; // filename -> content
    logs?: string[];
    metrics?: Record<string, any>;
    screenshots?: string[];
    other?: any;
  };
  metadata: {
    collectedAt: string;
    environment?: 'development' | 'production';
    tags?: string[];
  };
  timestamp: string;
}

// ═══════════════════════════════════════════════════════════════════
// AGENT CAPABILITIES REGISTRY
// ═══════════════════════════════════════════════════════════════════

/**
 * Get agent capabilities
 * Returns what each agent can do and their expertise areas
 */
export function getAgentCapabilities(agentType: AgentType): AgentCapabilities {
  const capabilities: Record<AgentType, AgentCapabilities> = {
    'sysop': {
      agentType: 'sysop',
      capabilities: [
        'Build user projects from scratch',
        'Write production-ready code',
        'Create full-stack applications',
        'Implement features and fix bugs',
        'Self-test and validate code',
        'Delegate to sub-agents',
        'Request architect consultation',
        'Deploy to production',
      ],
      restrictions: [
        'Cannot modify platform files',
        'Cannot access admin features',
        'Works only on user projects',
      ],
      expertiseAreas: [
        'Full-stack development',
        'React/TypeScript',
        'Node.js/Express',
        'Database design',
        'API development',
        'UI/UX implementation',
      ],
    },
    'lomu-ai': {
      agentType: 'lomu-ai',
      capabilities: [
        'Modify platform source code',
        'Fix platform bugs',
        'Commit to GitHub',
        'Trigger Render deployments',
        'Orchestrate sub-agents for parallel work',
        'Run platform diagnostics',
        'Create and restore backups',
      ],
      restrictions: [
        'Only accessible by platform owner',
        'Cannot work on user projects',
        'Requires explicit approval for destructive changes',
      ],
      expertiseAreas: [
        'Platform architecture',
        'DevOps and deployment',
        'System optimization',
        'Bug fixing and debugging',
        'Code refactoring',
      ],
    },
    'architect': {
      agentType: 'architect',
      capabilities: [
        'Provide architectural guidance',
        'Code review and analysis',
        'Security audit',
        'Performance recommendations',
        'Best practices consultation',
        'Read platform code',
        'Search historical knowledge',
      ],
      restrictions: [
        'Read-only access',
        'Cannot write or modify code',
        'Cannot execute tools that modify state',
      ],
      expertiseAreas: [
        'Software architecture',
        'System design',
        'Security best practices',
        'Performance optimization',
        'Code quality and maintainability',
      ],
    },
    'sub-agent': {
      agentType: 'sub-agent',
      capabilities: [
        'Execute delegated tasks',
        'Specialized problem solving',
        'Parallel workstream execution',
        'Report results to parent agent',
      ],
      restrictions: [
        'Limited to delegated task scope',
        'Cannot escalate independently',
        'Works under parent agent supervision',
      ],
      expertiseAreas: [
        'Task specialization based on type',
        'Focused problem solving',
      ],
    },
  };

  return capabilities[agentType];
}

/**
 * Discover available agents and their capabilities
 * Useful for agents to understand who to delegate to
 */
export function discoverAgentCapabilities(): Record<AgentType, AgentCapabilities> {
  return {
    'sysop': getAgentCapabilities('sysop'),
    'lomu-ai': getAgentCapabilities('lomu-ai'),
    'architect': getAgentCapabilities('architect'),
    'sub-agent': getAgentCapabilities('sub-agent'),
  };
}

// ═══════════════════════════════════════════════════════════════════
// STATUS BROADCASTING
// ═══════════════════════════════════════════════════════════════════

/**
 * Broadcast Agent Status
 * 
 * Sends real-time status updates to connected clients via WebSocket.
 * This keeps users informed about what the agent is doing.
 * 
 * @example
 * ```typescript
 * // Agent starts working
 * broadcastAgentStatus(wss, 'sysop', {
 *   userId: 'user123',
 *   status: 'working',
 *   currentTask: 'Creating React components',
 *   progress: 35
 * });
 * 
 * // Agent completes task
 * broadcastAgentStatus(wss, 'sysop', {
 *   userId: 'user123',
 *   status: 'completed',
 *   currentTask: 'Project build complete',
 *   progress: 100
 * });
 * ```
 */
export function broadcastAgentStatus(
  wss: WebSocketServer,
  agentType: AgentType,
  params: {
    userId?: string;
    agentId?: string;
    status: AgentStatus;
    currentTask?: string;
    progress?: number;
    metadata?: Record<string, any>;
  }
): void {
  const message: AgentStatusMessage = {
    type: 'agent_status',
    agentType,
    agentId: params.agentId,
    status: params.status,
    currentTask: params.currentTask,
    progress: params.progress,
    timestamp: new Date().toISOString(),
    metadata: params.metadata,
  };

  if (params.userId) {
    // Broadcast to specific user
    broadcastToUser(wss, params.userId, message);
    console.log(`[AGENT-COMM] Status broadcast to user ${params.userId}: ${agentType} is ${params.status}`);
  } else {
    // Broadcast to all (for platform-wide updates)
    broadcastToAll(wss, message);
    console.log(`[AGENT-COMM] Status broadcast to all: ${agentType} is ${params.status}`);
  }
}

// ═══════════════════════════════════════════════════════════════════
// ARCHITECT APPROVAL WORKFLOW
// ═══════════════════════════════════════════════════════════════════

/**
 * Request Architect Approval
 * 
 * Formal approval request pattern for critical changes.
 * Use when making architectural decisions, security changes, or breaking modifications.
 * 
 * @example
 * ```typescript
 * const approvalRequest = requestArchitectApproval({
 *   requestedBy: 'lomu-ai',
 *   userId: 'owner123',
 *   changeType: 'architecture',
 *   description: 'Refactor WebSocket system to support multiple concurrent connections',
 *   proposedChanges: [
 *     {
 *       filePath: 'server/routes/websocket.ts',
 *       operation: 'modify',
 *       currentContent: '// old code...',
 *       proposedContent: '// new code...',
 *       reason: 'Improve scalability and connection management'
 *     }
 *   ],
 *   context: {
 *     problemStatement: 'Current WebSocket system doesn\'t handle concurrent sessions well',
 *     alternativesConsidered: ['Redis pub/sub', 'Socket.io', 'Native WebSocket refactor'],
 *     riskAssessment: 'Medium - breaking change for existing clients',
 *     impactAnalysis: 'Will require client reconnection logic update'
 *   },
 *   urgency: 'high'
 * });
 * 
 * console.log('Approval Request ID:', approvalRequest.requestId);
 * // Now wait for I AM to review and respond
 * ```
 */
export function requestArchitectApproval(params: {
  requestedBy: AgentType;
  userId: string;
  projectId?: string;
  changeType: 'architecture' | 'security' | 'performance' | 'breaking_change';
  description: string;
  proposedChanges: {
    filePath: string;
    operation: 'create' | 'modify' | 'delete';
    currentContent?: string;
    proposedContent?: string;
    reason: string;
  }[];
  context: {
    problemStatement: string;
    alternativesConsidered?: string[];
    riskAssessment?: string;
    impactAnalysis?: string;
  };
  evidence?: {
    codeSnapshots?: Record<string, string>;
    logs?: string[];
    diagnostics?: any;
  };
  urgency?: 'low' | 'medium' | 'high' | 'critical';
}): ArchitectApprovalRequest {
  const request: ArchitectApprovalRequest = {
    requestId: `arch-approval-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    requestedBy: params.requestedBy,
    userId: params.userId,
    projectId: params.projectId,
    changeType: params.changeType,
    description: params.description,
    proposedChanges: params.proposedChanges,
    context: params.context,
    evidence: params.evidence,
    urgency: params.urgency || 'medium',
    timestamp: new Date().toISOString(),
  };

  console.log(`[AGENT-COMM] 🏛️ Architect approval requested by ${params.requestedBy}`);
  console.log(`[AGENT-COMM]    Request ID: ${request.requestId}`);
  console.log(`[AGENT-COMM]    Change Type: ${params.changeType}`);
  console.log(`[AGENT-COMM]    Urgency: ${request.urgency}`);
  console.log(`[AGENT-COMM]    Files affected: ${params.proposedChanges.length}`);

  // In a full implementation, this would be stored in database
  // and retrieved by I AM when consulted
  return request;
}

/**
 * Process Architect Approval Response
 * 
 * Called by I AM after reviewing an approval request
 * 
 * @example
 * ```typescript
 * const response = processArchitectApproval({
 *   requestId: 'arch-approval-123',
 *   approved: true,
 *   architectId: 'architect-001',
 *   guidance: 'Approved with conditions. Implement connection pooling first.',
 *   recommendations: [
 *     'Add connection timeout handling',
 *     'Implement graceful reconnection strategy',
 *     'Add comprehensive error logging'
 *   ],
 *   conditions: [
 *     'Write integration tests before deployment',
 *     'Add feature flag for gradual rollout'
 *   ]
 * });
 * ```
 */
export function processArchitectApproval(params: {
  requestId: string;
  approved: boolean;
  architectId: string;
  guidance: string;
  recommendations: string[];
  conditions?: string[];
  alternativeApproach?: string;
  evidenceUsed?: string[];
  filesInspected?: string[];
}): ArchitectApprovalResponse {
  const response: ArchitectApprovalResponse = {
    requestId: params.requestId,
    approved: params.approved,
    architectId: params.architectId,
    guidance: params.guidance,
    recommendations: params.recommendations,
    conditions: params.conditions,
    alternativeApproach: params.alternativeApproach,
    evidenceUsed: params.evidenceUsed,
    filesInspected: params.filesInspected,
    timestamp: new Date().toISOString(),
  };

  console.log(`[AGENT-COMM] 🏛️ Architect response for ${params.requestId}`);
  console.log(`[AGENT-COMM]    Approved: ${params.approved ? '✅' : '❌'}`);
  console.log(`[AGENT-COMM]    Recommendations: ${params.recommendations.length}`);
  if (params.conditions) {
    console.log(`[AGENT-COMM]    Conditions: ${params.conditions.length}`);
  }

  return response;
}

// ═══════════════════════════════════════════════════════════════════
// ESCALATION PATTERN
// ═══════════════════════════════════════════════════════════════════

/**
 * Escalate to Architect
 * 
 * When an agent is stuck in a deadlock or encounters a complex problem,
 * escalate to I AM (The Architect) for expert guidance.
 * 
 * @example
 * ```typescript
 * // SySop is stuck after 3 failed attempts to fix a bug
 * const escalation = escalateToArchitect({
 *   escalatedBy: 'sysop',
 *   userId: 'user123',
 *   projectId: 'project-456',
 *   reason: 'deadlock',
 *   description: 'Memory leak in WebSocket connections - 3 fix attempts failed',
 *   context: {
 *     problemStatement: 'WebSocket connections not properly cleaned up, causing memory growth',
 *     attemptedSolutions: [
 *       'Added cleanup in close event handler',
 *       'Implemented connection timeout',
 *       'Used WeakMap for connection tracking'
 *     ],
 *     failureReasons: [
 *       'Memory still grows after 1 hour',
 *       'Timeout doesn\'t fire consistently',
 *       'WeakMap doesn\'t prevent leak'
 *     ],
 *     currentState: { activeConnections: 150, memoryUsage: '450MB' }
 *   },
 *   evidence: {
 *     codeSnapshot: {
 *       'server/routes/websocket.ts': '// current code...'
 *     },
 *     errorLogs: ['Memory warning: heap size exceeded', '...'],
 *     diagnostics: { heapUsed: 450000000, connectionCount: 150 }
 *   }
 * });
 * 
 * console.log('Escalation ID:', escalation.escalationId);
 * // I AM will analyze the problem and provide guidance
 * ```
 */
export function escalateToArchitect(params: {
  escalatedBy: AgentType;
  userId: string;
  projectId?: string;
  reason: 'deadlock' | 'complexity' | 'security_concern' | 'architectural_decision' | 'unknown_error';
  description: string;
  context: {
    problemStatement: string;
    attemptedSolutions: string[];
    failureReasons: string[];
    currentState: any;
  };
  evidence: {
    codeSnapshot?: Record<string, string>;
    errorLogs?: string[];
    stackTraces?: string[];
    diagnostics?: any;
  };
}): EscalationRequest {
  const escalation: EscalationRequest = {
    escalationId: `escalation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    escalatedBy: params.escalatedBy,
    escalatedTo: 'architect',
    userId: params.userId,
    projectId: params.projectId,
    reason: params.reason,
    description: params.description,
    context: params.context,
    evidence: params.evidence,
    timestamp: new Date().toISOString(),
  };

  console.log(`[AGENT-COMM] 🆘 Escalation to Architect by ${params.escalatedBy}`);
  console.log(`[AGENT-COMM]    Escalation ID: ${escalation.escalationId}`);
  console.log(`[AGENT-COMM]    Reason: ${params.reason}`);
  console.log(`[AGENT-COMM]    Attempted solutions: ${params.context.attemptedSolutions.length}`);
  console.log(`[AGENT-COMM]    Evidence provided: ${Object.keys(params.evidence).length} types`);

  return escalation;
}

/**
 * Process Escalation Response
 * 
 * Called by I AM after analyzing an escalation
 * 
 * @example
 * ```typescript
 * const response = processEscalationResponse({
 *   escalationId: 'escalation-123',
 *   respondedBy: 'architect',
 *   success: true,
 *   guidance: 'Root cause identified: Event listeners not properly removed',
 *   actionItems: [
 *     'Use AbortController for cleanup',
 *     'Track listeners in a registry',
 *     'Add memory profiling tests'
 *   ],
 *   suggestedApproach: 'Implement listener lifecycle management pattern',
 *   codeExamples: {
 *     'cleanup-pattern.ts': '// example code...'
 *   },
 *   referenceDocs: [
 *     'https://nodejs.org/api/events.html#events_class_eventemitter'
 *   ]
 * });
 * ```
 */
export function processEscalationResponse(params: {
  escalationId: string;
  respondedBy: AgentType;
  success: boolean;
  guidance: string;
  actionItems: string[];
  suggestedApproach?: string;
  codeExamples?: Record<string, string>;
  referenceDocs?: string[];
}): EscalationResponse {
  const response: EscalationResponse = {
    escalationId: params.escalationId,
    respondedBy: params.respondedBy,
    success: params.success,
    guidance: params.guidance,
    actionItems: params.actionItems,
    suggestedApproach: params.suggestedApproach,
    codeExamples: params.codeExamples,
    referenceDocs: params.referenceDocs,
    timestamp: new Date().toISOString(),
  };

  console.log(`[AGENT-COMM] 🆘 Escalation response for ${params.escalationId}`);
  console.log(`[AGENT-COMM]    Success: ${params.success ? '✅' : '❌'}`);
  console.log(`[AGENT-COMM]    Action items: ${params.actionItems.length}`);

  return response;
}

// ═══════════════════════════════════════════════════════════════════
// DELEGATION PROTOCOL
// ═══════════════════════════════════════════════════════════════════

/**
 * Delegate to Sub-Agent
 * 
 * Standardized protocol for delegating tasks to specialized sub-agents.
 * Use for parallel work, specialized tasks, or when orchestrating complex operations.
 * 
 * @example
 * ```typescript
 * // LomuAI delegates database migration to specialist sub-agent
 * const delegation = delegateToSubAgent({
 *   delegatedBy: 'lomu-ai',
 *   subAgentType: 'specialist',
 *   userId: 'owner123',
 *   task: {
 *     title: 'Migrate user preferences to new schema',
 *     description: 'Update database schema and migrate existing data',
 *     acceptanceCriteria: [
 *       'Schema updated with new columns',
 *       'All existing data migrated successfully',
 *       'Zero data loss',
 *       'Migration script is idempotent'
 *     ],
 *     priority: 'high',
 *     estimatedEffort: '30 minutes'
 *   },
 *   context: {
 *     relevantFiles: ['shared/schema.ts', 'server/storage.ts'],
 *     dependencies: ['drizzle-orm migration must run first'],
 *     constraints: ['Cannot drop tables', 'Must maintain backward compatibility'],
 *     backgroundInfo: 'Users currently have preferences in JSON column, need proper columns'
 *   },
 *   handoff: {
 *     currentProgress: 'Schema designed, ready for implementation',
 *     nextSteps: [
 *       'Add new columns to schema',
 *       'Create migration script',
 *       'Test with sample data',
 *       'Deploy to production'
 *     ],
 *     warningsOrCaveats: ['Production database has 10k+ users, migration may be slow']
 *   }
 * });
 * 
 * console.log('Delegation ID:', delegation.delegationId);
 * // Sub-agent executes task and reports back
 * ```
 */
export function delegateToSubAgent(params: {
  delegatedBy: AgentType;
  subAgentType?: 'specialist' | 'tester' | 'reviewer' | 'analyzer';
  userId: string;
  projectId?: string;
  taskId?: string;
  task: {
    title: string;
    description: string;
    acceptanceCriteria: string[];
    priority: 'low' | 'medium' | 'high';
    estimatedEffort?: string;
  };
  context: {
    relevantFiles?: string[];
    dependencies?: string[];
    constraints?: string[];
    backgroundInfo?: string;
  };
  handoff: {
    currentProgress?: string;
    nextSteps?: string[];
    warningsOrCaveats?: string[];
  };
}): TaskDelegation {
  const delegation: TaskDelegation = {
    delegationId: `delegation-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    delegatedBy: params.delegatedBy,
    delegatedTo: 'sub-agent',
    subAgentType: params.subAgentType || 'specialist',
    userId: params.userId,
    projectId: params.projectId,
    taskId: params.taskId,
    task: params.task,
    context: params.context,
    handoff: params.handoff,
    timestamp: new Date().toISOString(),
  };

  console.log(`[AGENT-COMM] 🤝 Task delegated by ${params.delegatedBy}`);
  console.log(`[AGENT-COMM]    Delegation ID: ${delegation.delegationId}`);
  console.log(`[AGENT-COMM]    Task: ${params.task.title}`);
  console.log(`[AGENT-COMM]    Priority: ${params.task.priority}`);
  console.log(`[AGENT-COMM]    Sub-agent type: ${params.subAgentType || 'specialist'}`);
  console.log(`[AGENT-COMM]    Acceptance criteria: ${params.task.acceptanceCriteria.length}`);

  return delegation;
}

/**
 * Process Task Handoff Response
 * 
 * Called by sub-agent to accept or reject delegation
 * 
 * @example
 * ```typescript
 * const response = processTaskHandoff({
 *   delegationId: 'delegation-123',
 *   acceptedBy: 'sub-agent',
 *   accepted: true,
 *   estimatedCompletion: '2024-01-15T14:30:00Z'
 * });
 * ```
 */
export function processTaskHandoff(params: {
  delegationId: string;
  acceptedBy: AgentType;
  accepted: boolean;
  reason?: string;
  estimatedCompletion?: string;
}): TaskHandoffResponse {
  const response: TaskHandoffResponse = {
    delegationId: params.delegationId,
    acceptedBy: params.acceptedBy,
    accepted: params.accepted,
    reason: params.reason,
    estimatedCompletion: params.estimatedCompletion,
    timestamp: new Date().toISOString(),
  };

  console.log(`[AGENT-COMM] 🤝 Task handoff response for ${params.delegationId}`);
  console.log(`[AGENT-COMM]    Accepted: ${params.accepted ? '✅' : '❌'}`);
  if (params.estimatedCompletion) {
    console.log(`[AGENT-COMM]    ETA: ${params.estimatedCompletion}`);
  }

  return response;
}

// ═══════════════════════════════════════════════════════════════════
// EVIDENCE SHARING
// ═══════════════════════════════════════════════════════════════════

/**
 * Share Evidence Package
 * 
 * Pass code, logs, diagnostics, and other evidence between agents.
 * Useful for collaboration and informed decision-making.
 * 
 * @example
 * ```typescript
 * // SySop shares test results with Architect for review
 * const evidence = shareEvidencePackage({
 *   providedBy: 'sysop',
 *   receivedBy: 'architect',
 *   userId: 'user123',
 *   projectId: 'project-456',
 *   evidenceType: 'test_results',
 *   title: 'Integration test results for payment flow',
 *   description: 'All tests passing but performance is slower than expected',
 *   data: {
 *     files: {
 *       'tests/payment.test.ts': '// test code...',
 *       'src/payment-service.ts': '// implementation...'
 *     },
 *     logs: [
 *       'Test suite: Payment Flow',
 *       '✓ Create payment (245ms)',
 *       '✓ Process payment (1850ms)',
 *       '✓ Refund payment (320ms)'
 *     ],
 *     metrics: {
 *       totalTests: 15,
 *       passed: 15,
 *       failed: 0,
 *       avgDuration: '850ms',
 *       slowestTest: 'Process payment - 1850ms'
 *     }
 *   },
 *   metadata: {
 *     collectedAt: new Date().toISOString(),
 *     environment: 'development',
 *     tags: ['payment', 'integration-tests', 'performance-concern']
 *   }
 * });
 * 
 * console.log('Evidence Package ID:', evidence.packageId);
 * ```
 */
export function shareEvidencePackage(params: {
  providedBy: AgentType;
  receivedBy: AgentType;
  userId: string;
  projectId?: string;
  evidenceType: 'code' | 'logs' | 'diagnostics' | 'test_results' | 'performance_metrics';
  title: string;
  description: string;
  data: {
    files?: Record<string, string>;
    logs?: string[];
    metrics?: Record<string, any>;
    screenshots?: string[];
    other?: any;
  };
  metadata: {
    collectedAt: string;
    environment?: 'development' | 'production';
    tags?: string[];
  };
}): EvidencePackage {
  const evidence: EvidencePackage = {
    packageId: `evidence-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    providedBy: params.providedBy,
    receivedBy: params.receivedBy,
    userId: params.userId,
    projectId: params.projectId,
    evidenceType: params.evidenceType,
    title: params.title,
    description: params.description,
    data: params.data,
    metadata: params.metadata,
    timestamp: new Date().toISOString(),
  };

  console.log(`[AGENT-COMM] 📦 Evidence shared: ${params.providedBy} → ${params.receivedBy}`);
  console.log(`[AGENT-COMM]    Package ID: ${evidence.packageId}`);
  console.log(`[AGENT-COMM]    Type: ${params.evidenceType}`);
  console.log(`[AGENT-COMM]    Title: ${params.title}`);
  if (params.data.files) {
    console.log(`[AGENT-COMM]    Files: ${Object.keys(params.data.files).length}`);
  }
  if (params.data.logs) {
    console.log(`[AGENT-COMM]    Log entries: ${params.data.logs.length}`);
  }

  return evidence;
}

// ═══════════════════════════════════════════════════════════════════
// UTILITY FUNCTIONS
// ═══════════════════════════════════════════════════════════════════

/**
 * Log agent communication event
 * Centralized logging for all agent interactions
 */
export function logAgentCommunication(
  eventType: string,
  agentFrom: AgentType,
  agentTo: AgentType,
  details: Record<string, any>
): void {
  console.log(`[AGENT-COMM] ${eventType.toUpperCase()}: ${agentFrom} → ${agentTo}`);
  Object.entries(details).forEach(([key, value]) => {
    console.log(`[AGENT-COMM]    ${key}: ${JSON.stringify(value).substring(0, 100)}`);
  });
}

/**
 * Validate communication message structure
 * Ensures messages conform to expected formats
 */
export function validateCommunication(message: any, expectedType: string): boolean {
  if (!message || typeof message !== 'object') {
    console.error(`[AGENT-COMM] Invalid message: not an object`);
    return false;
  }

  if (message.type !== expectedType) {
    console.error(`[AGENT-COMM] Invalid message type: expected ${expectedType}, got ${message.type}`);
    return false;
  }

  return true;
}
