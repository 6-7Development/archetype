interface EnvValidationResult {
  valid: boolean;
  missing: string[];
  warnings: string[];
}

export function validateRequiredEnvVars(): EnvValidationResult {
  const required = [
    'DATABASE_URL',
    'SESSION_SECRET',
    'GEMINI_API_KEY',
    'ANTHROPIC_API_KEY',
    'GITHUB_TOKEN',
    'GITHUB_REPO',
  ];
  
  const recommended = [
    'STRIPE_SECRET_KEY',
    'ADMIN_SECRET_KEY',
  ];
  
  const missing: string[] = [];
  const warnings: string[] = [];
  
  // Check required vars
  for (const varName of required) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }
  
  // Check recommended vars
  for (const varName of recommended) {
    if (!process.env[varName]) {
      warnings.push(varName);
    }
  }
  
  return {
    valid: missing.length === 0,
    missing,
    warnings,
  };
}

export function enforceRequiredEnvVars() {
  // Only enforce in production - skip in dev/test/undefined
  if (process.env.NODE_ENV !== 'production') {
    console.log('⚠️  Non-production mode: Skipping strict env validation');
    return;
  }
  
  const result = validateRequiredEnvVars();
  
  if (!result.valid) {
    console.error('❌ CRITICAL: Missing required environment variables:');
    result.missing.forEach(varName => {
      console.error(`   - ${varName}`);
    });
    console.error('\nSet these variables and restart the server.');
    console.error('See .env.example or docs/DEPLOYMENT.md for details.\n');
    process.exit(1);
  }
  
  if (result.warnings.length > 0) {
    console.warn('⚠️  WARNING: Missing recommended environment variables:');
    result.warnings.forEach(varName => {
      console.warn(`   - ${varName}`);
    });
    console.warn('Some features may not work correctly.\n');
  }
  
  // Log boolean indicators for verification
  console.log('✅ Environment variables validated:');
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? '✓ SET' : '✗ MISSING'}`);
  console.log(`   SESSION_SECRET: ${process.env.SESSION_SECRET ? '✓ SET' : '✗ MISSING'}`);
  console.log(`   GEMINI_API_KEY: ${process.env.GEMINI_API_KEY ? '✓ SET' : '✗ MISSING'}`);
  console.log(`   ANTHROPIC_API_KEY: ${process.env.ANTHROPIC_API_KEY ? '✓ SET' : '✗ MISSING'}`);
  console.log(`   GITHUB_TOKEN: ${process.env.GITHUB_TOKEN ? '✓ SET' : '✗ MISSING'}`);
  console.log(`   GITHUB_REPO: ${process.env.GITHUB_REPO || '✗ NOT SET'}`);
  console.log('');
}
