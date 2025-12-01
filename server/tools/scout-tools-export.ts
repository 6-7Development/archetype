/**
 * Scout Tools Export
 * 
 * Complete export of all Scout tools for Gemini function calling
 * Unified tool definitions compatible with gemini-2.5-flash/pro
 */

import { SCOUT_TOOLS, SCOUT_AI_SERVICES } from '../config/scout-agent-config';
import { LOMU_TOOLS } from './index';

/**
 * Scout's complete tool list for Gemini function calling
 * These are the 18+ core tools Scout can invoke
 */
export const SCOUT_GEMINI_TOOLS = LOMU_TOOLS;

/**
 * Tool schemas for Gemini function calling
 * Properly formatted for gemini-2.5-flash/pro models
 */
export function getScoutToolSchemas() {
  return SCOUT_GEMINI_TOOLS.map(tool => ({
    name: tool.name,
    description: tool.description,
    input_schema: tool.input_schema,
  }));
}

/**
 * Scout tool metadata for workflow
 */
export const SCOUT_WORKFLOW_METADATA = {
  version: '1.0.0',
  timestamp: new Date().toISOString(),
  totalTools: SCOUT_TOOLS.length,
  geminiToolsCount: SCOUT_GEMINI_TOOLS.length,
  aiServices: SCOUT_AI_SERVICES.map(s => ({
    id: s.id,
    name: s.name,
    provider: s.provider,
    model: s.model,
  })),
};

/**
 * Tool call handler interface
 */
export interface ScoutToolCall {
  toolId: string;
  toolName: string;
  params: Record<string, any>;
  timestamp: Date;
}

export interface ScoutToolResult {
  success: boolean;
  result?: any;
  error?: string;
  executionTimeMs: number;
  toolName: string;
}

export function exportScoutToolsForGemini() {
  return {
    tools: getScoutToolSchemas(),
    metadata: SCOUT_WORKFLOW_METADATA,
    totalAvailable: SCOUT_GEMINI_TOOLS.length,
  };
}
