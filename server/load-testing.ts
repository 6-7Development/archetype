/**
 * Load Testing Infrastructure for Rate Limiter and Concurrent Connections
 * Use: npx ts-node server/load-testing.ts [test-type] [concurrency]
 * 
 * Examples:
 *   - npx ts-node server/load-testing.ts rate-limit 100
 *   - npx ts-node server/load-testing.ts concurrency 50
 *   - npx ts-node server/load-testing.ts health-check 25
 */

import axios from 'axios';
import { performance } from 'perf_hooks';

const BASE_URL = process.env.TEST_URL || 'http://localhost:5000';

interface LoadTestResult {
  testType: string;
  concurrency: number;
  totalRequests: number;
  successCount: number;
  failureCount: number;
  rateLimitedCount: number;
  avgResponseTime: number;
  minResponseTime: number;
  maxResponseTime: number;
  duration: number;
  requestsPerSecond: number;
}

/**
 * Rate limiter stress test
 * Sends concurrent requests to verify rate limiting behavior
 */
async function testRateLimiter(concurrency: number): Promise<LoadTestResult> {
  console.log(`\n🔥 Starting rate limiter test with ${concurrency} concurrent requests...`);
  
  const results: LoadTestResult = {
    testType: 'rate-limit',
    concurrency,
    totalRequests: 0,
    successCount: 0,
    failureCount: 0,
    rateLimitedCount: 0,
    avgResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    duration: 0,
    requestsPerSecond: 0,
  };

  const responseTimes: number[] = [];
  const startTime = performance.now();

  // Create concurrent request batches
  const batches = 3;
  const requestsPerBatch = concurrency;

  for (let batch = 0; batch < batches; batch++) {
    console.log(`  Batch ${batch + 1}/${batches}...`);
    const batchPromises = [];

    for (let i = 0; i < requestsPerBatch; i++) {
      const promise = axios
        .get(`${BASE_URL}/api/health`)
        .then(() => {
          results.successCount++;
          return 200;
        })
        .catch((error) => {
          results.totalRequests++;
          if (error.response?.status === 429) {
            results.rateLimitedCount++;
          } else {
            results.failureCount++;
          }
          return error.response?.status || 500;
        });

      batchPromises.push(promise);
    }

    // Send batch and measure response times
    const batchStart = performance.now();
    await Promise.all(batchPromises);
    const batchDuration = performance.now() - batchStart;

    // Track response times
    responseTimes.push(batchDuration / requestsPerBatch);
    console.log(`    Batch response time: ${(batchDuration / requestsPerBatch).toFixed(2)}ms per request`);

    // Small delay between batches
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  const duration = performance.now() - startTime;
  results.totalRequests = results.successCount + results.failureCount + results.rateLimitedCount;
  results.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  results.minResponseTime = Math.min(...responseTimes);
  results.maxResponseTime = Math.max(...responseTimes);
  results.duration = duration;
  results.requestsPerSecond = (results.totalRequests / duration) * 1000;

  return results;
}

/**
 * Connection concurrency test
 * Tests WebSocket and HTTP concurrent connections
 */
async function testConcurrency(concurrency: number): Promise<LoadTestResult> {
  console.log(`\n🔥 Starting concurrency test with ${concurrency} concurrent connections...`);
  
  const results: LoadTestResult = {
    testType: 'concurrency',
    concurrency,
    totalRequests: 0,
    successCount: 0,
    failureCount: 0,
    rateLimitedCount: 0,
    avgResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    duration: 0,
    requestsPerSecond: 0,
  };

  const responseTimes: number[] = [];
  const startTime = performance.now();

  // Open all connections simultaneously
  const connectionPromises = [];
  for (let i = 0; i < concurrency; i++) {
    const promise = (async () => {
      const reqStart = performance.now();
      try {
        await axios.get(`${BASE_URL}/api/health`, {
          timeout: 10000,
        });
        results.successCount++;
        responseTimes.push(performance.now() - reqStart);
        return 200;
      } catch (error: any) {
        results.totalRequests++;
        if (error.response?.status === 429) {
          results.rateLimitedCount++;
        } else {
          results.failureCount++;
        }
        responseTimes.push(performance.now() - reqStart);
        return error.response?.status || 500;
      }
    })();
    connectionPromises.push(promise);
  }

  // Wait for all connections to complete
  await Promise.all(connectionPromises);

  const duration = performance.now() - startTime;
  results.totalRequests = results.successCount + results.failureCount + results.rateLimitedCount;
  results.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  results.minResponseTime = Math.min(...responseTimes);
  results.maxResponseTime = Math.max(...responseTimes);
  results.duration = duration;
  results.requestsPerSecond = (results.totalRequests / duration) * 1000;

  return results;
}

/**
 * Health check endpoint test
 * Simple baseline test for comparison
 */
async function testHealthCheck(concurrency: number): Promise<LoadTestResult> {
  console.log(`\n🔥 Starting health check test with ${concurrency} concurrent requests...`);
  
  const results: LoadTestResult = {
    testType: 'health-check',
    concurrency,
    totalRequests: concurrency,
    successCount: 0,
    failureCount: 0,
    rateLimitedCount: 0,
    avgResponseTime: 0,
    minResponseTime: Infinity,
    maxResponseTime: 0,
    duration: 0,
    requestsPerSecond: 0,
  };

  const responseTimes: number[] = [];
  const startTime = performance.now();

  const promises = Array(concurrency)
    .fill(null)
    .map(async () => {
      const reqStart = performance.now();
      try {
        const response = await axios.get(`${BASE_URL}/api/health`, {
          timeout: 5000,
        });
        results.successCount++;
        const responseTime = performance.now() - reqStart;
        responseTimes.push(responseTime);
        results.minResponseTime = Math.min(results.minResponseTime, responseTime);
        results.maxResponseTime = Math.max(results.maxResponseTime, responseTime);
      } catch (error) {
        results.failureCount++;
        responseTimes.push(performance.now() - reqStart);
      }
    });

  await Promise.all(promises);

  const duration = performance.now() - startTime;
  results.avgResponseTime = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
  results.duration = duration;
  results.requestsPerSecond = (results.totalRequests / duration) * 1000;

  return results;
}

/**
 * Format and display test results
 */
function printResults(result: LoadTestResult): void {
  console.log('\n' + '='.repeat(60));
  console.log(`📊 Load Test Results: ${result.testType}`);
  console.log('='.repeat(60));
  console.log(`Concurrency Level:     ${result.concurrency}`);
  console.log(`Total Requests:        ${result.totalRequests}`);
  console.log(`Successful:            ${result.successCount} (${((result.successCount / result.totalRequests) * 100).toFixed(1)}%)`);
  console.log(`Failed:                ${result.failureCount}`);
  console.log(`Rate Limited (429):    ${result.rateLimitedCount}`);
  console.log(`\nResponse Times (ms):`);
  console.log(`  Average:             ${result.avgResponseTime.toFixed(2)}`);
  console.log(`  Min:                 ${result.minResponseTime.toFixed(2)}`);
  console.log(`  Max:                 ${result.maxResponseTime.toFixed(2)}`);
  console.log(`\nThroughput:`);
  console.log(`  Total Duration:      ${(result.duration / 1000).toFixed(2)}s`);
  console.log(`  Requests/Second:     ${result.requestsPerSecond.toFixed(2)}`);
  console.log('='.repeat(60) + '\n');
}

/**
 * Main test runner
 */
async function runTests(): Promise<void> {
  const testType = process.argv[2] || 'health-check';
  const concurrency = parseInt(process.argv[3] || '25', 10);

  console.log('🧪 BeeHive Load Testing Suite');
  console.log(`Testing against: ${BASE_URL}`);

  try {
    let result: LoadTestResult;

    switch (testType.toLowerCase()) {
      case 'rate-limit':
        result = await testRateLimiter(concurrency);
        break;
      case 'concurrency':
        result = await testConcurrency(concurrency);
        break;
      case 'health-check':
      default:
        result = await testHealthCheck(concurrency);
    }

    printResults(result);
  } catch (error) {
    console.error('❌ Test failed:', (error as Error).message);
    process.exit(1);
  }
}

runTests();
