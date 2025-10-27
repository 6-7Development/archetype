import { execFile } from 'child_process';
import { promisify } from 'util';

const execFileAsync = promisify(execFile);

export interface DeploymentInfo {
  version: string;
  commitHash: string;
  commitDate: string;
  commitMessage: string;
  branch: string;
  environment: string;
  buildTime: string;
}

let cachedDeploymentInfo: DeploymentInfo | null = null;
const BUILD_TIME = new Date().toISOString();

export async function getDeploymentInfo(): Promise<DeploymentInfo> {
  if (cachedDeploymentInfo) {
    return cachedDeploymentInfo;
  }

  // 🚂 RAILWAY FIX: Use Railway environment variables (no .git folder on Railway)
  if (process.env.RAILWAY_GIT_COMMIT_SHA) {
    console.log('[DEPLOYMENT-INFO] Using Railway environment variables');
    cachedDeploymentInfo = {
      version: process.env.npm_package_version || '1.0.0',
      commitHash: process.env.RAILWAY_GIT_COMMIT_SHA.substring(0, 7),
      commitDate: new Date().toISOString(), // Railway doesn't provide commit date
      commitMessage: process.env.RAILWAY_GIT_COMMIT_MESSAGE || 'Railway deployment',
      branch: process.env.RAILWAY_GIT_BRANCH || 'main',
      environment: process.env.NODE_ENV || 'production',
      buildTime: BUILD_TIME,
    };
    return cachedDeploymentInfo;
  }

  // Try git commands (Replit/local development)
  try {
    const { stdout: hash } = await execFileAsync('git', ['rev-parse', 'HEAD']);
    const { stdout: date } = await execFileAsync('git', ['log', '-1', '--format=%ai']);
    const { stdout: message } = await execFileAsync('git', ['log', '-1', '--format=%s']);
    const { stdout: branch } = await execFileAsync('git', ['rev-parse', '--abbrev-ref', 'HEAD']);

    cachedDeploymentInfo = {
      version: process.env.npm_package_version || '1.0.0',
      commitHash: hash.trim().substring(0, 7),
      commitDate: date.trim(),
      commitMessage: message.trim(),
      branch: branch.trim(),
      environment: process.env.NODE_ENV || 'development',
      buildTime: BUILD_TIME,
    };

    return cachedDeploymentInfo;
  } catch (error) {
    // Git commands failed - use defaults
    console.log('[DEPLOYMENT-INFO] Git not available, using defaults');
    
    return {
      version: process.env.npm_package_version || '1.0.0',
      commitHash: 'unknown',
      commitDate: new Date().toISOString(),
      commitMessage: 'Deployment info unavailable',
      branch: 'unknown',
      environment: process.env.NODE_ENV || 'development',
      buildTime: BUILD_TIME,
    };
  }
}
