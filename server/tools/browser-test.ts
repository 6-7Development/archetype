import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';
import { nanoid } from 'nanoid';

interface BrowserTestParams {
  url: string;
  recordVideo?: boolean; // NEW: Enable video recording of the test session
  actions?: Array<{
    type: 'click' | 'type' | 'navigate' | 'screenshot' | 'evaluate';
    selector?: string;
    text?: string;
    code?: string;
  }>;
  assertions?: Array<{
    type: 'exists' | 'visible' | 'text' | 'count';
    selector: string;
    expected?: string | number;
  }>;
  sendEvent?: (type: string, data: any) => void; // SSE event emitter
}

interface BrowserTestResult {
  success: boolean;
  screenshots: string[];
  logs: string[];
  assertions: Array<{ passed: boolean; message: string }>;
  videoPath?: string; // NEW: Path to recorded video (for replay)
  error?: string;
}

/**
 * Execute browser tests using Playwright
 * Allows SySop to verify its generated code in a real browser
 */
export async function executeBrowserTest(params: BrowserTestParams): Promise<BrowserTestResult> {
  let browser: Browser | null = null;
  let page: Page | null = null;
  
  const result: BrowserTestResult = {
    success: true,
    screenshots: [],
    logs: [],
    assertions: [],
  };

  const sessionId = nanoid();
  const startTime = Date.now();
  const steps: Array<any> = [];

  // Helper to emit events
  const emitEvent = (type: string, data: any) => {
    if (params.sendEvent) {
      params.sendEvent(type, data);
    }
  };

  // Helper to add and emit step
  const addStep = (stepData: any) => {
    steps.push(stepData);
    emitEvent('test.step_update', {
      sessionId,
      step: stepData,
      timestamp: Date.now(),
    });
  };

  // Emit test started
  emitEvent('test.started', {
    sessionId,
    url: params.url,
    timestamp: startTime,
  });

  emitEvent('test.narration', {
    sessionId,
    text: "I'm starting by opening a fresh browser session to explore the website.",
    timestamp: Date.now(),
  });

  try {
    // Launch browser with timeout and safety settings
    browser = await chromium.launch({ 
      headless: true,
      timeout: 30000, // 30 second timeout for browser launch
    });
    
    // Setup video recording directory if enabled
    const videoDir = params.recordVideo ? path.join(process.cwd(), 'attached_assets', 'test_videos') : null;
    if (videoDir) {
      await fs.mkdir(videoDir, { recursive: true });
    }
    
    page = await browser.newPage({
      viewport: { width: 1280, height: 720 },
      recordVideo: params.recordVideo ? {
        dir: videoDir!,
        size: { width: 1280, height: 720 },
      } : undefined,
    });
    
    // Set default navigation timeout
    page.setDefaultNavigationTimeout(15000); // 15 seconds
    page.setDefaultTimeout(10000); // 10 seconds for actions
    
    // Capture console logs
    page.on('console', msg => {
      result.logs.push(`[${msg.type()}] ${msg.text()}`);
    });
    
    // Navigate to URL
    const navStepId = nanoid();
    addStep({
      id: navStepId,
      type: 'navigate',
      description: `Navigate to ${params.url}`,
      status: 'running',
      timestamp: Date.now(),
    });
    
    emitEvent('test.narration', {
      sessionId,
      text: `Heading straight to the app URL. I'll give it a few seconds to load up completely.`,
      timestamp: Date.now(),
    });
    
    result.logs.push(`Navigating to ${params.url}`);
    await page.goto(params.url, { waitUntil: 'networkidle' });
    
    // Take screenshot after navigation
    const navScreenshot = await page.screenshot({ fullPage: true });
    const navScreenshotBase64 = navScreenshot.toString('base64');
    
    // Update step with screenshot
    addStep({
      id: navStepId,
      type: 'navigate',
      description: `Navigate to ${params.url}`,
      status: 'passed',
      timestamp: Date.now(),
      screenshot: navScreenshotBase64,
    });
    
    emitEvent('test.screenshot', {
      sessionId,
      stepId: navStepId,
      screenshot: navScreenshotBase64,
      timestamp: Date.now(),
    });
    
    emitEvent('test.narration', {
      sessionId,
      text: "Perfect! The page loaded successfully. Let me verify the main elements are visible and working correctly.",
      timestamp: Date.now(),
    });
    
    // Execute actions
    if (params.actions) {
      for (let i = 0; i < params.actions.length; i++) {
        const action = params.actions[i];
        const actionStepId = nanoid();
        
        addStep({
          id: actionStepId,
          type: 'action',
          description: `${action.type} ${action.selector || action.text || ''}`.trim(),
          status: 'running',
          timestamp: Date.now(),
        });
        
        result.logs.push(`Executing action: ${action.type}`);
        
        try {
          switch (action.type) {
            case 'click':
              if (action.selector) {
                emitEvent('test.narration', {
                  sessionId,
                  text: `Clicking on "${action.selector}"...`,
                  timestamp: Date.now(),
                });
                await page.click(action.selector);
                await page.waitForTimeout(500);
              }
              break;
              
            case 'type':
              if (action.selector && action.text) {
                emitEvent('test.narration', {
                  sessionId,
                  text: `Typing "${action.text}" into ${action.selector}...`,
                  timestamp: Date.now(),
                });
                await page.fill(action.selector, action.text);
              }
              break;
              
            case 'navigate':
              if (action.text) {
                emitEvent('test.narration', {
                  sessionId,
                  text: `Navigating to ${action.text}...`,
                  timestamp: Date.now(),
                });
                await page.goto(action.text, { waitUntil: 'networkidle' });
              }
              break;
              
            case 'screenshot':
              const screenshot = await page.screenshot({ fullPage: true });
              const screenshotBase64 = screenshot.toString('base64');
              result.screenshots.push(screenshotBase64);
              emitEvent('test.screenshot', {
                sessionId,
                stepId: actionStepId,
                screenshot: screenshotBase64,
                timestamp: Date.now(),
              });
              break;
              
            case 'evaluate':
              if (action.code) {
                const evalResult = await page.evaluate(action.code);
                result.logs.push(`Evaluation result: ${JSON.stringify(evalResult)}`);
              }
              break;
          }
          
          addStep({
            id: actionStepId,
            type: 'action',
            description: `${action.type} ${action.selector || action.text || ''}`.trim(),
            status: 'passed',
            timestamp: Date.now(),
          });
        } catch (error) {
          addStep({
            id: actionStepId,
            type: 'action',
            description: `${action.type} ${action.selector || action.text || ''}`.trim(),
            status: 'failed',
            timestamp: Date.now(),
            error: error instanceof Error ? error.message : 'Unknown error',
          });
          throw error;
        }
      }
    }
    
    // Run assertions
    if (params.assertions) {
      emitEvent('test.narration', {
        sessionId,
        text: "Now verifying all the expected elements and functionality...",
        timestamp: Date.now(),
      });
      
      for (const assertion of params.assertions) {
        const assertStepId = nanoid();
        
        addStep({
          id: assertStepId,
          type: 'assertion',
          description: `Verify ${assertion.type}: ${assertion.selector}`,
          status: 'running',
          timestamp: Date.now(),
        });
        
        try {
          switch (assertion.type) {
            case 'exists':
              const exists = await page.$(assertion.selector) !== null;
              result.assertions.push({
                passed: exists,
                message: `Element "${assertion.selector}" ${exists ? 'exists' : 'does not exist'}`,
              });
              addStep({
                id: assertStepId,
                type: 'assertion',
                description: `Verify ${assertion.type}: ${assertion.selector}`,
                status: exists ? 'passed' : 'failed',
                timestamp: Date.now(),
                error: exists ? undefined : `Element not found`,
              });
              break;
              
            case 'visible':
              const visible = await page.isVisible(assertion.selector);
              result.assertions.push({
                passed: visible,
                message: `Element "${assertion.selector}" is ${visible ? 'visible' : 'not visible'}`,
              });
              addStep({
                id: assertStepId,
                type: 'assertion',
                description: `Verify ${assertion.type}: ${assertion.selector}`,
                status: visible ? 'passed' : 'failed',
                timestamp: Date.now(),
                error: visible ? undefined : `Element not visible`,
              });
              break;
              
            case 'text':
              const element = await page.$(assertion.selector);
              const text = element ? await element.textContent() : '';
              const matches = text?.includes(assertion.expected as string);
              result.assertions.push({
                passed: !!matches,
                message: `Element "${assertion.selector}" text ${matches ? 'matches' : 'does not match'} "${assertion.expected}"`,
              });
              addStep({
                id: assertStepId,
                type: 'assertion',
                description: `Verify ${assertion.type}: ${assertion.selector}`,
                status: matches ? 'passed' : 'failed',
                timestamp: Date.now(),
                error: matches ? undefined : `Text mismatch`,
              });
              break;
              
            case 'count':
              const count = await page.$$(assertion.selector).then(els => els.length);
              const countMatches = count === assertion.expected;
              result.assertions.push({
                passed: countMatches,
                message: `Found ${count} elements matching "${assertion.selector}" (expected ${assertion.expected})`,
              });
              addStep({
                id: assertStepId,
                type: 'assertion',
                description: `Verify ${assertion.type}: ${assertion.selector}`,
                status: countMatches ? 'passed' : 'failed',
                timestamp: Date.now(),
                error: countMatches ? undefined : `Expected ${assertion.expected}, found ${count}`,
              });
              break;
          }
        } catch (error) {
          result.assertions.push({
            passed: false,
            message: `Assertion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
          addStep({
            id: assertStepId,
            type: 'assertion',
            description: `Verify ${assertion.type}: ${assertion.selector}`,
            status: 'failed',
            timestamp: Date.now(),
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }
    }
    
    // Take final screenshot
    const finalScreenshot = await page.screenshot({ fullPage: true });
    result.screenshots.push(finalScreenshot.toString('base64'));
    
    // Check if all assertions passed
    result.success = result.assertions.every(a => a.passed);
    
    // Emit completion event
    const passedSteps = steps.filter(s => s.status === 'passed').length;
    const failedSteps = steps.filter(s => s.status === 'failed').length;
    
    emitEvent('test.completed', {
      sessionId,
      passedSteps,
      failedSteps,
      totalSteps: steps.length,
      duration: Date.now() - startTime,
      timestamp: Date.now(),
    });
    
    emitEvent('test.narration', {
      sessionId,
      text: `All done! Test completed with ${passedSteps} passed and ${failedSteps} failed steps.`,
      timestamp: Date.now(),
    });
    
  } catch (error) {
    result.success = false;
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.logs.push(`Error: ${result.error}`);
    
    // Emit failure event
    emitEvent('test.failed', {
      sessionId,
      error: result.error,
      timestamp: Date.now(),
    });
  } finally {
    // Close page first to finalize video recording
    if (page) {
      const videoPath = await page.video()?.path();
      await page.close();
      
      // Copy video to accessible location and provide path
      if (videoPath && params.recordVideo) {
        try {
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const finalVideoPath = path.join('attached_assets', 'test_videos', `test_${timestamp}.webm`);
          await fs.rename(videoPath, finalVideoPath);
          result.videoPath = finalVideoPath;
          result.logs.push(`📹 Video replay saved: ${finalVideoPath}`);
        } catch (videoError) {
          result.logs.push(`⚠️ Could not save video: ${videoError instanceof Error ? videoError.message : 'Unknown error'}`);
        }
      }
    }
    if (browser) await browser.close();
  }
  
  return result;
}
