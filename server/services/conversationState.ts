import { db } from '../db';
import { conversationStates, type ConversationState, type InsertConversationState } from '@shared/schema';
import { eq, and, desc, isNull } from 'drizzle-orm';

/**
 * ConversationState Service
 * 
 * Manages conversation context to prevent AI rambling and maintain focus across turns.
 * Tracks current goals, mentioned files, and session summaries for better AI responses.
 */

/**
 * Initialize a new conversation state for a user/project
 */
export async function initializeState(
  userId: string,
  projectId: string | null = null
): Promise<ConversationState> {
  // Check if state already exists
  const existingState = await getState(userId, projectId);
  if (existingState) {
    return existingState;
  }

  // Create new state
  const [newState] = await db
    .insert(conversationStates)
    .values({
      userId,
      projectId,
      currentGoal: null,
      mentionedFiles: [],
      sessionSummary: null,
      context: {},
    })
    .returning();

  console.log(`[CONVERSATION-STATE] ✅ Initialized state for user ${userId}, project: ${projectId || 'general'}`);
  return newState;
}

/**
 * Get current conversation state for a user/project
 */
export async function getState(
  userId: string,
  projectId: string | null = null
): Promise<ConversationState | null> {
  const query = projectId
    ? and(eq(conversationStates.userId, userId), eq(conversationStates.projectId, projectId))
    : and(eq(conversationStates.userId, userId), isNull(conversationStates.projectId));

  const [state] = await db
    .select()
    .from(conversationStates)
    .where(query)
    .orderBy(desc(conversationStates.lastUpdated))
    .limit(1);

  return state || null;
}

/**
 * Get or create conversation state
 */
export async function getOrCreateState(
  userId: string,
  projectId: string | null = null
): Promise<ConversationState> {
  const state = await getState(userId, projectId);
  if (state) {
    return state;
  }
  return initializeState(userId, projectId);
}

/**
 * Update the current goal
 */
export async function updateGoal(
  stateId: string,
  goal: string
): Promise<ConversationState> {
  const [updated] = await db
    .update(conversationStates)
    .set({
      currentGoal: goal,
      lastUpdated: new Date(),
    })
    .where(eq(conversationStates.id, stateId))
    .returning();

  console.log(`[CONVERSATION-STATE] 🎯 Updated goal for state ${stateId}: "${goal}"`);
  return updated;
}

/**
 * Add a file to the mentioned files list (deduplicates automatically)
 */
export async function addMentionedFile(
  stateId: string,
  filePath: string
): Promise<ConversationState> {
  // Get current state
  const [currentState] = await db
    .select()
    .from(conversationStates)
    .where(eq(conversationStates.id, stateId))
    .limit(1);

  if (!currentState) {
    throw new Error(`State ${stateId} not found`);
  }

  // Add file if not already mentioned
  const mentionedFiles = currentState.mentionedFiles || [];
  if (!mentionedFiles.includes(filePath)) {
    mentionedFiles.push(filePath);

    const [updated] = await db
      .update(conversationStates)
      .set({
        mentionedFiles,
        lastUpdated: new Date(),
      })
      .where(eq(conversationStates.id, stateId))
      .returning();

    console.log(`[CONVERSATION-STATE] 📁 Added file to state ${stateId}: ${filePath}`);
    return updated;
  }

  return currentState;
}

/**
 * Add multiple files to mentioned files list
 */
export async function addMentionedFiles(
  stateId: string,
  filePaths: string[]
): Promise<ConversationState> {
  // Get current state
  const [currentState] = await db
    .select()
    .from(conversationStates)
    .where(eq(conversationStates.id, stateId))
    .limit(1);

  if (!currentState) {
    throw new Error(`State ${stateId} not found`);
  }

  // Add new files (deduplicate)
  const mentionedFiles = currentState.mentionedFiles || [];
  const newFiles = filePaths.filter(fp => !mentionedFiles.includes(fp));
  
  if (newFiles.length > 0) {
    const updatedFiles = [...mentionedFiles, ...newFiles];

    const [updated] = await db
      .update(conversationStates)
      .set({
        mentionedFiles: updatedFiles,
        lastUpdated: new Date(),
      })
      .where(eq(conversationStates.id, stateId))
      .returning();

    console.log(`[CONVERSATION-STATE] 📁 Added ${newFiles.length} files to state ${stateId}`);
    return updated;
  }

  return currentState;
}

/**
 * Update the session summary
 */
export async function updateSummary(
  stateId: string,
  summary: string
): Promise<ConversationState> {
  const [updated] = await db
    .update(conversationStates)
    .set({
      sessionSummary: summary,
      lastUpdated: new Date(),
    })
    .where(eq(conversationStates.id, stateId))
    .returning();

  console.log(`[CONVERSATION-STATE] 📝 Updated summary for state ${stateId}`);
  return updated;
}

/**
 * Update context (structured data)
 */
export async function updateContext(
  stateId: string,
  contextUpdates: Partial<NonNullable<ConversationState['context']>>
): Promise<ConversationState> {
  // Get current state
  const [currentState] = await db
    .select()
    .from(conversationStates)
    .where(eq(conversationStates.id, stateId))
    .limit(1);

  if (!currentState) {
    throw new Error(`State ${stateId} not found`);
  }

  // Merge context
  const updatedContext = {
    ...currentState.context,
    ...contextUpdates,
  };

  const [updated] = await db
    .update(conversationStates)
    .set({
      context: updatedContext,
      lastUpdated: new Date(),
    })
    .where(eq(conversationStates.id, stateId))
    .returning();

  console.log(`[CONVERSATION-STATE] 🔄 Updated context for state ${stateId}`);
  return updated;
}

/**
 * Update entire state (for bulk updates)
 */
export async function updateState(
  stateId: string,
  updates: Partial<ConversationState>
): Promise<ConversationState> {
  const [updated] = await db
    .update(conversationStates)
    .set({
      ...updates,
      lastUpdated: new Date(),
    })
    .where(eq(conversationStates.id, stateId))
    .returning();

  console.log(`[CONVERSATION-STATE] 🔄 Bulk update for state ${stateId}`);
  return updated;
}

/**
 * Clear/reset state for new conversation
 */
export async function clearState(stateId: string): Promise<ConversationState> {
  const [cleared] = await db
    .update(conversationStates)
    .set({
      currentGoal: null,
      mentionedFiles: [],
      sessionSummary: null,
      context: {},
      lastUpdated: new Date(),
    })
    .where(eq(conversationStates.id, stateId))
    .returning();

  console.log(`[CONVERSATION-STATE] 🧹 Cleared state ${stateId}`);
  return cleared;
}

/**
 * Delete a conversation state
 */
export async function deleteState(stateId: string): Promise<void> {
  await db
    .delete(conversationStates)
    .where(eq(conversationStates.id, stateId));

  console.log(`[CONVERSATION-STATE] 🗑️ Deleted state ${stateId}`);
}

/**
 * Format state for injection into AI system prompt
 */
export async function formatStateForPrompt(state: ConversationState | null): Promise<string> {
  // Inject replit.md for project knowledge
  let replitMdContent = '';
  try {
    const fs = await import('fs/promises');
    const path = await import('path');
    const replitMdPath = path.join(process.cwd(), 'replit.md');
    replitMdContent = await fs.readFile(replitMdPath, 'utf-8');
  } catch (error: any) {
    console.warn('[CONTEXT] replit.md not found:', error.message);
  }

  if (!state) {
    return `📂 PROJECT ARCHITECTURE (from replit.md):
${replitMdContent ? `\n${replitMdContent}\n` : '(replit.md not available)'}

CONVERSATION CONTEXT:
- Current Goal: Not yet determined
- Files Mentioned: None
- Session Summary: New conversation`;
  }

  const goal = state.currentGoal || 'Not yet determined';
  const files = state.mentionedFiles && state.mentionedFiles.length > 0
    ? state.mentionedFiles.join(', ')
    : 'None';
  const summary = state.sessionSummary || 'New conversation';

  return `📂 PROJECT ARCHITECTURE (from replit.md):
${replitMdContent ? `\n${replitMdContent}\n` : '(replit.md not available)'}

CONVERSATION CONTEXT:
- Current Goal: ${goal}
- Files Mentioned: ${files}
- Session Summary: ${summary}`;
}

/**
 * Extract mentioned files from message content
 * Looks for file paths in various formats
 */
export function extractFilePaths(content: string): string[] {
  const filePaths: Set<string> = new Set();

  // Pattern 1: File paths with extensions (e.g., server/routes/auth.ts)
  const pathRegex = /(?:^|\s)([a-zA-Z0-9_\-\/\.]+\.(ts|tsx|js|jsx|css|html|json|yml|yaml|md|txt|py|java|go|rs|rb|php))/g;
  let match;
  while ((match = pathRegex.exec(content)) !== null) {
    filePaths.add(match[1]);
  }

  // Pattern 2: Backtick wrapped paths (e.g., `server/routes/auth.ts`)
  const backtickRegex = /`([a-zA-Z0-9_\-\/\.]+\.[a-zA-Z0-9]+)`/g;
  while ((match = backtickRegex.exec(content)) !== null) {
    filePaths.add(match[1]);
  }

  // Pattern 3: Common directory patterns (e.g., in server/routes/)
  const dirRegex = /(?:in|at|from|to|edit|update|modify|check|see)\s+([a-zA-Z0-9_\-\/\.]+)/gi;
  while ((match = dirRegex.exec(content)) !== null) {
    const path = match[1];
    // Only include if it looks like a file path
    if (path.includes('/') || path.includes('.')) {
      filePaths.add(path);
    }
  }

  return Array.from(filePaths);
}

/**
 * Extract goal from user message
 * Looks for phrases indicating user intent
 */
export function extractGoal(content: string): string | null {
  // Patterns that indicate goals
  const goalPatterns = [
    /(?:I want to|I need to|I'm trying to|help me|can you)\s+(.{10,100})/i,
    /(?:fix|build|create|add|implement|update|modify|change)\s+(.{10,100})/i,
    /(?:how (?:do I|can I|to))\s+(.{10,100})/i,
  ];

  for (const pattern of goalPatterns) {
    const match = content.match(pattern);
    if (match) {
      // Clean up the extracted goal
      let goal = match[1].trim();
      // Remove trailing punctuation and newlines
      goal = goal.replace(/[.!?\n].*/, '');
      // Limit length
      if (goal.length > 150) {
        goal = goal.substring(0, 147) + '...';
      }
      if (goal.length > 10) {
        return goal;
      }
    }
  }

  return null;
}

/**
 * Auto-update state based on user message
 */
export async function autoUpdateFromMessage(
  stateId: string,
  userMessage: string
): Promise<ConversationState> {
  let state = await db
    .select()
    .from(conversationStates)
    .where(eq(conversationStates.id, stateId))
    .limit(1)
    .then(rows => rows[0]);

  if (!state) {
    throw new Error(`State ${stateId} not found`);
  }

  // Extract and add files
  const files = extractFilePaths(userMessage);
  if (files.length > 0) {
    state = await addMentionedFiles(stateId, files);
  }

  // Extract and update goal if not already set
  if (!state.currentGoal) {
    const goal = extractGoal(userMessage);
    if (goal) {
      state = await updateGoal(stateId, goal);
    }
  }

  return state;
}
