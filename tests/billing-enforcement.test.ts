import { test, expect } from '@playwright/test';

test.describe('Billing Enforcement', () => {
  test('should block message send when credits insufficient', async ({ page }) => {
    // Login and navigate to workspace
    await page.goto('/');
    
    // Mock credit balance API to return 0 credits
    await page.route('**/api/credits/balance', route => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: true, 
          balance: { available: 0, reserved: 0, total: 0 } 
        })
      });
    });
    
    // Mock access tier to return paid (non-free)
    await page.route('**/api/lomu-chat/access-tier', route => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFreeAccess: false })
      });
    });
    
    // Navigate to workspace page
    await page.goto('/workspace');
    
    // Wait for chat to load
    await page.waitForSelector('[data-testid="input-message"]', { timeout: 5000 });
    
    // Try to send a message
    await page.fill('[data-testid="input-message"]', 'Test message that should be blocked');
    await page.click('[data-testid="button-send"]');
    
    // Should see "Insufficient Credits" toast notification
    await expect(page.getByText('Insufficient Credits')).toBeVisible({ timeout: 3000 });
    
    // Message should NOT appear in chat (blocked)
    await expect(page.getByText('Test message that should be blocked')).not.toBeVisible();
  });
  
  test('should allow message send when credits sufficient (project context)', async ({ page }) => {
    // Mock credit balance API to return sufficient credits (1000)
    await page.route('**/api/credits/balance', route => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: true, 
          balance: { available: 1000, reserved: 0, total: 1000 } 
        })
      });
    });
    
    // Mock access tier to return paid (non-free)
    await page.route('**/api/lomu-chat/access-tier', route => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFreeAccess: false })
      });
    });
    
    // Navigate to workspace page
    await page.goto('/workspace');
    
    // Wait for chat to load
    await page.waitForSelector('[data-testid="input-message"]', { timeout: 5000 });
    
    // Send a message with sufficient credits
    await page.fill('[data-testid="input-message"]', 'Test message with credits');
    await page.click('[data-testid="button-send"]');
    
    // Should NOT see insufficient credits error
    await expect(page.getByText('Insufficient Credits')).not.toBeVisible();
    
    // Message should appear in chat
    await expect(page.getByText('Test message with credits')).toBeVisible({ timeout: 3000 });
  });
  
  test('should allow FREE message send for platform healing (owner only)', async ({ page }) => {
    // Mock access tier to return FREE for platform healing
    await page.route('**/api/lomu-chat/access-tier', route => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFreeAccess: true })
      });
    });
    
    // Navigate to platform healing page (owner-only)
    await page.goto('/platform-healing');
    
    // Wait for chat to load
    await page.waitForSelector('[data-testid="input-message"]', { timeout: 5000 });
    
    // Platform healing = FREE, so no credit check should occur
    await page.fill('[data-testid="input-message"]', 'Fix platform bug');
    await page.click('[data-testid="button-send"]');
    
    // Should NOT see insufficient credits dialog (FREE access)
    await expect(page.getByText('Insufficient Credits')).not.toBeVisible();
    
    // Message should appear in chat
    await expect(page.getByText('Fix platform bug')).toBeVisible({ timeout: 3000 });
  });
  
  test('should refresh credit balance before EVERY message send', async ({ page }) => {
    let creditCheckCount = 0;
    
    // Track how many times credit balance is fetched
    await page.route('**/api/credits/balance', route => {
      creditCheckCount++;
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: true, 
          balance: { available: 1000, reserved: 0, total: 1000 } 
        })
      });
    });
    
    // Mock access tier to return paid
    await page.route('**/api/lomu-chat/access-tier', route => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFreeAccess: false })
      });
    });
    
    await page.goto('/workspace');
    await page.waitForSelector('[data-testid="input-message"]', { timeout: 5000 });
    
    // Send first message
    await page.fill('[data-testid="input-message"]', 'First message');
    await page.click('[data-testid="button-send"]');
    await page.waitForTimeout(1000);
    
    const firstCheckCount = creditCheckCount;
    
    // Send second message
    await page.fill('[data-testid="input-message"]', 'Second message');
    await page.click('[data-testid="button-send"]');
    await page.waitForTimeout(1000);
    
    // Credit balance should be checked BEFORE each message
    // Should have at least 2 separate checks (one per message)
    expect(creditCheckCount).toBeGreaterThan(firstCheckCount);
  });
  
  test('should block on API error when checking credit balance', async ({ page }) => {
    // Mock credit balance API to return error
    await page.route('**/api/credits/balance', route => {
      route.fulfill({
        status: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Internal server error' })
      });
    });
    
    // Mock access tier to return paid
    await page.route('**/api/lomu-chat/access-tier', route => {
      route.fulfill({
        status: 200,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isFreeAccess: false })
      });
    });
    
    await page.goto('/workspace');
    await page.waitForSelector('[data-testid="input-message"]', { timeout: 5000 });
    
    // Try to send message
    await page.fill('[data-testid="input-message"]', 'Message that should be blocked on error');
    await page.click('[data-testid="button-send"]');
    
    // Should see error toast (not insufficient credits, but API error)
    await expect(page.getByText('Unable to verify credit balance')).toBeVisible({ timeout: 3000 });
    
    // Message should NOT be sent (blocked on error)
    await expect(page.getByText('Message that should be blocked on error')).not.toBeVisible();
  });
});
