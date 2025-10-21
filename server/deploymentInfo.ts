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
    console.warn('Failed to get git info, using defaults:', error);
    
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
