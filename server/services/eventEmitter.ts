/**
 * Event Emitter Service for Agent Chatroom UX
 * Handles structured event emission via SSE with proper typing
 */

import type { Response } from 'express';
import {
  EventEnvelope,
  EventType,
  Actor,
  createEvent,
  RunPhaseData,
  TaskCreatedData,
  TaskUpdatedData,
  ToolCalledData,
  ToolSucceededData,
  ToolFailedData,
  VerifyRequestedData,
  VerifyResultData,
  ArtifactCreatedData,
  ArtifactUpdatedData,
  AgentDelegatedData,
  AgentGuidanceData,
  MessageUserData,
  MessageAgentData,
  PlanCreatedData,
  PHASE_EMOJIS,
  PHASE_MESSAGES
} from '@shared/agentEvents';

export class AgentEventEmitter {
  private res: Response;
  private actor: Actor;

  constructor(res: Response, actor: Actor = 'agent') {
    this.res = res;
    this.actor = actor;
  }

  /**
   * Send a properly formatted event to the SSE stream
   */
  private sendEvent<T>(envelope: EventEnvelope<T>): void {
    const json = JSON.stringify(envelope);
    this.res.write(`data: ${json}\n\n`);
  }

  // ========================================================================
  // RUN PHASE EVENTS
  // ========================================================================

  emitPhase(phase: RunPhaseData['phase'], customMessage?: string): void {
    const emoji = PHASE_EMOJIS[phase];
    const defaultMessage = PHASE_MESSAGES[phase];
    const message = customMessage || defaultMessage;

    this.sendEvent(createEvent<RunPhaseData>(
      'run.phase',
      this.actor,
      { phase, message: `${emoji} ${message}` }
    ));
  }

  // ========================================================================
  // TASK EVENTS
  // ========================================================================

  emitPlanCreated(data: PlanCreatedData): void {
    this.sendEvent(createEvent('plan.created', this.actor, data));
  }

  emitTaskCreated(data: TaskCreatedData): void {
    this.sendEvent(createEvent('task.created', this.actor, data));
  }

  emitTaskUpdated(data: TaskUpdatedData): void {
    this.sendEvent(createEvent('task.updated', this.actor, data));
  }

  // ========================================================================
  // TOOL EVENTS
  // ========================================================================

  emitToolCalled(data: ToolCalledData): void {
    this.sendEvent(createEvent('tool.called', this.actor, data));
  }

  emitToolSucceeded(data: ToolSucceededData): void {
    this.sendEvent(createEvent('tool.succeeded', 'system', data));
  }

  emitToolFailed(data: ToolFailedData): void {
    this.sendEvent(createEvent('tool.failed', 'system', data));
  }

  // ========================================================================
  // VERIFICATION EVENTS
  // ========================================================================

  emitVerifyRequested(data: VerifyRequestedData): void {
    this.sendEvent(createEvent('verify.requested', this.actor, data));
  }

  emitVerifyResult(data: VerifyResultData): void {
    this.sendEvent(createEvent('verify.result', 'system', data));
  }

  // ========================================================================
  // ARTIFACT EVENTS
  // ========================================================================

  emitArtifactCreated(data: ArtifactCreatedData): void {
    this.sendEvent(createEvent('artifact.created', 'system', data));
  }

  emitArtifactUpdated(data: ArtifactUpdatedData): void {
    this.sendEvent(createEvent('artifact.updated', 'system', data));
  }

  // ========================================================================
  // DELEGATION EVENTS
  // ========================================================================

  emitAgentDelegated(data: AgentDelegatedData): void {
    this.sendEvent(createEvent('agent.delegated', this.actor, data));
  }

  // ========================================================================
  // GUIDANCE EVENTS
  // ========================================================================

  emitAgentGuidance(data: AgentGuidanceData): void {
    this.sendEvent(createEvent('agent.guidance', this.actor, data));
  }

  // ========================================================================
  // MESSAGE EVENTS
  // ========================================================================

  emitMessageUser(data: MessageUserData): void {
    this.sendEvent(createEvent('message.user', 'user', data));
  }

  emitMessageAgent(data: MessageAgentData): void {
    this.sendEvent(createEvent('message.agent', this.actor, data));
  }

  // ========================================================================
  // LEGACY COMPATIBILITY (for gradual migration)
  // ========================================================================

  /**
   * Legacy progress event - wraps it in the new envelope format
   */
  emitLegacyProgress(message: string): void {
    // Keep backward compatibility with existing UI
    const legacyEvent = { type: 'progress', message };
    this.res.write(`data: ${JSON.stringify(legacyEvent)}\n\n`);
  }

  /**
   * Legacy content event - wraps it in the new envelope format
   */
  emitLegacyContent(content: string): void {
    // Keep backward compatibility with existing UI
    const legacyEvent = { type: 'content', content };
    this.res.write(`data: ${JSON.stringify(legacyEvent)}\n\n`);
  }

  /**
   * Legacy error event
   */
  emitLegacyError(message: string): void {
    const legacyEvent = { type: 'error', message };
    this.res.write(`data: ${JSON.stringify(legacyEvent)}\n\n`);
  }

  /**
   * Legacy done event
   */
  emitLegacyDone(data: { messageId: string; commitHash?: string; filesChanged?: number }): void {
    const legacyEvent = { type: 'done', ...data };
    this.res.write(`data: ${JSON.stringify(legacyEvent)}\n\n`);
  }
}

/**
 * Helper to create an event emitter from an Express Response
 */
export function createEventEmitter(res: Response, actor: Actor = 'agent'): AgentEventEmitter {
  return new AgentEventEmitter(res, actor);
}
