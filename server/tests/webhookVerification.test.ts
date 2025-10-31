/**
 * Webhook Signature Verification Tests
 * 
 * Tests for HMAC-SHA256 webhook signature verification to prevent spoofing attacks.
 * 
 * Run with: npm test server/tests/webhookVerification.test.ts
 */

import { describe, it, expect } from '@jest/globals';
import { 
  verifyWebhookSignature, 
  verifyRailwayWebhook, 
  verifyRenderWebhook,
  generateWebhookSignature 
} from '../services/webhookVerification';

// Test secret (32 bytes hex)
const TEST_SECRET = 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6a7b8c9d0e1f2';

// Example Railway webhook payload
const RAILWAY_PAYLOAD = {
  status: 'SUCCESS',
  deploymentId: 'dep-railway-123',
  url: 'https://archetype-production.up.railway.app',
  timestamp: '2025-10-31T12:00:00Z',
};

// Example Render webhook payload
const RENDER_PAYLOAD = {
  status: 'live',
  deployId: 'dep-render-xyz',
  url: 'https://archetype.onrender.com',
  createdAt: '2025-10-31T12:00:00Z',
};

describe('Webhook Signature Verification', () => {
  describe('verifyWebhookSignature', () => {
    it('should verify valid signature for string payload', () => {
      const payload = JSON.stringify(RAILWAY_PAYLOAD);
      const signature = generateWebhookSignature(payload, TEST_SECRET);
      
      const result = verifyWebhookSignature(payload, signature, TEST_SECRET);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should verify valid signature for Buffer payload', () => {
      const payload = Buffer.from(JSON.stringify(RAILWAY_PAYLOAD), 'utf8');
      const signature = generateWebhookSignature(payload, TEST_SECRET);
      
      const result = verifyWebhookSignature(payload, signature, TEST_SECRET);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject invalid signature', () => {
      const payload = JSON.stringify(RAILWAY_PAYLOAD);
      const wrongSignature = 'invalid-signature-12345';
      
      const result = verifyWebhookSignature(payload, wrongSignature, TEST_SECRET);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should reject signature with wrong secret', () => {
      const payload = JSON.stringify(RAILWAY_PAYLOAD);
      const signature = generateWebhookSignature(payload, TEST_SECRET);
      const wrongSecret = 'wrong-secret-key';
      
      const result = verifyWebhookSignature(payload, signature, wrongSecret);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Invalid signature');
    });

    it('should reject when signature is missing', () => {
      const payload = JSON.stringify(RAILWAY_PAYLOAD);
      
      const result = verifyWebhookSignature(payload, '', TEST_SECRET);
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('Missing signature');
    });

    it('should reject when secret is missing', () => {
      const payload = JSON.stringify(RAILWAY_PAYLOAD);
      const signature = generateWebhookSignature(payload, TEST_SECRET);
      
      const result = verifyWebhookSignature(payload, signature, '');
      
      expect(result.valid).toBe(false);
      expect(result.error).toContain('secret not configured');
    });

    it('should handle signature with sha256= prefix', () => {
      const payload = JSON.stringify(RAILWAY_PAYLOAD);
      const signature = generateWebhookSignature(payload, TEST_SECRET);
      const prefixedSignature = `sha256=${signature}`;
      
      const result = verifyWebhookSignature(payload, prefixedSignature, TEST_SECRET);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject tampered payload', () => {
      const payload = JSON.stringify(RAILWAY_PAYLOAD);
      const signature = generateWebhookSignature(payload, TEST_SECRET);
      
      // Tamper with payload
      const tamperedPayload = JSON.stringify({ ...RAILWAY_PAYLOAD, status: 'FAILED' });
      
      const result = verifyWebhookSignature(tamperedPayload, signature, TEST_SECRET);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });

    it('should use constant-time comparison (timing attack prevention)', () => {
      const payload = JSON.stringify(RAILWAY_PAYLOAD);
      const validSignature = generateWebhookSignature(payload, TEST_SECRET);
      
      // Create an almost-correct signature (differs by one character)
      const almostCorrectSignature = validSignature.substring(0, validSignature.length - 1) + 
        (validSignature[validSignature.length - 1] === '0' ? '1' : '0');
      
      const result = verifyWebhookSignature(payload, almostCorrectSignature, TEST_SECRET);
      
      // Should still reject even if only one character is different
      expect(result.valid).toBe(false);
    });
  });

  describe('verifyRailwayWebhook', () => {
    it('should verify valid Railway webhook', () => {
      const payload = JSON.stringify(RAILWAY_PAYLOAD);
      const signature = generateWebhookSignature(payload, TEST_SECRET);
      
      const result = verifyRailwayWebhook(payload, signature, TEST_SECRET);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject Railway webhook with invalid signature', () => {
      const payload = JSON.stringify(RAILWAY_PAYLOAD);
      const wrongSignature = 'wrong-signature';
      
      const result = verifyRailwayWebhook(payload, wrongSignature, TEST_SECRET);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('verifyRenderWebhook', () => {
    it('should verify valid Render webhook', () => {
      const payload = JSON.stringify(RENDER_PAYLOAD);
      const signature = generateWebhookSignature(payload, TEST_SECRET);
      
      const result = verifyRenderWebhook(payload, signature, TEST_SECRET);
      
      expect(result.valid).toBe(true);
      expect(result.error).toBeUndefined();
    });

    it('should reject Render webhook with invalid signature', () => {
      const payload = JSON.stringify(RENDER_PAYLOAD);
      const wrongSignature = 'wrong-signature';
      
      const result = verifyRenderWebhook(payload, wrongSignature, TEST_SECRET);
      
      expect(result.valid).toBe(false);
      expect(result.error).toBeDefined();
    });
  });

  describe('generateWebhookSignature', () => {
    it('should generate consistent signatures for same input', () => {
      const payload = JSON.stringify(RAILWAY_PAYLOAD);
      
      const signature1 = generateWebhookSignature(payload, TEST_SECRET);
      const signature2 = generateWebhookSignature(payload, TEST_SECRET);
      
      expect(signature1).toBe(signature2);
    });

    it('should generate different signatures for different payloads', () => {
      const payload1 = JSON.stringify(RAILWAY_PAYLOAD);
      const payload2 = JSON.stringify(RENDER_PAYLOAD);
      
      const signature1 = generateWebhookSignature(payload1, TEST_SECRET);
      const signature2 = generateWebhookSignature(payload2, TEST_SECRET);
      
      expect(signature1).not.toBe(signature2);
    });

    it('should generate different signatures with different secrets', () => {
      const payload = JSON.stringify(RAILWAY_PAYLOAD);
      const secret1 = TEST_SECRET;
      const secret2 = 'different-secret-key-1234567890abcdef';
      
      const signature1 = generateWebhookSignature(payload, secret1);
      const signature2 = generateWebhookSignature(payload, secret2);
      
      expect(signature1).not.toBe(signature2);
    });

    it('should generate hex string signature', () => {
      const payload = JSON.stringify(RAILWAY_PAYLOAD);
      const signature = generateWebhookSignature(payload, TEST_SECRET);
      
      // HMAC-SHA256 produces 64 character hex string
      expect(signature).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Integration Tests', () => {
    it('should work with real-world Railway webhook example', () => {
      const realPayload = {
        status: 'SUCCESS',
        deploymentId: 'abc123def456',
        url: 'https://my-app.up.railway.app',
        timestamp: new Date().toISOString(),
      };
      
      const payload = JSON.stringify(realPayload);
      const signature = generateWebhookSignature(payload, TEST_SECRET);
      
      const result = verifyRailwayWebhook(payload, signature, TEST_SECRET);
      
      expect(result.valid).toBe(true);
    });

    it('should work with real-world Render webhook example', () => {
      const realPayload = {
        status: 'live',
        deployId: 'srv-xyz789',
        url: 'https://my-app.onrender.com',
        createdAt: new Date().toISOString(),
      };
      
      const payload = JSON.stringify(realPayload);
      const signature = generateWebhookSignature(payload, TEST_SECRET);
      
      const result = verifyRenderWebhook(payload, signature, TEST_SECRET);
      
      expect(result.valid).toBe(true);
    });
  });

  describe('Security Edge Cases', () => {
    it('should handle empty payload', () => {
      const payload = '';
      const signature = generateWebhookSignature(payload, TEST_SECRET);
      
      const result = verifyWebhookSignature(payload, signature, TEST_SECRET);
      
      expect(result.valid).toBe(true);
    });

    it('should handle very large payload', () => {
      const largePayload = JSON.stringify({
        ...RAILWAY_PAYLOAD,
        extraData: 'x'.repeat(100000),
      });
      
      const signature = generateWebhookSignature(largePayload, TEST_SECRET);
      const result = verifyWebhookSignature(largePayload, signature, TEST_SECRET);
      
      expect(result.valid).toBe(true);
    });

    it('should reject signature with different length', () => {
      const payload = JSON.stringify(RAILWAY_PAYLOAD);
      const shortSignature = '1234'; // Too short
      
      const result = verifyWebhookSignature(payload, shortSignature, TEST_SECRET);
      
      expect(result.valid).toBe(false);
    });

    it('should handle special characters in payload', () => {
      const specialPayload = JSON.stringify({
        status: 'SUCCESS',
        message: 'Test with special chars: 你好 🚀 <>&"\'',
        timestamp: '2025-10-31T12:00:00Z',
      });
      
      const signature = generateWebhookSignature(specialPayload, TEST_SECRET);
      const result = verifyWebhookSignature(specialPayload, signature, TEST_SECRET);
      
      expect(result.valid).toBe(true);
    });
  });
});

/**
 * Example usage in a real webhook handler:
 * 
 * ```typescript
 * router.post('/webhooks/deployment', async (req, res) => {
 *   const signature = req.headers['x-webhook-signature'] as string;
 *   const secret = process.env.WEBHOOK_SECRET!;
 *   const payload = JSON.stringify(req.body);
 *   
 *   const result = verifyRailwayWebhook(payload, signature, secret);
 *   
 *   if (!result.valid) {
 *     console.error('[WEBHOOK-SECURITY] Invalid signature:', result.error);
 *     return res.status(401).json({ error: 'Invalid signature' });
 *   }
 *   
 *   // Process webhook...
 * });
 * ```
 */
