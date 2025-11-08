import { chromium, Browser, Page } from 'playwright';
import * as fs from 'fs/promises';
import * as path from 'path';

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
    result.logs.push(`Navigating to ${params.url}`);
    await page.goto(params.url, { waitUntil: 'networkidle' });
    
    // Execute actions
    if (params.actions) {
      for (const action of params.actions) {
        result.logs.push(`Executing action: ${action.type}`);
        
        switch (action.type) {
          case 'click':
            if (action.selector) {
              await page.click(action.selector);
              await page.waitForTimeout(500);
            }
            break;
            
          case 'type':
            if (action.selector && action.text) {
              await page.fill(action.selector, action.text);
            }
            break;
            
          case 'navigate':
            if (action.text) {
              await page.goto(action.text, { waitUntil: 'networkidle' });
            }
            break;
            
          case 'screenshot':
            const screenshot = await page.screenshot({ fullPage: true });
            result.screenshots.push(screenshot.toString('base64'));
            break;
            
          case 'evaluate':
            if (action.code) {
              const evalResult = await page.evaluate(action.code);
              result.logs.push(`Evaluation result: ${JSON.stringify(evalResult)}`);
            }
            break;
        }
      }
    }
    
    // Run assertions
    if (params.assertions) {
      for (const assertion of params.assertions) {
        try {
          switch (assertion.type) {
            case 'exists':
              const exists = await page.$(assertion.selector) !== null;
              result.assertions.push({
                passed: exists,
                message: `Element "${assertion.selector}" ${exists ? 'exists' : 'does not exist'}`,
              });
              break;
              
            case 'visible':
              const visible = await page.isVisible(assertion.selector);
              result.assertions.push({
                passed: visible,
                message: `Element "${assertion.selector}" is ${visible ? 'visible' : 'not visible'}`,
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
              break;
              
            case 'count':
              const count = await page.$$(assertion.selector).then(els => els.length);
              const countMatches = count === assertion.expected;
              result.assertions.push({
                passed: countMatches,
                message: `Found ${count} elements matching "${assertion.selector}" (expected ${assertion.expected})`,
              });
              break;
          }
        } catch (error) {
          result.assertions.push({
            passed: false,
            message: `Assertion failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          });
        }
      }
    }
    
    // Take final screenshot
    const finalScreenshot = await page.screenshot({ fullPage: true });
    result.screenshots.push(finalScreenshot.toString('base64'));
    
    // Check if all assertions passed
    result.success = result.assertions.every(a => a.passed);
    
  } catch (error) {
    result.success = false;
    result.error = error instanceof Error ? error.message : 'Unknown error';
    result.logs.push(`Error: ${result.error}`);
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
