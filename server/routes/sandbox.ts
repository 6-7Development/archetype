import { Router } from 'express';
import { isAuthenticated } from '../universalAuth.js';
import { codeExecutionService, ExecutionOptions, ExecutionResult } from '../services/codeExecutionService.js';
import { db } from '../db.js';
import { codeExecutionRuns } from '@shared/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';

const router = Router();

const executeCodeSchema = z.object({
  language: z.enum(['javascript', 'typescript', 'python']),
  code: z.string().min(1).max(50000),
  stdin: z.string().optional(),
  timeoutMs: z.number().min(1000).max(30000).optional().default(10000),
  memoryLimitMb: z.number().min(32).max(512).optional().default(128),
  projectId: z.string().optional(),
});

router.post('/run', isAuthenticated, async (req: any, res) => {
  const startTime = Date.now();
  
  try {
    const userId = req.authenticatedUserId;
    const validation = executeCodeSchema.safeParse(req.body);
    
    if (!validation.success) {
      return res.status(400).json({
        success: false,
        error: 'Invalid request',
        details: validation.error.issues,
      });
    }

    const { language, code, stdin, timeoutMs, memoryLimitMb, projectId } = validation.data;

    console.log(`[SANDBOX] Executing ${language} code for user ${userId}`);

    const options: ExecutionOptions = {
      language,
      code,
      stdin,
      timeoutMs,
      memoryLimitMb,
      userId,
      projectId,
    };

    const result: ExecutionResult = await codeExecutionService.execute(options);

    try {
      await db.insert(codeExecutionRuns).values({
        userId,
        projectId: projectId || null,
        language,
        code: code.substring(0, 10000),
        stdin: stdin?.substring(0, 1000) || null,
        success: result.success,
        stdout: result.stdout?.substring(0, 50000) || null,
        stderr: result.stderr?.substring(0, 10000) || null,
        exitCode: result.exitCode,
        durationMs: result.duration,
        killed: result.killed,
        killedReason: result.killedReason || null,
        securityViolations: result.securityViolations || null,
      });
    } catch (dbError) {
      console.error('[SANDBOX] Failed to log execution:', dbError);
    }

    const executionTime = Date.now() - startTime;
    console.log(`[SANDBOX] Execution completed in ${executionTime}ms, success: ${result.success}`);

    res.json({
      success: true,
      result: {
        id: result.id,
        success: result.success,
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
        duration: result.duration,
        killed: result.killed,
        killedReason: result.killedReason,
      },
    });
  } catch (error: any) {
    console.error('[SANDBOX] Execution error:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Execution failed',
    });
  }
});

router.get('/history', isAuthenticated, async (req: any, res) => {
  try {
    const userId = req.authenticatedUserId;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const offset = parseInt(req.query.offset as string) || 0;

    const runs = await db
      .select({
        id: codeExecutionRuns.id,
        language: codeExecutionRuns.language,
        success: codeExecutionRuns.success,
        exitCode: codeExecutionRuns.exitCode,
        durationMs: codeExecutionRuns.durationMs,
        killed: codeExecutionRuns.killed,
        killedReason: codeExecutionRuns.killedReason,
        executedAt: codeExecutionRuns.executedAt,
      })
      .from(codeExecutionRuns)
      .where(eq(codeExecutionRuns.userId, userId))
      .orderBy(desc(codeExecutionRuns.executedAt))
      .limit(limit)
      .offset(offset);

    res.json({ success: true, runs });
  } catch (error: any) {
    console.error('[SANDBOX] History error:', error);
    res.status(500).json({ success: false, error: error.message });
  }
});

router.get('/languages', (req, res) => {
  res.json({
    success: true,
    languages: [
      { id: 'javascript', name: 'JavaScript', extension: 'js' },
      { id: 'typescript', name: 'TypeScript', extension: 'ts' },
      { id: 'python', name: 'Python', extension: 'py' },
    ],
  });
});

export default router;
