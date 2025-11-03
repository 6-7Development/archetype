/**
 * Secrets management tools for Lomu AI
 * Handle API keys and environment variables
 */

export interface SecretCheckResult {
  exists: boolean;
  secretKey: string;
  message: string;
}

export interface AskSecretsResult {
  success: boolean;
  message: string;
  secretKeys: string[];
  instructions: string[];
}

/**
 * Ask user to provide secret API keys
 * Prompts user and returns instructions
 */
export async function askSecrets(params: {
  secretKeys: string[];
  userMessage: string;
}): Promise<AskSecretsResult> {
  const { secretKeys, userMessage } = params;
  
  try {
    // Validate secret keys format
    const invalidKeys = secretKeys.filter(key => !key || typeof key !== 'string');
    if (invalidKeys.length > 0) {
      return {
        success: false,
        message: 'Invalid secret key format provided',
        secretKeys: [],
        instructions: [],
      };
    }
    
    return {
      success: true,
      message: userMessage,
      secretKeys,
      instructions: [
        `Please provide the following API keys: ${secretKeys.join(', ')}`,
        'You can add them in the Secrets panel or .env file',
        'Format: KEY_NAME=value',
        'Never commit secrets to git repositories',
      ],
    };
  } catch (error: any) {
    console.error('[ASK-SECRETS] Error:', error);
    return {
      success: false,
      message: `Failed to request secrets: ${error.message}`,
      secretKeys: [],
      instructions: [],
    };
  }
}

/**
 * Check if secrets exist in environment
 * Returns boolean without exposing values
 */
export async function checkSecrets(params: {
  secretKeys: string[];
}): Promise<SecretCheckResult[]> {
  const { secretKeys } = params;
  
  try {
    return secretKeys.map(key => {
      const exists = !!process.env[key];
      
      return {
        exists,
        secretKey: key,
        message: exists 
          ? `✓ ${key} is configured` 
          : `✗ ${key} is missing`,
      };
    });
  } catch (error: any) {
    console.error('[CHECK-SECRETS] Error:', error);
    return secretKeys.map(key => ({
      exists: false,
      secretKey: key,
      message: `Error checking ${key}`,
    }));
  }
}
