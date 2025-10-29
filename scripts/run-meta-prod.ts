#!/usr/bin/env tsx
/**
 * Meta-SySop Production Parity Workflow
 * 
 * Runs the application in production mode locally with Railway-like environment.
 * This enables testing Meta-SySop diagnosis, healing, and validation against
 * production build artifacts before deploying.
 * 
 * Phase D of the bulletproof Meta-SySop implementation.
 */

import { spawn, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');

interface ProductionConfig {
  port: number;
  seedDatabase: boolean;
  mockSecrets: boolean;
  verbose: boolean;
  skipBuild: boolean;
}

// Parse command line arguments
function parseArgs(): ProductionConfig {
  const args = process.argv.slice(2);
  return {
    port: parseInt(args.find(a => a.startsWith('--port='))?.split('=')[1] || '5000'),
    seedDatabase: args.includes('--seed'),
    mockSecrets: args.includes('--mock-secrets'),
    verbose: args.includes('--verbose'),
    skipBuild: args.includes('--skip-build'),
  };
}

// Color output helpers
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  cyan: '\x1b[36m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  blue: '\x1b[34m',
};

function log(message: string, color: keyof typeof colors = 'reset') {
  console.log(`${colors[color]}${message}${colors.reset}`);
}

function logStep(step: string, message: string) {
  console.log(`${colors.bright}${colors.blue}[${step}]${colors.reset} ${message}`);
}

function logSuccess(message: string) {
  console.log(`${colors.green}✓${colors.reset} ${message}`);
}

function logError(message: string) {
  console.log(`${colors.red}✗${colors.reset} ${message}`);
}

function logWarning(message: string) {
  console.log(`${colors.yellow}⚠${colors.reset} ${message}`);
}

// Step 1: Build the application
async function buildApplication(config: ProductionConfig): Promise<boolean> {
  if (config.skipBuild) {
    logWarning('Skipping build (--skip-build flag set)');
    return true;
  }

  logStep('BUILD', 'Building application for production...');
  
  try {
    // Check if dist directory exists and clean it
    const distPath = path.join(PROJECT_ROOT, 'dist');
    if (fs.existsSync(distPath)) {
      logStep('BUILD', 'Cleaning existing dist directory...');
      fs.rmSync(distPath, { recursive: true, force: true });
    }

    // Run build command
    execSync('npm run build', {
      cwd: PROJECT_ROOT,
      stdio: config.verbose ? 'inherit' : 'pipe',
      env: {
        ...process.env,
        NODE_ENV: 'production',
      },
    });

    // Verify build artifacts exist
    const serverArtifact = path.join(distPath, 'index.js');
    const clientArtifact = path.join(distPath, 'client');
    
    if (!fs.existsSync(serverArtifact)) {
      throw new Error('Server build artifact not found: dist/index.js');
    }
    
    if (!fs.existsSync(clientArtifact)) {
      throw new Error('Client build artifacts not found: dist/client/');
    }

    logSuccess('Build completed successfully');
    logStep('BUILD', `Server: ${serverArtifact}`);
    logStep('BUILD', `Client: ${clientArtifact}`);
    
    return true;
  } catch (error: any) {
    logError(`Build failed: ${error.message}`);
    if (config.verbose) {
      console.error(error);
    }
    return false;
  }
}

// Step 2: Bootstrap production environment
async function bootstrapEnvironment(config: ProductionConfig): Promise<Record<string, string>> {
  logStep('ENV', 'Bootstrapping production environment...');
  
  const env: Record<string, string> = {
    NODE_ENV: 'production',
    PORT: config.port.toString(),
    ...process.env as Record<string, string>,
  };

  // Mock Railway secrets if requested
  if (config.mockSecrets) {
    logStep('ENV', 'Mocking Railway production secrets...');
    
    // Keep existing DATABASE_URL if set, otherwise use development
    if (!env.DATABASE_URL) {
      logWarning('DATABASE_URL not set - using development database');
      env.DATABASE_URL = process.env.DATABASE_URL || '';
    }

    // Mock other secrets with safe defaults
    if (!env.SESSION_SECRET) {
      env.SESSION_SECRET = 'meta-sysop-local-prod-session-secret-DO-NOT-USE-IN-REAL-PRODUCTION';
      logWarning('Using mock SESSION_SECRET (not for real production)');
    }

    // Mock Anthropic/OpenAI keys if needed
    if (!env.ANTHROPIC_API_KEY && !env.OPENAI_API_KEY) {
      logWarning('No AI API keys set - Meta-SySop chat will not work');
    }

    // Mock GitHub token if available
    if (!env.GITHUB_TOKEN) {
      logWarning('GITHUB_TOKEN not set - GitHub integration disabled');
    }

    // Mock Stripe keys
    if (!env.STRIPE_SECRET_KEY) {
      logWarning('STRIPE_SECRET_KEY not set - payments disabled');
    }
  }

  // Log environment summary
  logSuccess('Environment configured:');
  logStep('ENV', `NODE_ENV: ${env.NODE_ENV}`);
  logStep('ENV', `PORT: ${env.PORT}`);
  logStep('ENV', `DATABASE_URL: ${env.DATABASE_URL ? '✓ configured' : '✗ missing'}`);
  logStep('ENV', `SESSION_SECRET: ${env.SESSION_SECRET ? '✓ configured' : '✗ missing'}`);
  logStep('ENV', `ANTHROPIC_API_KEY: ${env.ANTHROPIC_API_KEY ? '✓ configured' : '✗ missing'}`);
  logStep('ENV', `GITHUB_TOKEN: ${env.GITHUB_TOKEN ? '✓ configured' : '✗ missing'}`);
  
  return env;
}

// Step 3: Seed database fixtures (optional)
async function seedDatabase(config: ProductionConfig): Promise<boolean> {
  if (!config.seedDatabase) {
    logStep('DB', 'Skipping database seeding (use --seed to enable)');
    return true;
  }

  logStep('DB', 'Seeding database with fixtures...');
  
  try {
    // Run database migrations first
    execSync('npm run db:push', {
      cwd: PROJECT_ROOT,
      stdio: config.verbose ? 'inherit' : 'pipe',
    });

    logSuccess('Database migrations applied');

    // TODO: Add fixture seeding here
    // For now, just ensure schema is up to date
    logWarning('Fixture seeding not implemented yet - only migrations applied');
    
    return true;
  } catch (error: any) {
    logError(`Database seeding failed: ${error.message}`);
    if (config.verbose) {
      console.error(error);
    }
    return false;
  }
}

// Step 4: Start production server
async function startProductionServer(config: ProductionConfig, env: Record<string, string>): Promise<void> {
  logStep('SERVER', 'Starting production server...');
  
  const serverPath = path.join(PROJECT_ROOT, 'dist', 'index.js');
  
  // Spawn server process
  const server = spawn('node', [serverPath], {
    cwd: PROJECT_ROOT,
    env,
    stdio: 'inherit',
  });

  server.on('error', (error) => {
    logError(`Server failed to start: ${error.message}`);
    process.exit(1);
  });

  server.on('exit', (code) => {
    if (code === 0) {
      logSuccess('Server exited gracefully');
    } else {
      logError(`Server exited with code ${code}`);
    }
    process.exit(code || 0);
  });

  // Handle graceful shutdown
  process.on('SIGINT', () => {
    log('\nShutting down production server...', 'yellow');
    server.kill('SIGTERM');
  });

  process.on('SIGTERM', () => {
    log('\nShutting down production server...', 'yellow');
    server.kill('SIGTERM');
  });

  logSuccess(`Server started on http://0.0.0.0:${config.port}`);
  log('\n' + '='.repeat(60), 'cyan');
  log('  Meta-SySop Production Mode Active', 'bright');
  log('='.repeat(60), 'cyan');
  log('\nProduction environment summary:', 'cyan');
  log(`  • Build artifacts: dist/`, 'reset');
  log(`  • Server endpoint: http://0.0.0.0:${config.port}`, 'reset');
  log(`  • NODE_ENV: production`, 'reset');
  log(`  • Database: ${env.DATABASE_URL ? 'connected' : 'not configured'}`, 'reset');
  log('\nValidation ready:', 'cyan');
  log(`  • Test Meta-SySop diagnosis against production build`, 'reset');
  log(`  • Verify source⇄artifact fidelity checks`, 'reset');
  log(`  • Validate healing workflows in production mode`, 'reset');
  log('\nPress Ctrl+C to stop\n', 'yellow');
}

// Main orchestration
async function main() {
  const config = parseArgs();

  log('\n' + '='.repeat(60), 'bright');
  log('  Meta-SySop Production Parity Workflow', 'bright');
  log('  Phase D: Local Production Testing', 'bright');
  log('='.repeat(60) + '\n', 'bright');

  // Step 1: Build
  const buildSuccess = await buildApplication(config);
  if (!buildSuccess) {
    logError('Build failed - cannot continue');
    process.exit(1);
  }

  // Step 2: Environment
  const env = await bootstrapEnvironment(config);

  // Step 3: Database (optional)
  const dbSuccess = await seedDatabase(config);
  if (!dbSuccess) {
    logWarning('Database seeding failed - continuing anyway');
  }

  // Step 4: Start server
  await startProductionServer(config, env);
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    logError(`Fatal error: ${error.message}`);
    console.error(error);
    process.exit(1);
  });
}

export { main as runMetaProduction };
