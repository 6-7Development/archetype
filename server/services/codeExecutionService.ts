/**
 * Code Execution Service - DEVELOPMENT/DEMO USE ONLY
 * 
 * SECURITY WARNING: This service provides basic sandboxing but is NOT suitable
 * for untrusted code execution in production. It uses:
 * - Regex pattern matching to block dangerous code patterns
 * - Timeout enforcement to prevent infinite loops
 * - Memory limits via Node.js flags
 * - Isolated temp directories per execution
 * - Sanitized environment variables
 * 
 * LIMITATIONS (requires containerization for production):
 * - No filesystem isolation (chroot/namespace)
 * - No network isolation
 * - No CPU cgroup limits
 * - No seccomp/AppArmor profiles
 * 
 * For production with untrusted code, use:
 * - Docker containers with restricted capabilities
 * - Firecracker microVMs
 * - WebAssembly (WASM) runtimes
 * - Nsjail or similar sandboxing tools
 */

import { spawn, ChildProcess } from 'child_process';
import { EventEmitter } from 'events';
import path from 'path';
import fs from 'fs/promises';
import { randomBytes } from 'crypto';

function nanoid(size = 12): string {
  return randomBytes(size).toString('base64url').slice(0, size);
}

export interface ExecutionOptions {
  language: 'javascript' | 'typescript' | 'python' | 'bash' | 'shell';
  code: string;
  timeoutMs?: number;
  memoryLimitMb?: number;
  userId?: string;
  projectId?: string;
  stdin?: string;
  env?: Record<string, string>;
}

export interface ExecutionResult {
  id: string;
  success: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  duration: number;
  killed: boolean;
  killedReason?: 'timeout' | 'memory' | 'manual';
  error?: string;
  securityViolations?: string[];
}

interface ActiveExecution {
  id: string;
  process: ChildProcess;
  startTime: number;
  timeout: NodeJS.Timeout;
  userId?: string;
}

const LANGUAGE_CONFIGS: Record<string, { command: string; args: string[]; extension: string }> = {
  javascript: { command: 'node', args: ['--experimental-permission', '--allow-read=/tmp/hexad-sandbox', '--allow-write=/tmp/hexad-sandbox'], extension: 'js' },
  typescript: { command: 'npx', args: ['tsx'], extension: 'ts' },
  python: { command: 'python3', args: ['-u'], extension: 'py' },
};

const FORBIDDEN_PATTERNS_JS = [
  /child_process/i,
  /require\s*\(\s*['"`]child_process['"`]\s*\)/i,
  /spawn\s*\(/i,
  /exec\s*\(/i,
  /execSync\s*\(/i,
  /execFile\s*\(/i,
  /fork\s*\(/i,
  /__dirname/,
  /__filename/,
  /process\.env/,
  /process\.exit/,
  /process\.kill/,
  /fs\.rmdir/i,
  /fs\.unlink/i,
  /fs\.rm\(/i,
  /fs\.writeFile/i,
  /fs\.readFile/i,
  /require\s*\(\s*['"`]fs['"`]\s*\)/,
  /require\s*\(\s*['"`]path['"`]\s*\)/,
  /require\s*\(\s*['"`]os['"`]\s*\)/,
  /require\s*\(\s*['"`]net['"`]\s*\)/,
  /require\s*\(\s*['"`]http['"`]\s*\)/,
  /require\s*\(\s*['"`]https['"`]\s*\)/,
  /import\s+.*\s+from\s+['"`]fs['"`]/,
  /import\s+.*\s+from\s+['"`]child_process['"`]/,
  /import\s+.*\s+from\s+['"`]os['"`]/,
  /import\s+.*\s+from\s+['"`]net['"`]/,
  /import\s+.*\s+from\s+['"`]http['"`]/,
  /eval\s*\(/,
  /Function\s*\(/,
  /new\s+Function/,
  /globalThis/,
  /global\./,
];

const FORBIDDEN_PATTERNS_PYTHON = [
  /os\.system/,
  /os\.popen/,
  /os\.exec/,
  /os\.spawn/,
  /os\.fork/,
  /os\.remove/,
  /os\.unlink/,
  /os\.rmdir/,
  /subprocess\.run/,
  /subprocess\.Popen/,
  /subprocess\.call/,
  /import\s+os/,
  /import\s+subprocess/,
  /import\s+socket/,
  /import\s+requests/,
  /import\s+urllib/,
  /import\s+shutil/,
  /from\s+os\s+import/,
  /from\s+subprocess\s+import/,
  /from\s+socket\s+import/,
  /open\s*\(\s*['"`]\/etc/,
  /open\s*\(\s*['"`]\/home/,
  /open\s*\(\s*['"`]\/root/,
  /open\s*\(\s*['"`]\/var/,
  /open\s*\(\s*['"`]\/tmp\/(?!hexad)/,
  /__import__/,
  /eval\s*\(/,
  /exec\s*\(/,
  /compile\s*\(/,
];

const DEFAULT_TIMEOUT_MS = 10000;
const DEFAULT_MEMORY_LIMIT_MB = 128;
const MAX_OUTPUT_SIZE = 50000;
const MAX_CODE_SIZE = 50000;
const TEMP_DIR = '/tmp/hexad-sandbox';

class CodeExecutionService extends EventEmitter {
  private activeExecutions: Map<string, ActiveExecution> = new Map();
  private executionHistory: ExecutionResult[] = [];
  private maxHistorySize = 100;

  constructor() {
    super();
    this.ensureTempDir();
  }

  private async ensureTempDir(): Promise<void> {
    try {
      await fs.mkdir(TEMP_DIR, { recursive: true });
    } catch (error) {
      console.error('[CodeExecution] Failed to create temp directory:', error);
    }
  }

  private validateCode(code: string, language: string): { valid: boolean; violations: string[] } {
    const violations: string[] = [];
    
    if (code.length > MAX_CODE_SIZE) {
      violations.push(`Code exceeds maximum size of ${MAX_CODE_SIZE} characters`);
    }
    
    const patterns = language === 'python' 
      ? FORBIDDEN_PATTERNS_PYTHON 
      : FORBIDDEN_PATTERNS_JS;
    
    for (const pattern of patterns) {
      if (pattern.test(code)) {
        violations.push(`Forbidden pattern detected: ${pattern.source.slice(0, 50)}`);
      }
    }
    
    return {
      valid: violations.length === 0,
      violations,
    };
  }

  async execute(options: ExecutionOptions): Promise<ExecutionResult> {
    const executionId = nanoid(12);
    const startTime = Date.now();
    const {
      language,
      code,
      timeoutMs = DEFAULT_TIMEOUT_MS,
      memoryLimitMb = DEFAULT_MEMORY_LIMIT_MB,
      userId,
      projectId,
      stdin,
      env = {},
    } = options;

    const codeValidation = this.validateCode(code, language);
    if (!codeValidation.valid) {
      console.warn(`[CodeExecution] Security violations detected for user ${userId}:`, codeValidation.violations);
      return {
        id: executionId,
        success: false,
        stdout: '',
        stderr: 'Security: Code contains forbidden patterns that could compromise system security. Only basic computational code is allowed.',
        exitCode: 1,
        duration: 0,
        killed: false,
        error: 'Security validation failed',
        securityViolations: codeValidation.violations,
      };
    }

    const config = LANGUAGE_CONFIGS[language];
    if (!config) {
      return {
        id: executionId,
        success: false,
        stdout: '',
        stderr: `Unsupported language: ${language}. Supported: javascript, typescript, python`,
        exitCode: 1,
        duration: 0,
        killed: false,
        error: `Unsupported language: ${language}`,
      };
    }

    const userTempDir = path.join(TEMP_DIR, userId || 'anonymous', executionId);
    await fs.mkdir(userTempDir, { recursive: true });
    const tempFilePath = path.join(userTempDir, `code.${config.extension}`);

    try {
      const wrappedCode = this.wrapCode(code, language);
      await fs.writeFile(tempFilePath, wrappedCode, 'utf-8');

      const result = await this.runProcess({
        executionId,
        command: config.command,
        args: [...config.args, tempFilePath],
        timeoutMs,
        memoryLimitMb,
        userId,
        stdin,
        env: {
          ...process.env,
          ...env,
          NODE_OPTIONS: `--max-old-space-size=${memoryLimitMb}`,
          PYTHONDONTWRITEBYTECODE: '1',
        },
      });

      return result;
    } catch (error: any) {
      return {
        id: executionId,
        success: false,
        stdout: '',
        stderr: error.message,
        exitCode: 1,
        duration: Date.now() - startTime,
        killed: false,
        error: error.message,
      };
    } finally {
      try {
        await fs.rm(userTempDir, { recursive: true, force: true });
      } catch {}
      this.activeExecutions.delete(executionId);
    }
  }

  private wrapCode(code: string, language: string): string {
    switch (language) {
      case 'javascript':
      case 'typescript':
        return `
'use strict';

const originalConsoleLog = console.log;
const originalConsoleError = console.error;
const originalConsoleWarn = console.warn;

let outputBuffer = [];

console.log = (...args) => {
  outputBuffer.push(args.map(a => typeof a === 'object' ? JSON.stringify(a, null, 2) : String(a)).join(' '));
  originalConsoleLog.apply(console, args);
};

console.error = (...args) => {
  originalConsoleError.apply(console, args);
};

console.warn = (...args) => {
  originalConsoleWarn.apply(console, args);
};

try {
${code}
} catch (error) {
  console.error('Error:', error.message);
  process.exit(1);
}
`;

      case 'python':
        return `
import sys
import json

try:
${code.split('\n').map(line => '    ' + line).join('\n')}
except Exception as e:
    print(f"Error: {e}", file=sys.stderr)
    sys.exit(1)
`;

      default:
        return code;
    }
  }

  private runProcess(options: {
    executionId: string;
    command: string;
    args: string[];
    timeoutMs: number;
    memoryLimitMb: number;
    userId?: string;
    stdin?: string;
    env?: NodeJS.ProcessEnv;
  }): Promise<ExecutionResult> {
    return new Promise((resolve) => {
      const { executionId, command, args, timeoutMs, userId, stdin, env } = options;
      const startTime = Date.now();

      let stdout = '';
      let stderr = '';
      let killed = false;
      let killedReason: 'timeout' | 'memory' | 'manual' | undefined;

      const sanitizedEnv: NodeJS.ProcessEnv = {
        PATH: '/usr/bin:/bin',
        HOME: TEMP_DIR,
        TMPDIR: TEMP_DIR,
        LANG: 'en_US.UTF-8',
        NODE_OPTIONS: `--max-old-space-size=${options.memoryLimitMb}`,
        PYTHONDONTWRITEBYTECODE: '1',
        PYTHONUNBUFFERED: '1',
      };

      const proc = spawn(command, args, {
        env: sanitizedEnv,
        cwd: TEMP_DIR,
        timeout: timeoutMs,
        stdio: ['pipe', 'pipe', 'pipe'],
        uid: process.getuid?.() ?? undefined,
        gid: process.getgid?.() ?? undefined,
      });

      const timeout = setTimeout(() => {
        killed = true;
        killedReason = 'timeout';
        proc.kill('SIGKILL');
      }, timeoutMs);

      this.activeExecutions.set(executionId, {
        id: executionId,
        process: proc,
        startTime,
        timeout,
        userId,
      });

      if (stdin) {
        proc.stdin.write(stdin);
        proc.stdin.end();
      }

      proc.stdout.on('data', (data) => {
        if (stdout.length < MAX_OUTPUT_SIZE) {
          stdout += data.toString();
          if (stdout.length > MAX_OUTPUT_SIZE) {
            stdout = stdout.substring(0, MAX_OUTPUT_SIZE) + '\n... (output truncated)';
          }
        }
      });

      proc.stderr.on('data', (data) => {
        if (stderr.length < MAX_OUTPUT_SIZE) {
          stderr += data.toString();
          if (stderr.length > MAX_OUTPUT_SIZE) {
            stderr = stderr.substring(0, MAX_OUTPUT_SIZE) + '\n... (output truncated)';
          }
        }
      });

      proc.on('close', (exitCode) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        
        const result: ExecutionResult = {
          id: executionId,
          success: exitCode === 0 && !killed,
          stdout: stdout.trim(),
          stderr: stderr.trim(),
          exitCode,
          duration,
          killed,
          killedReason,
        };

        this.addToHistory(result);
        this.emit('execution-complete', result);
        
        resolve(result);
      });

      proc.on('error', (error) => {
        clearTimeout(timeout);
        const duration = Date.now() - startTime;
        
        const result: ExecutionResult = {
          id: executionId,
          success: false,
          stdout: stdout.trim(),
          stderr: error.message,
          exitCode: 1,
          duration,
          killed: false,
          error: error.message,
        };

        this.addToHistory(result);
        this.emit('execution-error', result);
        
        resolve(result);
      });

      this.emit('execution-start', { id: executionId, userId, command: args.join(' ') });
    });
  }

  async kill(executionId: string): Promise<boolean> {
    const execution = this.activeExecutions.get(executionId);
    if (!execution) {
      return false;
    }

    clearTimeout(execution.timeout);
    execution.process.kill('SIGKILL');
    return true;
  }

  async killAll(userId?: string): Promise<number> {
    let killed = 0;
    for (const [id, execution] of this.activeExecutions) {
      if (!userId || execution.userId === userId) {
        await this.kill(id);
        killed++;
      }
    }
    return killed;
  }

  getActiveExecutions(userId?: string): string[] {
    const executions: string[] = [];
    for (const [id, execution] of this.activeExecutions) {
      if (!userId || execution.userId === userId) {
        executions.push(id);
      }
    }
    return executions;
  }

  getHistory(limit = 20): ExecutionResult[] {
    return this.executionHistory.slice(-limit);
  }

  private addToHistory(result: ExecutionResult): void {
    this.executionHistory.push(result);
    if (this.executionHistory.length > this.maxHistorySize) {
      this.executionHistory.shift();
    }
  }

  getSupportedLanguages(): string[] {
    return Object.keys(LANGUAGE_CONFIGS);
  }
}

export const codeExecutionService = new CodeExecutionService();
