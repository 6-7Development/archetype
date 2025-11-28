/**
 * Environment Variables Tools - Manage deployment environment variables
 * 
 * These tools allow Hexad to set, get, and delete environment variables
 * that persist across deployments (Render, Railway, etc.)
 * 
 * Uses project-level projectEnvVars table for reliable variable management
 */

import { db } from '../db';
import { projectEnvVars, insertProjectEnvVarSchema } from '@shared/schema';
import { eq, and } from 'drizzle-orm';

/**
 * Set environment variable for a project's deployments
 * This will be used in all future deployments
 */
export async function setEnvVar(params: {
  projectId: string;
  key: string;
  value: string;
  description?: string;
}): Promise<string> {
  try {
    const { projectId, key, value, description } = params;
    
    if (!key || !value) {
      return '❌ Both key and value are required';
    }
    
    // Validate key format (alphanumeric + underscore, starting with letter)
    if (!/^[A-Z_][A-Z0-9_]*$/.test(key)) {
      return `❌ Invalid environment variable name: ${key}
      
Environment variable names must:
- Start with a letter or underscore
- Contain only uppercase letters, numbers, and underscores
- Example: DATABASE_URL, API_KEY, STRIPE_SECRET_KEY`;
    }
    
    // Check if this key already exists for this project
    const existing = await db
      .select()
      .from(projectEnvVars)
      .where(and(
        eq(projectEnvVars.projectId, projectId),
        eq(projectEnvVars.key, key)
      ))
      .limit(1);
    
    if (existing.length > 0) {
      // Update existing variable
      await db
        .update(projectEnvVars)
        .set({
          value,
          description: description || existing[0].description,
          updatedAt: new Date(),
        })
        .where(eq(projectEnvVars.id, existing[0].id));
      
      return `✅ Environment variable updated successfully!

Variable: ${key}
Value: ${value.substring(0, 20)}${value.length > 20 ? '...' : ''}
${description ? `Description: ${description}` : ''}

This variable will be available in your deployed application.
Access it with: process.env.${key}`;
    } else {
      // Create new variable
      await db.insert(projectEnvVars).values({
        projectId,
        key,
        value,
        description,
      });
      
      return `✅ Environment variable set successfully!

Variable: ${key}
Value: ${value.substring(0, 20)}${value.length > 20 ? '...' : ''}
${description ? `Description: ${description}` : ''}

This variable will be available in your deployed application.
Access it with: process.env.${key}`;
    }
  } catch (error: any) {
    return `❌ Failed to set environment variable: ${error.message}`;
  }
}

/**
 * Get all environment variables for a project
 */
export async function getEnvVars(params: {
  projectId: string;
}): Promise<string> {
  try {
    const { projectId } = params;
    
    // Get all env vars for this project
    const vars = await db
      .select()
      .from(projectEnvVars)
      .where(eq(projectEnvVars.projectId, projectId));
    
    if (vars.length === 0) {
      return `No environment variables set for this project.

Use set_env_var to add environment variables for your deployment.`;
    }
    
    const varList = vars.map(v => {
      // Mask sensitive values (show first/last 4 chars if long enough)
      const maskedValue = v.value.length > 8 
        ? `${v.value.substring(0, 4)}...${v.value.substring(v.value.length - 4)}`
        : '***';
      
      const desc = v.description ? ` - ${v.description}` : '';
      return `  ${v.key} = ${maskedValue}${desc}`;
    }).join('\n');
    
    return `Environment Variables (${vars.length} total):

${varList}

These variables are available in your deployed application via process.env.*`;
  } catch (error: any) {
    return `❌ Failed to get environment variables: ${error.message}`;
  }
}

/**
 * Delete an environment variable
 */
export async function deleteEnvVar(params: {
  projectId: string;
  key: string;
}): Promise<string> {
  try {
    const { projectId, key } = params;
    
    if (!key) {
      return '❌ Key is required';
    }
    
    // Find and delete the variable
    const result = await db
      .delete(projectEnvVars)
      .where(and(
        eq(projectEnvVars.projectId, projectId),
        eq(projectEnvVars.key, key)
      ))
      .returning();
    
    if (result.length === 0) {
      return `❌ Environment variable '${key}' not found`;
    }
    
    // Count remaining variables
    const remaining = await db
      .select()
      .from(projectEnvVars)
      .where(eq(projectEnvVars.projectId, projectId));
    
    return `✅ Environment variable '${key}' deleted successfully!

Remaining variables: ${remaining.length}`;
  } catch (error: any) {
    return `❌ Failed to delete environment variable: ${error.message}`;
  }
}

/**
 * List common environment variable templates
 */
export async function getEnvVarTemplates(): Promise<string> {
  const templates = {
    'Database': [
      'DATABASE_URL - PostgreSQL connection string',
      'DB_HOST - Database host',
      'DB_PORT - Database port (default: 5432)',
      'DB_NAME - Database name',
      'DB_USER - Database username',
      'DB_PASSWORD - Database password',
    ],
    'Authentication': [
      'JWT_SECRET - Secret key for JWT tokens',
      'SESSION_SECRET - Session encryption key',
      'AUTH_REDIRECT_URL - OAuth redirect URL',
    ],
    'API Keys': [
      'OPENAI_API_KEY - OpenAI API key',
      'ANTHROPIC_API_KEY - Anthropic Claude API key',
      'STRIPE_SECRET_KEY - Stripe secret key',
      'STRIPE_PUBLISHABLE_KEY - Stripe publishable key',
      'SENDGRID_API_KEY - SendGrid email API key',
    ],
    'Application': [
      'NODE_ENV - Environment (production, development)',
      'PORT - Server port (default: 3000)',
      'API_URL - Base API URL',
      'FRONTEND_URL - Frontend URL',
    ],
  };
  
  let output = 'Common Environment Variable Templates:\n\n';
  
  for (const [category, vars] of Object.entries(templates)) {
    output += `${category}:\n`;
    vars.forEach(v => output += `  • ${v}\n`);
    output += '\n';
  }
  
  output += 'Use set_env_var to add any of these to your project.';
  
  return output;
}
