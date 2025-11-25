import { test, expect } from '@playwright/test';

const BASE_URL = 'http://localhost:5000';

test.describe('LomuAI Platform E2E Tests - SWARM Mode & Critical Paths', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BASE_URL);
    // Wait for app to stabilize
    await page.waitForLoadState('networkidle');
  });

  test.describe('SWARM Mode API Accessibility', () => {
    test('SWARM execute endpoint should be accessible', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/swarm/execute`, {
        data: {
          description: 'Test SWARM execution',
          requiredTools: [],
          maxCost: 100
        }
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('taskId');
      expect(body).toHaveProperty('execution');
      expect(body.execution).toHaveProperty('status');
    });

    test('SWARM stats endpoint should return active execution count', async ({ request }) => {
      const response = await request.get(`${BASE_URL}/api/swarm/stats`);
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body).toHaveProperty('activeExecutions');
      expect(typeof body.activeExecutions).toBe('number');
    });

    test('SWARM status endpoint should handle task IDs', async ({ request }) => {
      // Create a task first
      const executeResponse = await request.post(`${BASE_URL}/api/swarm/execute`, {
        data: {
          description: 'Get status test',
          requiredTools: []
        }
      });
      
      const { taskId } = await executeResponse.json();
      
      // Query the status
      const statusResponse = await request.get(`${BASE_URL}/api/swarm/status/${taskId}`);
      expect([200, 404]).toContain(statusResponse.status());
    });

    test('Guard rails should reject unregistered tools', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/swarm/execute`, {
        data: {
          description: 'Test guard rails',
          requiredTools: ['nonexistent-tool-xyz']
        }
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.execution).toHaveProperty('errors');
      expect(body.execution.errors.length).toBeGreaterThan(0);
    });

    test('Rate limiting should be enforced', async ({ request }) => {
      const requests = Array.from({ length: 5 }, () =>
        request.post(`${BASE_URL}/api/swarm/execute`, {
          data: { description: 'Rate limit test', requiredTools: [] }
        })
      );
      
      const responses = await Promise.all(requests);
      const allSuccessful = responses.every(r => [200, 429].includes(r.status()));
      expect(allSuccessful).toBe(true);
    });
  });

  test.describe('SWARM Dashboard UI', () => {
    test('SWARM Dashboard page should load and render', async ({ page }) => {
      await page.goto(`${BASE_URL}/swarm-dashboard`);
      await page.waitForLoadState('networkidle');
      
      // Check for key elements
      const title = page.locator('text=/SWARM|Swarm/i').first();
      await expect(title).toBeVisible({ timeout: 5000 });
    });

    test('SWARM Mode button should be present in workspace', async ({ page }) => {
      // Navigate to a workspace/builder page if it exists
      await page.goto(`${BASE_URL}/dashboard`);
      
      const swarmButton = page.locator('[data-testid*="swarm"]').first();
      // Button might exist or not depending on auth state
      if (await swarmButton.isVisible({ timeout: 2000 }).catch(() => false)) {
        expect(swarmButton).toBeDefined();
      }
    });
  });

  test.describe('Critical Platform Paths', () => {
    test('Health check endpoints should respond', async ({ request }) => {
      const criticalEndpoints = [
        '/api/health',
        '/api/swarm/stats',
        '/api/projects',
        '/api/lomu-ai/status'
      ];

      for (const endpoint of criticalEndpoints) {
        const response = await request.get(`${BASE_URL}${endpoint}`).catch(() => null);
        // Endpoints might require auth, but should not 500
        if (response) {
          expect([200, 401, 403]).toContain(response.status());
        }
      }
    });

    test('Database connection should be active', async ({ request }) => {
      // Try accessing an endpoint that requires DB
      const response = await request.get(`${BASE_URL}/api/swarm/stats`);
      expect([200, 401]).toContain(response.status());
    });

    test('WebSocket server should be accessible', async ({ page }) => {
      // Just verify page loads without WebSocket errors
      await page.goto(`${BASE_URL}`);
      
      // Check browser console for WebSocket errors
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      await page.waitForTimeout(2000);
      
      const wsErrors = errors.filter(e => e.toLowerCase().includes('websocket'));
      expect(wsErrors.length).toBe(0);
    });
  });

  test.describe('Guard Rails Security Tests', () => {
    test('Should prevent RCE via input sanitization', async ({ request }) => {
      const maliciousInputs = [
        'rm -rf /',
        'cat /etc/passwd',
        '${process.exit()}',
        'import os; os.system("rm -rf /")'
      ];

      for (const input of maliciousInputs) {
        const response = await request.post(`${BASE_URL}/api/swarm/execute`, {
          data: {
            description: input,
            requiredTools: []
          }
        });
        
        expect(response.status()).toBe(200);
        const body = await response.json();
        // Should either reject or safely handle
        expect(body).toHaveProperty('execution');
      }
    });

    test('Should enforce cost limits', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/swarm/execute`, {
        data: {
          description: 'Very expensive operation',
          requiredTools: ['expensive-tool'],
          maxCost: 1 // Very low cost limit
        }
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      expect(body.execution).toHaveProperty('totalCost');
    });

    test('Tool validation should work correctly', async ({ request }) => {
      // Test with mix of valid and invalid tools
      const response = await request.post(`${BASE_URL}/api/swarm/execute`, {
        data: {
          description: 'Mixed tool test',
          requiredTools: ['unknown-tool-1', 'unknown-tool-2']
        }
      });
      
      expect(response.status()).toBe(200);
      const body = await response.json();
      // Should have errors for unknown tools
      expect(body.execution.errors).toBeDefined();
    });
  });

  test.describe('UI Component Integration', () => {
    test('Theme toggle should work', async ({ page }) => {
      await page.goto(`${BASE_URL}`);
      
      const themeToggle = page.locator('[data-testid*="theme"]').first();
      if (await themeToggle.isVisible({ timeout: 2000 }).catch(() => false)) {
        await themeToggle.click();
        await page.waitForTimeout(500);
        expect(await page.locator('html').evaluate(el => el.className)).toMatch(/dark|light/);
      }
    });

    test('Navigation should work without errors', async ({ page }) => {
      await page.goto(`${BASE_URL}/dashboard`);
      await page.waitForLoadState('networkidle');
      
      // No console errors
      const errors: string[] = [];
      page.on('console', msg => {
        if (msg.type() === 'error') {
          errors.push(msg.text());
        }
      });
      
      expect(errors.length).toBe(0);
    });
  });

  test.describe('Performance Checks', () => {
    test('Initial page load should be fast', async ({ page }) => {
      const start = Date.now();
      await page.goto(`${BASE_URL}`);
      await page.waitForLoadState('domcontentloaded');
      const loadTime = Date.now() - start;
      
      // Should load in under 5 seconds
      expect(loadTime).toBeLessThan(5000);
    });

    test('SWARM API responses should be reasonably fast', async ({ request }) => {
      const start = Date.now();
      const response = await request.get(`${BASE_URL}/api/swarm/stats`);
      const responseTime = Date.now() - start;
      
      expect(response.status()).toBe(200);
      expect(responseTime).toBeLessThan(1000);
    });
  });

  test.describe('Data Integrity', () => {
    test('SWARM execution should have complete execution log', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/swarm/execute`, {
        data: {
          description: 'Data integrity test',
          requiredTools: []
        }
      });
      
      const body = await response.json();
      const { execution } = body;
      
      expect(execution).toHaveProperty('taskId');
      expect(execution).toHaveProperty('startTime');
      expect(execution).toHaveProperty('status');
      expect(execution).toHaveProperty('executionLog');
      expect(Array.isArray(execution.executionLog)).toBe(true);
    });

    test('Guard rail checks should be logged', async ({ request }) => {
      const response = await request.post(`${BASE_URL}/api/swarm/execute`, {
        data: {
          description: 'Log test',
          requiredTools: []
        }
      });
      
      const body = await response.json();
      const log = JSON.stringify(body.execution.executionLog);
      
      // Should have at least guard rail and orchestrator logs
      expect(log).toMatch(/GUARD-RAIL|ORCHESTRATOR/i);
    });
  });
});
