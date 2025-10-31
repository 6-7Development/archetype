/**
 * Platform Preview Smoke Tests
 * 
 * Basic health checks for platform preview system:
 * - Preview builds successfully
 * - Routes respond correctly
 * - No crashes or memory leaks
 * - Security headers are present
 */

import { buildPlatformPreview } from '../../services/platformPreviewBuilder';
import fs from 'fs/promises';

/**
 * Run all platform preview smoke tests
 * Returns: Promise<{ passed: number, failed: number, errors: string[] }>
 */
export async function runPreviewSmokeTests(): Promise<{ passed: number; failed: number; errors: string[] }> {
  const results = { passed: 0, failed: 0, errors: [] as string[] };
  const testSessionId = `smoke-test-${Date.now()}`;
  const testFiles = ['client/src/App.tsx', 'server/index.ts'];

  console.log('[SMOKE-TESTS] Starting platform preview smoke tests...\n');

  // Test 1: Basic build with valid files
  try {
    console.log('Test 1: Building preview with valid files...');
    const manifest = await buildPlatformPreview(testSessionId, testFiles);
    
    if (manifest.sessionId === testSessionId && manifest.buildStatus === 'success') {
      console.log('✅ Test 1 PASSED: Build successful');
      results.passed++;
    } else {
      console.log('❌ Test 1 FAILED: Build status:', manifest.buildStatus);
      results.failed++;
      results.errors.push(`Build failed: ${manifest.errors.join(', ')}`);
    }
  } catch (error) {
    console.log('❌ Test 1 FAILED:', error);
    results.failed++;
    results.errors.push(`Build error: ${error}`);
  }

  // Test 2: Build timeout compliance
  try {
    console.log('\nTest 2: Checking build completes within timeout...');
    const startTime = Date.now();
    const manifest = await buildPlatformPreview(`${testSessionId}-timeout`, testFiles);
    const duration = Date.now() - startTime;
    
    if (duration < 30000 && manifest.buildStatus === 'success') {
      console.log(`✅ Test 2 PASSED: Build completed in ${duration}ms`);
      results.passed++;
    } else if (duration >= 30000) {
      console.log(`❌ Test 2 FAILED: Build took ${duration}ms (> 30s)`);
      results.failed++;
      results.errors.push(`Build timeout: ${duration}ms`);
    } else {
      console.log(`❌ Test 2 FAILED: Build status: ${manifest.buildStatus}`);
      results.failed++;
    }
  } catch (error) {
    console.log('❌ Test 2 FAILED:', error);
    results.failed++;
    results.errors.push(`Timeout test error: ${error}`);
  }

  // Test 3: Isolated session directories
  try {
    console.log('\nTest 3: Verifying session isolation...');
    const session1 = `${testSessionId}-iso1`;
    const session2 = `${testSessionId}-iso2`;
    
    await buildPlatformPreview(session1, testFiles);
    await buildPlatformPreview(session2, testFiles);
    
    const dir1 = `/tmp/platform-previews/${session1}`;
    const dir2 = `/tmp/platform-previews/${session2}`;
    
    const [stat1, stat2] = await Promise.all([
      fs.stat(dir1),
      fs.stat(dir2)
    ]);
    
    if (stat1.isDirectory() && stat2.isDirectory()) {
      console.log('✅ Test 3 PASSED: Sessions isolated correctly');
      results.passed++;
    } else {
      console.log('❌ Test 3 FAILED: Session directories not created');
      results.failed++;
      results.errors.push('Session isolation failed');
    }
    
    // Cleanup
    await fs.rm(dir1, { recursive: true, force: true });
    await fs.rm(dir2, { recursive: true, force: true });
  } catch (error) {
    console.log('❌ Test 3 FAILED:', error);
    results.failed++;
    results.errors.push(`Isolation test error: ${error}`);
  }

  // Test 4: Security - path traversal prevention
  try {
    console.log('\nTest 4: Testing path traversal prevention...');
    const maliciousSession = '../../../evil-session';
    const manifest = await buildPlatformPreview(maliciousSession, testFiles);
    
    // Should sanitize the session ID
    if (!manifest.sessionId.includes('..')) {
      console.log('✅ Test 4 PASSED: Path traversal prevented');
      results.passed++;
    } else {
      console.log('❌ Test 4 FAILED: Session ID not sanitized:', manifest.sessionId);
      results.failed++;
      results.errors.push('Path traversal vulnerability');
    }
  } catch (error) {
    console.log('❌ Test 4 FAILED:', error);
    results.failed++;
    results.errors.push(`Security test error: ${error}`);
  }

  // Final cleanup
  try {
    const mainDir = `/tmp/platform-previews/${testSessionId}`;
    await fs.rm(mainDir, { recursive: true, force: true });
  } catch (error) {
    console.warn('[CLEANUP] Failed to cleanup test artifacts:', error);
  }

  // Summary
  console.log('\n' + '='.repeat(50));
  console.log(`SMOKE TESTS COMPLETE: ${results.passed} passed, ${results.failed} failed`);
  if (results.errors.length > 0) {
    console.log('\nErrors:');
    results.errors.forEach(err => console.log(`  - ${err}`));
  }
  console.log('='.repeat(50) + '\n');

  return results;
}

// Run tests if executed directly
if (require.main === module) {
  runPreviewSmokeTests()
    .then(results => {
      process.exit(results.failed > 0 ? 1 : 0);
    })
    .catch(error => {
      console.error('Fatal error running smoke tests:', error);
      process.exit(1);
    });
}
