interface ConfigValidation {
  valid: boolean;
  errors: string[];
  warnings: string[];
  config: Record<string, any>;
}

export function validatePlatformConfig(): ConfigValidation {
  const errors: string[] = [];
  const warnings: string[] = [];
  const config: Record<string, any> = {};

  // Required environment variables
  const required = {
    DATABASE_URL: 'PostgreSQL connection string',
    SESSION_SECRET: 'Session encryption key',
    PORT: 'Server port (default: 5000)'
  };

  // Optional but recommended
  const optional = {
    GITHUB_TOKEN: 'GitHub integration',
    GITHUB_REPO: 'GitHub repository',
    STRIPE_SECRET_KEY: 'Payment processing',
    STRIPE_WEBHOOK_SECRET: 'Stripe webhooks',
    RESEND_API_KEY: 'Email notifications',
    OWNER_USER_ID: 'Platform owner identifier',
    NODE_ENV: 'Environment (production/development)'
  };

  // Check required vars
  for (const [key, description] of Object.entries(required)) {
    if (!process.env[key]) {
      errors.push(`Missing required: ${key} - ${description}`);
    } else {
      config[key] = '✓ Set';
    }
  }

  // Check optional vars
  for (const [key, description] of Object.entries(optional)) {
    if (!process.env[key]) {
      warnings.push(`Missing optional: ${key} - ${description}`);
      config[key] = '✗ Not set';
    } else {
      config[key] = '✓ Set';
    }
  }

  // Validate DATABASE_URL format
  if (process.env.DATABASE_URL && !process.env.DATABASE_URL.startsWith('postgresql://')) {
    errors.push('DATABASE_URL must be a PostgreSQL connection string starting with postgresql://');
  }

  // Validate NODE_ENV
  if (process.env.NODE_ENV && !['production', 'development', 'test'].includes(process.env.NODE_ENV)) {
    warnings.push(`NODE_ENV should be 'production', 'development', or 'test' (got '${process.env.NODE_ENV}')`);
  }

  // Check SSL configuration
  if (process.env.NODE_ENV === 'production') {
    config.SSL = process.env.DATABASE_URL?.includes('sslmode=require') ? '✓ Enabled' : '⚠ Check SSL mode';
  }

  // Check Render-specific vars
  if (process.env.RENDER) {
    config.PLATFORM = 'Render';
    config.RENDER_SERVICE_NAME = process.env.RENDER_SERVICE_NAME || 'Unknown';
  }

  return {
    valid: errors.length === 0,
    errors,
    warnings,
    config
  };
}

export function generateEnvTemplate(): string {
  return `# Archetype Platform Configuration Template
# Generated: ${new Date().toISOString()}

# === REQUIRED ===
# PostgreSQL database connection string
DATABASE_URL=postgresql://user:password@host:5432/dbname?sslmode=require

# Session encryption secret (generate with: openssl rand -base64 32)
SESSION_SECRET=your-secret-here

# Server port (default: 5000)
PORT=5000

# === OPTIONAL BUT RECOMMENDED ===
# Environment mode
NODE_ENV=production

# GitHub integration (for platform modifications)
GITHUB_TOKEN=ghp_xxxxxxxxxxxx
GITHUB_REPO=username/repo-name
GITHUB_BRANCH=main

# Stripe payment processing
STRIPE_SECRET_KEY=sk_live_xxxxxxxxxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxxxxxxxxx

# Email notifications (Resend)
RESEND_API_KEY=re_xxxxxxxxxxxx

# Platform owner (Replit user ID)
OWNER_USER_ID=replit-user-id

# === PLATFORM SPECIFIC ===
# Render deployment
RENDER=true
RENDER_SERVICE_NAME=archetype-platform
`;
}