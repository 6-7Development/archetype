import crypto from 'crypto';

/**
 * Webhook Signature Verification Service
 * 
 * Prevents spoofing attacks by verifying webhook signatures using HMAC-SHA256.
 * Uses constant-time comparison to prevent timing attacks.
 */

export interface WebhookVerificationResult {
  valid: boolean;
  error?: string;
}

/**
 * Verify webhook signature using HMAC-SHA256
 * 
 * @param payload - The raw request body (string or Buffer)
 * @param signature - The signature from the webhook header
 * @param secret - The webhook secret key
 * @returns Verification result with valid flag and optional error
 */
export function verifyWebhookSignature(
  payload: string | Buffer,
  signature: string,
  secret: string
): WebhookVerificationResult {
  if (!secret) {
    return {
      valid: false,
      error: 'Webhook secret not configured',
    };
  }

  if (!signature) {
    return {
      valid: false,
      error: 'Missing signature header',
    };
  }

  try {
    // Ensure payload is a Buffer
    const payloadBuffer = typeof payload === 'string' 
      ? Buffer.from(payload, 'utf8') 
      : payload;

    // Compute HMAC-SHA256 signature
    const hmac = crypto.createHmac('sha256', secret);
    hmac.update(payloadBuffer);
    const computedSignature = hmac.digest('hex');

    // Remove any prefix from the signature (e.g., "sha256=")
    const cleanSignature = signature.replace(/^sha256=/, '');

    // Constant-time comparison to prevent timing attacks
    const signatureBuffer = Buffer.from(cleanSignature, 'hex');
    const computedBuffer = Buffer.from(computedSignature, 'hex');

    if (signatureBuffer.length !== computedBuffer.length) {
      return {
        valid: false,
        error: 'Invalid signature format',
      };
    }

    const isValid = crypto.timingSafeEqual(signatureBuffer, computedBuffer);

    return {
      valid: isValid,
      error: isValid ? undefined : 'Invalid signature',
    };
  } catch (error: any) {
    return {
      valid: false,
      error: `Signature verification failed: ${error.message}`,
    };
  }
}

/**
 * Verify Railway webhook signature
 * 
 * Railway sends webhooks with the 'x-webhook-signature' header containing
 * an HMAC-SHA256 signature of the request body.
 * 
 * Configure in Railway dashboard:
 * 1. Go to your service settings
 * 2. Navigate to "Webhooks"
 * 3. Add webhook URL: https://your-domain.com/api/webhooks/deployment
 * 4. Set the secret (save this as WEBHOOK_SECRET in your environment)
 * 5. Railway will send the signature in the 'x-webhook-signature' header
 * 
 * @param payload - The raw request body
 * @param signature - Value from 'x-webhook-signature' header
 * @param secret - Your WEBHOOK_SECRET environment variable
 * @returns Verification result
 */
export function verifyRailwayWebhook(
  payload: string | Buffer,
  signature: string,
  secret: string
): WebhookVerificationResult {
  return verifyWebhookSignature(payload, signature, secret);
}

/**
 * Verify Render webhook signature
 * 
 * Render sends webhooks with the 'render-signature' header containing
 * an HMAC-SHA256 signature of the request body.
 * 
 * Configure in Render dashboard:
 * 1. Go to your service settings
 * 2. Navigate to "Notifications"
 * 3. Add webhook URL: https://your-domain.com/api/webhooks/deployment
 * 4. Set the secret (save this as WEBHOOK_SECRET in your environment)
 * 5. Render will send the signature in the 'render-signature' header
 * 
 * @param payload - The raw request body
 * @param signature - Value from 'render-signature' header
 * @param secret - Your WEBHOOK_SECRET environment variable
 * @returns Verification result
 */
export function verifyRenderWebhook(
  payload: string | Buffer,
  signature: string,
  secret: string
): WebhookVerificationResult {
  return verifyWebhookSignature(payload, signature, secret);
}

/**
 * Generate a webhook signature for testing purposes
 * 
 * @param payload - The payload to sign
 * @param secret - The webhook secret
 * @returns HMAC-SHA256 signature as hex string
 */
export function generateWebhookSignature(
  payload: string | Buffer,
  secret: string
): string {
  const payloadBuffer = typeof payload === 'string' 
    ? Buffer.from(payload, 'utf8') 
    : payload;

  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadBuffer);
  return hmac.digest('hex');
}
