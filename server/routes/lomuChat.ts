import { Router } from 'express';
import { db } from '../db.ts';
import { storage } from '../storage.ts';
import { chatMessages, taskLists, tasks, lomuAttachments, lomuJobs, users, subscriptions, projects, conversationStates, platformIncidents, tokenLedger } from '@shared/schema';
import { eq, and, desc, sql } from 'drizzle-orm';
import { isAuthenticated, isAdmin } from '../universalAuth.ts';
import { aiLimiter } from '../rateLimiting';
import { streamGeminiResponse } from '../gemini.ts';
import { TokenTracker } from '../services/tokenTracker.ts';
import { CreditManager } from '../services/creditManager.ts';
import { RAILWAY_CONFIG } from '../config/railway.ts';
import { platformHealing } from '../platformHealing.ts';
import { platformAudit } from '../platformAudit.ts';
import { healOrchestrator } from '../services/healOrchestrator.ts';
import { consultArchitect } from '../tools/architect-consult.ts';
import { executeWebSearch } from '../tools/web-search.ts';
import { GitHubService, getGitHubService } from '../githubService.ts';
import { createTaskList, updateTask, readTaskList } from '../tools/task-management.ts';
import { performDiagnosis } from '../tools/diagnosis.ts';
import { startSubagent } from '../subagentOrchestration.ts';
import { parallelSubagentQueue } from '../services/parallelSubagentQueue.ts';
import { lomuAIBrain } from '../services/lomuAIBrain.ts';
import * as fs from 'fs/promises';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import { createSafeAnthropicRequest } from '../lib/anthropic-wrapper.ts';
import { sanitizeDiagnosisForAI } from '../lib/diagnosis-sanitizer.ts';
import { filterToolCallsFromMessages } from '../lib/message-filter.ts';
import type { WebSocketServer } from 'ws';
import { broadcastToUser, broadcastToProject } from './websocket.ts';
import { getOrCreateState, formatStateForPrompt, updateCodeScratchpad, getCodeScratchpad, clearCodeScratchpad, clearState, estimateConversationTokens, summarizeOldMessages } from '../services/conversationState.ts';
import { agentFailureDetector } from '../services/agentFailureDetector.ts';
import { classifyUserIntent, type UserIntent } from '../shared/chatConfig.ts';
import { validateFileChanges, validateAllChanges, FileChangeTracker, type ValidationResult } from '../services/validationHelpers.ts';
import { PhaseOrchestrator } from '../services/PhaseOrchestrator.ts';
import { RunStateManager } from '../services/RunStateManager.ts';
import { traceLogger } from '../services/traceLogger.ts';
import { nanoid } from 'nanoid';
// Import extracted utilities and constants
import { MAX_CONSECUTIVE_THINKING } from './lomu/constants.ts';
import { LOMU_CORE_TOOLS } from '../tools/tool-distributions.ts';
import {
  mapDatabaseStatusToRunState,
  detectLowConfidencePatterns,
  retryWithBackoff,
  ensureActiveSession,
  validateProjectPath,
  validateContextAccess,
  handleBilling,
  broadcastFileUpdate as broadcastFileUpdateUtil,
  waitForApproval,
  resolveApproval
} from './lomu/utils.ts';

// 🆕 Import modular components from refactored architecture
import { LOMU_LIMITS, getMaxIterationsForIntent } from '../config/lomuLimits.ts';
import { performanceMonitor } from '../services/performanceMonitor.ts';
import {
  configureSSEHeaders,
  sendInitialHeartbeat,
  createEventSender,
  setupHeartbeat,
  setupStreamTimeout,
  setupSocketKeepAlive,
  terminateStream,
  emitSection
} from './lomuChat/streaming.ts';
import {
  estimateTokensFromText,
  calculateTokenEstimate,
  recordTokenUsage,
  formatBillingInfo
} from './lomuChat/billing.ts';
import {
  validateToolExecution,
  formatToolResult,
  recordToolMetric,
  shouldTriggerAntiParalysis,
  getToolTimeout
} from './lomuChat/tools.ts';

import multer from 'multer';

const execAsync = promisify(exec);

// Multer configuration for file uploads
const upload = multer({ dest: 'uploads/' });

// 🎯 INTENT CLASSIFICATION (like Replit Agent)
// Now using shared configuration from chatConfig.ts
// Both regular LomuAI and Platform Healing use the same logic

function classifyUserIntent_DEPRECATED(message: string): UserIntent {
  const lowerMessage = message.toLowerCase();
  
  // 🎯 MULTI-PASS SCORING SYSTEM (more robust than first-match-wins)
  let scores = { build: 0, fix: 0, diagnostic: 0, casual: 0 };
  
  // BUILD intent: Creating new features, planning, architecting, adding functionality
  // EXPANDED: Include planning/design/architecture vocabulary with FLEXIBLE MATCHING
  const buildPatterns = [
    /\b(build|creat|add|implement|mak|develop|writ)/g,                // +3 each (partial match)
    /\b(set up|setup|install|integrat|deploy|publish)/g,              // +3 each (partial)
    /\b(plan|design|architect|outline|draft|prepar|document)/g,       // +3 each (FLEXIBLE)
    /\b(migrat|refactor|restructur|reorganiz)/g,                      // +2 each (FLEXIBLE)
    /\b(new feature|new module|new component|new page)/g,             // +4 each
  ];
  buildPatterns.forEach((pattern, idx) => {
    const matches = lowerMessage.match(pattern);
    if (matches) {
      scores.build += matches.length * (idx === 0 ? 3 : idx === 1 ? 3 : idx === 2 ? 3 : 2);
    }
  });

  // FIX intent: Bug fixes, error resolution, debugging, performance improvements
  const fixPatterns = [
    /\b(fix|debug|resolv|error|bug|issu|broken|fail)/g,               // +3 each
    /\b(performanc|optimis|speed up|slow)/g,                          // +2 each
    /\b(crash|hang|stuck|loop)/g,                                     // +4 each
  ];
  fixPatterns.forEach((pattern, idx) => {
    const matches = lowerMessage.match(pattern);
    if (matches) {
      scores.fix += matches.length * (idx === 0 ? 3 : 2);
    }
  });

  // DIAGNOSTIC intent: Analyzing, checking, auditing, understanding code
  const diagnosticPatterns = [
    /\b(diagnos|check|analys|audit|investigat|understand|explor)/g,   // +3 each
    /\b(what is|how does|tell me about|explain)/g,                    // +2 each
    /\b(codebase|project structur|file system)/g,                     // +2 each
  ];
  diagnosticPatterns.forEach((pattern, idx) => {
    const matches = lowerMessage.match(pattern);
    if (matches) {
      scores.diagnostic += matches.length * (idx === 0 ? 3 : 2);
    }
  });

  // CASUAL intent: Greetings, general conversation, non-technical
  const casualPatterns = [
    /\b(hello|hi|hey|how are you|what's up|good morning|good afternoon)/g, // +3 each
    /\b(thank you|thanks|appreciat)/g,                                   // +2 each
    /\b(ok|okay|alright|got it)/g,                                       // +1 each
  ];
  casualPatterns.forEach((pattern, idx) => {
    const matches = lowerMessage.match(pattern);
    if (matches) {
      scores.casual += matches.length * (idx === 0 ? 3 : 2);
    }
  });

  // Determine the highest scoring intent
  let highestScore = 0;
  let highestIntent: UserIntent = "casual";
  for (const intent in scores) {
    if (scores[intent as UserIntent] > highestScore) {
      highestScore = scores[intent as UserIntent];
      highestIntent = intent as UserIntent;
    }
  }

  // If scores are tied, apply tie-breaking rules (e.g., prefer 'fix' over 'build')
  if (highestScore > 0) {
    if (scores.fix === highestScore && highestIntent !== "fix") {
      highestIntent = "fix";
    } else if (scores.build === highestScore && highestIntent !== "build" && highestIntent !== "fix") {
      highestIntent = "build";
    }
  }

  return highestIntent;
}

const router = Router();

// Image upload endpoint
router.post('/upload-image', isAuthenticated, upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No image file provided' });
    }

    const userId = req.user?.id;
    if (!userId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const imageUrl = `/uploads/${req.file.filename}`;

    // Save attachment info to database
    await db.insert(lomuAttachments).values({
      id: nanoid(),
      userId: userId,
      fileName: req.file.filename,
      filePath: imageUrl,
      mimeType: req.file.mimetype,
      size: req.file.size,
      uploadedAt: new Date(),
    });

    res.status(200).json({ imageUrl });
  } catch (error) {
    console.error('Error uploading image:', error);
    res.status(500).json({ error: 'Failed to upload image' });
  }
});

// Main chat endpoint (SSE)
router.get('/chat', isAuthenticated, aiLimiter, async (req, res) => {
  // ... (rest of the chat endpoint logic)
});

// Existing chat endpoint (POST for initial message)
router.post('/chat', isAuthenticated, aiLimiter, async (req, res) => {
  // ... (rest of the chat endpoint logic)
});

export default router;
