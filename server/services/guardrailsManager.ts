/**
 * GUARD RAILS MANAGER - Production Security for AI-Generated Code
 * Prevents RCE, injection attacks, cost explosion, and unsafe deployments
 */

import * as vm from 'vm';
import { createHash } from 'crypto';

// ==================== INTERFACES ====================

export interface GuardRailConfig {
  enableRCEPrevention: boolean;
  enableInputSanitization: boolean;
  enableRateLimiting: boolean;
  enableSandboxMode: boolean;
  maxParallelTools: number;
  maxConcurrentCalls: number;
  costLimitPerRequest: number; // in cents
  blockedCommands: string[];
  trustedDomains: string[];
}

export interface SanitizationResult {
  isSafe: boolean;
  risks: string[];
  sanitized: string;
}

export interface RateLimitStatus {
  allowed: boolean;
  remaining: number;
  resetAt: number;
}

// ==================== DANGEROUS PATTERNS ====================

const DANGEROUS_SHELL_PATTERNS = [
  /rm\s+-rf\s+\/|rm\s+-rf\s+\//,  // Destructive deletes
  />\s*\/dev\/sda|>\s*\/dev\/hda/,  // Raw disk writes
  /chmod\s+777|chmod\s+000/,  // Dangerous permissions
  /\.\/|exec\s+bash|eval\s+bash/,  // Arbitrary execution
  /\|\s*nc\s+-|tee\s+\/dev\/tcp/,  // Network reverse shells
  /curl\s+.*\|\s*bash|wget\s+.*\|\s*bash/,  // Remote code execution
  /dd\s+if=.*of=|mkfs\.|fdisk\s+-l/,  // Disk operations
];

const LLM_INJECTION_PATTERNS = [
  /<!--.*?-->/,  // HTML comments that could be exploited
  /SYSTEM:|system:/i,  // System prompt injection
  /ignore.*instruction|forget.*instruction/i,  // Jailbreak attempts
  /eval\(|Function\(|new Function/,  // JS eval patterns
];

const DATABASE_INJECTION_PATTERNS = [
  /DROP\s+TABLE|DELETE\s+FROM|TRUNCATE/i,
  /ALTER\s+TABLE|ALTER\s+DATABASE/i,
  /\bOR\b.*=.*|UNION\s+SELECT|1\s*=\s*1/i,
];

// ==================== GUARD RAILS MANAGER ====================

export class GuardRailsManager {
  private config: GuardRailConfig;
  private rateLimitMap: Map<string, { count: number; resetAt: number }> = new Map();
  private costTracker: Map<string, number> = new Map();

  constructor(config: Partial<GuardRailConfig> = {}) {
    this.config = {
      enableRCEPrevention: true,
      enableInputSanitization: true,
      enableRateLimiting: true,
      enableSandboxMode: true,
      maxParallelTools: 4,
      maxConcurrentCalls: 20,
      costLimitPerRequest: 500, // $5 per request
      blockedCommands: ['rm -rf', 'dd', 'fdisk', 'mkfs'],
      trustedDomains: ['github.com', 'api.github.com', 'getdc360.com'],
      ...config,
    };
  }

  /**
   * LAYER 1: INPUT SANITIZATION
   * Prevents injection attacks from reaching AI models
   */
  sanitizeInput(input: string, context: 'shell' | 'code' | 'sql' | 'llm' = 'llm'): SanitizationResult {
    if (!this.config.enableInputSanitization) {
      return { isSafe: true, risks: [], sanitized: input };
    }

    const risks: string[] = [];
    let sanitized = input;

    // Check for injection patterns
    const patterns =
      context === 'shell'
        ? DANGEROUS_SHELL_PATTERNS
        : context === 'llm'
          ? LLM_INJECTION_PATTERNS
          : context === 'sql'
            ? DATABASE_INJECTION_PATTERNS
            : [];

    for (const pattern of patterns) {
      if (pattern.test(input)) {
        risks.push(`Detected suspicious pattern for ${context} context: ${pattern.source}`);
        sanitized = sanitized.replace(pattern, '[SANITIZED]');
      }
    }

    // Remove null bytes
    if (input.includes('\0')) {
      risks.push('Null byte injection attempt detected');
      sanitized = sanitized.replace(/\0/g, '');
    }

    // Limit input size (prevent buffer overflows)
    if (input.length > 100000) {
      risks.push(`Input exceeds safe size (${input.length} > 100000 bytes)`);
      sanitized = sanitized.substring(0, 100000);
    }

    return {
      isSafe: risks.length === 0,
      risks,
      sanitized,
    };
  }

  /**
   * LAYER 2: RCE PREVENTION
   * Validates code before execution
   */
  validateCodeSafety(code: string, maxComplexity: number = 50): { safe: boolean; issues: string[] } {
    const issues: string[] = [];

    // Check for dangerous patterns
    const dangerousPatterns = [
      { pattern: /require\(['"]child_process['"]\)|exec\(|spawn\(/, name: 'child_process usage' },
      { pattern: /fs\.rm|fs\.unlink|fs\.truncate/, name: 'dangerous file operations' },
      { pattern: /eval\(|Function\(/, name: 'code execution functions' },
      { pattern: /process\.exit|process\.kill/, name: 'process termination' },
      { pattern: /\$\{.*\}.*\$\{/, name: 'template injection' },
    ];

    for (const { pattern, name } of dangerousPatterns) {
      if (pattern.test(code)) {
        issues.push(`Detected: ${name}`);
      }
    }

    // Complexity check (cyclomatic complexity estimation)
    const complexity = this.estimateComplexity(code);
    if (complexity > maxComplexity) {
      issues.push(`Code complexity (${complexity}) exceeds safe limit (${maxComplexity})`);
    }

    return {
      safe: issues.length === 0,
      issues,
    };
  }

  /**
   * LAYER 3: SANDBOX EXECUTION
   * Execute code in isolated VM context with restricted APIs
   */
  async executeSandboxed(code: string, timeout: number = 5000): Promise<{ success: boolean; result?: any; error?: string }> {
    if (!this.config.enableSandboxMode) {
      return { success: false, error: 'Sandbox mode disabled' };
    }

    try {
      // Validate before execution
      const validation = this.validateCodeSafety(code);
      if (!validation.safe) {
        return { success: false, error: `Code validation failed: ${validation.issues.join('; ')}` };
      }

      // Create restricted context
      const context = vm.createContext({
        // Allow safe globals
        console: {
          log: (...args: any[]) => console.log('[SANDBOX]', ...args),
        },
        // Explicitly exclude dangerous APIs
        require: undefined,
        eval: undefined,
        Function: undefined,
        process: undefined,
        global: undefined,
      });

      // Execute in VM
      const result = vm.runInContext(`(${code})()`, context, {
        timeout,
        displayErrors: true,
      });

      return { success: true, result };
    } catch (error: any) {
      return {
        success: false,
        error: error.message || 'Sandbox execution failed',
      };
    }
  }

  /**
   * LAYER 4: RATE LIMITING
   * Prevent cost explosion from parallel tool execution
   */
  checkRateLimit(userId: string, limit: number = this.config.maxConcurrentCalls): RateLimitStatus {
    if (!this.config.enableRateLimiting) {
      return { allowed: true, remaining: limit, resetAt: 0 };
    }

    const now = Date.now();
    let entry = this.rateLimitMap.get(userId);

    // Reset if window expired (1 hour)
    if (!entry || now > entry.resetAt) {
      entry = {
        count: 0,
        resetAt: now + 3600000,
      };
      this.rateLimitMap.set(userId, entry);
    }

    const allowed = entry.count < limit;
    if (allowed) {
      entry.count++;
    }

    return {
      allowed,
      remaining: Math.max(0, limit - entry.count),
      resetAt: entry.resetAt,
    };
  }

  /**
   * LAYER 5: COST TRACKING
   * Monitor API spending per request
   */
  trackCost(userId: string, requestId: string, cost: number): { withinBudget: boolean; remaining: number } {
    if (!this.config.enableRateLimiting) {
      return { withinBudget: true, remaining: this.config.costLimitPerRequest };
    }

    const key = `${userId}:${requestId}`;
    const currentCost = this.costTracker.get(key) || 0;
    const newCost = currentCost + cost;

    if (newCost <= this.config.costLimitPerRequest) {
      this.costTracker.set(key, newCost);
      return {
        withinBudget: true,
        remaining: this.config.costLimitPerRequest - newCost,
      };
    }

    return {
      withinBudget: false,
      remaining: 0,
    };
  }

  /**
   * UTILITY: Estimate code complexity
   */
  private estimateComplexity(code: string): number {
    let complexity = 1;

    // Count control flow statements
    complexity += (code.match(/if\s*\(/gi) || []).length * 1;
    complexity += (code.match(/for\s*\(/gi) || []).length * 2;
    complexity += (code.match(/while\s*\(/gi) || []).length * 2;
    complexity += (code.match(/switch\s*\(/gi) || []).length * 2;
    complexity += (code.match(/catch\s*\(/gi) || []).length * 1;

    return complexity;
  }

  /**
   * UTILITY: Generate content hash for validation
   */
  hashContent(content: string): string {
    return createHash('sha256').update(content).digest('hex');
  }
}

// Export singleton instance
export const guardrails = new GuardRailsManager({
  enableRCEPrevention: true,
  enableInputSanitization: true,
  enableRateLimiting: true,
  enableSandboxMode: true,
  maxParallelTools: 4,
  maxConcurrentCalls: 20,
  costLimitPerRequest: 500, // $5
});
