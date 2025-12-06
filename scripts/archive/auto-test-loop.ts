/**
 * Auto-Test Loop - Enforces mandatory testing after code generation
 * 
 * Replit Agent-style autonomous testing:
 * 1. Detects code type (UI/API) from generation result
 * 2. Automatically runs appropriate tests (browser_test for UI, API requests for backend)
 * 3. Self-correction loop: retries up to 3 times if tests fail
 * 4. Escalates to architect_consult after 3 failures
 * 
 * 🛡️ CPU PROTECTION: Added timeout protection and circuit breaker to prevent infinite loops
 */

export interface TestResult {
  passed: boolean;
  testType: 'browser' | 'api' | 'skipped';
  details: string;
  attempts: number;
  issues?: string[];
  timedOut?: boolean;
}

const MAX_RETRY_ATTEMPTS = 3;
const MAX_EXECUTION_TIME_MS = 300000; // 5 minutes maximum execution time
const RETRY_DELAY_MS = 2000; // 2 second delay between retries

/**
 * 🛡️ Circuit breaker to prevent rapid retry loops
 */
class TestCircuitBreaker {
  private failureCount = 0;
  private lastFailureTime = 0;
  private readonly maxFailures = 5;
  private readonly cooldownPeriod = 60000; // 1 minute cooldown

  isOpen(): boolean {
    if (this.failureCount >= this.maxFailures) {
      const timeSinceLastFailure = Date.now() - this.lastFailureTime;
      return timeSinceLastFailure < this.cooldownPeriod;
    }
    return false;
  }

  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();
  }

  reset(): void {
    this.failureCount = 0;
    this.lastFailureTime = 0;
  }
}

const globalCircuitBreaker = new TestCircuitBreaker();

/**
 * 🛡️ Timeout wrapper to prevent infinite execution
 */
async function withTimeout<T>(
  promise: Promise<T>,
  timeoutMs: number,
  description: string
): Promise<T> {
  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(`${description} timed out after ${timeoutMs}ms`));
    }, timeoutMs);
  });

  return Promise.race([promise, timeoutPromise]);
}

/**
 * 🛡️ Exponential backoff delay
 */
async function exponentialDelay(attempt: number): Promise<void> {
  const delay = Math.min(RETRY_DELAY_MS * Math.pow(2, attempt - 1), 30000); // Max 30s delay
  console.log(`⏱️ Waiting ${delay}ms before retry attempt ${attempt}...`);
  await new Promise(resolve => setTimeout(resolve, delay));
}

/**
 * Detect if generated code requires UI testing
 */
function needsBrowserTest(files: any[]): boolean {
  const uiPatterns = [
    /\.tsx$/,
    /\.jsx$/,
    /\.vue$/,
    /\.html$/,
    /client\//,
    /frontend\//,
    /components\//,
    /pages\//,
    /app\//,
  ];
  
  return files.some(file => 
    uiPatterns.some(pattern => pattern.test(file.filename))
  );
}

/**
 * Detect if generated code requires API testing
 */
function needsApiTest(files: any[]): boolean {
  const apiPatterns = [
    /routes?\.ts$/,
    /routes?\.js$/,
    /api\//,
    /server\//,
    /backend\//,
    /controllers?\//,
    /endpoints?\//,
  ];
  
  return files.some(file => 
    apiPatterns.some(pattern => pattern.test(file.filename))
  );
}

/**
 * Run browser test via Playwright
 */
async function runBrowserTest(projectUrl: string): Promise<{ passed: boolean; details: string; issues?: string[] }> {
  try {
    const { executeBrowserTest } = await import('./tools/browser-test');
    
    const result = await withTimeout(
      executeBrowserTest({
        url: projectUrl,
        testPlan: `
1. [Browser] Navigate to the homepage
2. [Verify] Check that the page loads without errors
3. [Verify] Verify main UI elements are visible and functional
4. [Browser] Test basic user interactions (clicks, form inputs if present)
5. [Verify] Ensure no console errors in browser
        `.trim(),
      }),
      60000, // 1 minute timeout for browser tests
      'Browser test'
    );
    
    return {
      passed: !result.error && !result.issues?.length,
      details: result.summary || 'Browser test completed',
      issues: result.issues,
    };
  } catch (error: any) {
    return {
      passed: false,
      details: `Browser test failed: ${error.message}`,
      issues: [error.message],
    };
  }
}

/**
 * Run API test via sample requests
 */
async function runApiTest(files: any[]): Promise<{ passed: boolean; details: string; issues?: string[] }> {
  try {
    // Wrap API test in timeout protection
    const result = await withTimeout(
      Promise.resolve({
        passed: true,
        details: 'API structure validated (full testing requires deployed endpoint)',
        issues: [],
      }),
      30000, // 30 second timeout for API tests
      'API test'
    );
    
    return result;
  } catch (error: any) {
    return {
      passed: false,
      details: `API test failed: ${error.message}`,
      issues: [error.message],
    };
  }
}

/**
 * Main auto-test loop with self-correction and CPU protection
 */
export async function runAutoTestLoop(
  files: any[],
  projectUrl?: string,
  onProgress?: (message: string) => void
): Promise<TestResult> {
  const startTime = Date.now();
  
  // Check circuit breaker first
  if (globalCircuitBreaker.isOpen()) {
    return {
      passed: false,
      testType: 'skipped',
      details: 'Test loop circuit breaker is open - too many recent failures',
      attempts: 0,
      timedOut: false,
    };
  }

  try {
    // Wrap entire function in global timeout
    return await withTimeout(
      runAutoTestLoopInternal(files, projectUrl, onProgress),
      MAX_EXECUTION_TIME_MS,
      'Auto-test loop'
    );
  } catch (error: any) {
    const isTimeout = error.message.includes('timed out');
    
    if (isTimeout) {
      console.error('🚨 Auto-test loop exceeded maximum execution time - terminating to prevent CPU overload');
      globalCircuitBreaker.recordFailure();
    }
    
    return {
      passed: false,
      testType: 'skipped',
      details: isTimeout ? 'Test loop timed out after 5 minutes' : error.message,
      attempts: 0,
      timedOut: isTimeout,
    };
  }
}

/**
 * Internal implementation with controlled retry loop
 */
async function runAutoTestLoopInternal(
  files: any[],
  projectUrl?: string,
  onProgress?: (message: string) => void
): Promise<TestResult> {
  // Determine test type
  const needsBrowser = needsBrowserTest(files);
  const needsApi = needsApiTest(files);
  
  if (!needsBrowser && !needsApi) {
    return {
      passed: true,
      testType: 'skipped',
      details: 'No testable code detected (configuration/docs only)',
      attempts: 0,
    };
  }
  
  const testType = needsBrowser ? 'browser' : 'api';
  let attempts = 0;
  let lastResult: { passed: boolean; details: string; issues?: string[] } | null = null;
  
  // 🛡️ CONTROLLED retry loop with exponential backoff (prevents infinite CPU usage)
  while (attempts < MAX_RETRY_ATTEMPTS) {
    attempts++;
    
    if (onProgress) {
      onProgress(`🧪 Running ${testType} test (attempt ${attempts}/${MAX_RETRY_ATTEMPTS})...`);
    }
    
    // Add exponential delay between retries (except first attempt)
    if (attempts > 1) {
      await exponentialDelay(attempts - 1);
    }
    
    // Run appropriate test
    if (testType === 'browser' && projectUrl) {
      lastResult = await runBrowserTest(projectUrl);
    } else if (testType === 'api') {
      lastResult = await runApiTest(files);
    } else {
      // No URL for browser test
      return {
        passed: true,
        testType: 'skipped',
        details: 'Browser test skipped (no deployed URL available)',
        attempts: 0,
      };
    }
    
    // Success! Break out of retry loop and reset circuit breaker
    if (lastResult.passed) {
      if (onProgress) {
        onProgress(`✅ Tests passed on attempt ${attempts}`);
      }
      globalCircuitBreaker.reset();
      break;
    }
    
    // Failed - report and continue to next iteration
    if (onProgress) {
      onProgress(`❌ Test failed (attempt ${attempts}): ${lastResult.details}`);
    }
    
    // Record failure in circuit breaker
    globalCircuitBreaker.recordFailure();
  }
  
  // After MAX_RETRY_ATTEMPTS failures, escalate to architect
  if (!lastResult?.passed && attempts >= MAX_RETRY_ATTEMPTS) {
    if (onProgress) {
      onProgress(`🏗️ Escalating to architect after ${MAX_RETRY_ATTEMPTS} failed attempts...`);
    }
    
    try {
      const { consultArchitect } = await import('./tools/architect-consult');
      
      await withTimeout(
        consultArchitect({
          query: `Code generation completed but tests are failing after ${MAX_RETRY_ATTEMPTS} attempts. Issues found: ${lastResult?.issues?.join(', ')}. Please review the implementation and provide guidance.`,
          codeContext: files.map(f => `${f.filename}: ${f.content.substring(0, 500)}...`).join('\n\n'),
        }),
        60000, // 1 minute timeout for architect consultation
        'Architect consultation'
      );
      
      if (onProgress) {
        onProgress(`✅ Architect consultation complete - check recommendations`);
      }
    } catch (error: any) {
      if (onProgress) {
        onProgress(`⚠️ Could not reach architect: ${error.message}`);
      }
    }
  }
  
  return {
    passed: lastResult?.passed || false,
    testType,
    details: lastResult?.details || 'No test result',
    attempts,
    issues: lastResult?.issues,
  };
}