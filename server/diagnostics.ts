import { db } from './db';
import { users, projects, files } from '@shared/schema';
import { sql } from 'drizzle-orm';
import fs from 'fs/promises';
import path from 'path';

export interface DiagnosticResult {
  status: 'healthy' | 'warning' | 'error';
  category: string;
  message: string;
  details?: any;
}

export async function runPlatformDiagnostics(): Promise<DiagnosticResult[]> {
  const results: DiagnosticResult[] = [];

  // Database connectivity check
  try {
    const testQuery = await db.select({ count: sql`COUNT(*)` }).from(users);
    results.push({
      status: 'healthy',
      category: 'database',
      message: 'Database connection successful',
      details: { userCount: testQuery[0]?.count || 0 }
    });
  } catch (error) {
    results.push({
      status: 'error',
      category: 'database',
      message: 'Database connection failed',
      details: { error: (error as Error).message }
    });
  }

  // File system permissions check
  try {
    const testPath = path.join(process.cwd(), '.diagnostic-test');
    await fs.writeFile(testPath, 'test');
    await fs.unlink(testPath);
    results.push({
      status: 'healthy',
      category: 'filesystem',
      message: 'File system write permissions OK'
    });
  } catch (error) {
    results.push({
      status: 'error',
      category: 'filesystem',
      message: 'File system write permissions failed',
      details: { error: (error as Error).message }
    });
  }

  // Environment variables check
  const requiredEnvVars = ['DATABASE_URL', 'SESSION_SECRET'];
  const missingEnvVars = requiredEnvVars.filter(v => !process.env[v]);
  
  if (missingEnvVars.length === 0) {
    results.push({
      status: 'healthy',
      category: 'environment',
      message: 'All required environment variables set'
    });
  } else {
    results.push({
      status: 'error',
      category: 'environment',
      message: 'Missing required environment variables',
      details: { missing: missingEnvVars }
    });
  }

  // GitHub integration check
  const githubVars = ['GITHUB_TOKEN', 'GITHUB_REPO'];
  const missingGithub = githubVars.filter(v => !process.env[v]);
  
  if (missingGithub.length === 0) {
    results.push({
      status: 'healthy',
      category: 'github',
      message: 'GitHub integration configured',
      details: { repo: process.env.GITHUB_REPO }
    });
  } else {
    results.push({
      status: 'warning',
      category: 'github',
      message: 'GitHub integration not configured',
      details: { missing: missingGithub }
    });
  }

  // Memory usage check
  const memUsage = process.memoryUsage();
  const heapUsedMB = Math.round(memUsage.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(memUsage.heapTotal / 1024 / 1024);
  
  results.push({
    status: heapUsedMB / heapTotalMB > 0.9 ? 'warning' : 'healthy',
    category: 'memory',
    message: `Memory usage: ${heapUsedMB}MB / ${heapTotalMB}MB`,
    details: memUsage
  });

  return results;
}