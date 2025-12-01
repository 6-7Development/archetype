/**
 * Deployment Validation
 * 
 * Validates Scout agent configuration for both Replit and Railway
 * Ensures all required GPS (AI services) and tools are properly configured
 */

import { validateScoutSetup, SCOUT_ENV_REQUIREMENTS } from './scout-agent-config';
import { scoutToolRegistry } from '../services/scoutToolRegistry';

export interface DeploymentValidation {
  environment: 'replit' | 'railway' | 'unknown';
  timestamp: Date;
  scoutSetup: ReturnType<typeof validateScoutSetup>;
  toolRegistry: ReturnType<typeof scoutToolRegistry.getGlobalStats>;
  environmentVariables: {
    configured: string[];
    missing: string[];
    warnings: string[];
  };
  overall: {
    isValid: boolean;
    readyForDeployment: boolean;
    criticalIssues: string[];
    recommendations: string[];
  };
}

export function detectEnvironment(): 'replit' | 'railway' | 'unknown' {
  // Check for Railway environment
  if (process.env.RAILWAY_ENVIRONMENT_NAME) {
    return 'railway';
  }

  // Check for Replit environment
  if (process.env.REPLIT_CLUSTER || process.env.REPLIT_OWNER) {
    return 'replit';
  }

  return 'unknown';
}

export function validateDeployment(): DeploymentValidation {
  const environment = detectEnvironment();
  const scoutSetup = validateScoutSetup();
  const toolStats = scoutToolRegistry.getGlobalStats();

  const configured: string[] = [];
  const missing: string[] = [];
  const warnings: string[] = [];

  // Check environment variables
  for (const req of SCOUT_ENV_REQUIREMENTS) {
    const value = process.env[req.key];
    if (value && value !== 'dummy-key-for-development') {
      configured.push(req.key);
    } else if (req.required) {
      missing.push(`${req.key} (required)`);
    } else {
      warnings.push(`${req.key} (optional, using default)`);
    }
  }

  const criticalIssues: string[] = [];
  const recommendations: string[] = [];

  // Combine setup errors
  if (!scoutSetup.valid) {
    criticalIssues.push(...scoutSetup.errors);
  }

  // Check tool availability
  const toolIssues = scoutSetup.errors.filter(e => e.includes('GEMINI_API_KEY'));
  if (toolIssues.length > 0) {
    criticalIssues.push('Scout tools cannot function without GEMINI_API_KEY');
  }

  // Add warnings
  warnings.push(...scoutSetup.warnings);

  // Generate recommendations
  if (environment === 'replit') {
    if (missing.length > 0) {
      recommendations.push('Set missing environment variables in Replit Secrets tab');
    }
  } else if (environment === 'railway') {
    if (missing.length > 0) {
      recommendations.push('Configure Railway project variables for: ' + missing.join(', '));
    }
    recommendations.push('Enable Railway health checks for graceful shutdown');
  }

  if (toolStats.availableTools < toolStats.totalTools) {
    recommendations.push(
      `Only ${toolStats.availableTools}/${toolStats.totalTools} tools available - check dependencies`
    );
  }

  if (toolStats.successRate < 95 && toolStats.totalToolsCalls > 10) {
    recommendations.push(
      `Tool success rate: ${toolStats.successRate.toFixed(1)}% - investigate failures`
    );
  }

  const readyForDeployment =
    scoutSetup.valid &&
    missing.length === 0 &&
    toolStats.availableTools >= toolStats.totalTools * 0.9;

  return {
    environment,
    timestamp: new Date(),
    scoutSetup,
    toolRegistry: toolStats,
    environmentVariables: {
      configured,
      missing,
      warnings,
    },
    overall: {
      isValid: criticalIssues.length === 0,
      readyForDeployment,
      criticalIssues,
      recommendations,
    },
  };
}

export function logDeploymentStatus(): void {
  const validation = validateDeployment();

  console.log('\n' + '='.repeat(60));
  console.log('🚀 SCOUT AGENT DEPLOYMENT VALIDATION');
  console.log('='.repeat(60));

  console.log(`\n🌍 Environment: ${validation.environment.toUpperCase()}`);
  console.log(`⏰ Timestamp: ${validation.timestamp.toISOString()}`);

  console.log('\n📦 AI SERVICES (GPS):');
  console.log(`  • Gemini 2.5 Flash: ${validation.scoutSetup.valid ? '✅' : '❌'}`);

  console.log('\n🔧 ENVIRONMENT VARIABLES:');
  console.log(`  ✅ Configured: ${validation.environmentVariables.configured.length}`);
  for (const env of validation.environmentVariables.configured) {
    console.log(`     • ${env}`);
  }

  if (validation.environmentVariables.missing.length > 0) {
    console.log(`  ❌ Missing: ${validation.environmentVariables.missing.length}`);
    for (const env of validation.environmentVariables.missing) {
      console.log(`     • ${env}`);
    }
  }

  if (validation.environmentVariables.warnings.length > 0) {
    console.log(`  ⚠️  Warnings: ${validation.environmentVariables.warnings.length}`);
    for (const warning of validation.environmentVariables.warnings) {
      console.log(`     • ${warning}`);
    }
  }

  console.log('\n🛠️  TOOLS REGISTRY:');
  console.log(
    `  • Available: ${validation.toolRegistry.availableTools}/${validation.toolRegistry.totalTools}`
  );
  console.log(`  • Total Calls: ${validation.toolRegistry.totalToolsCalls}`);
  console.log(
    `  • Success Rate: ${validation.toolRegistry.successRate.toFixed(1)}%`
  );

  if (validation.overall.criticalIssues.length > 0) {
    console.log('\n🚨 CRITICAL ISSUES:');
    for (const issue of validation.overall.criticalIssues) {
      console.log(`  • ${issue}`);
    }
  }

  if (validation.overall.recommendations.length > 0) {
    console.log('\n💡 RECOMMENDATIONS:');
    for (const rec of validation.overall.recommendations) {
      console.log(`  • ${rec}`);
    }
  }

  console.log('\n' + '='.repeat(60));
  console.log(
    `✅ DEPLOYMENT READY: ${validation.overall.readyForDeployment ? 'YES' : 'NO'}`
  );
  console.log(
    `🔒 VALID CONFIGURATION: ${validation.overall.isValid ? 'YES' : 'NO'}`
  );
  console.log('='.repeat(60) + '\n');
}

// Auto-validate on startup
export function initializeDeploymentValidation(): void {
  try {
    logDeploymentStatus();
  } catch (error: any) {
    console.error('[DEPLOYMENT-VALIDATION] Error during initialization:', error.message);
  }
}
