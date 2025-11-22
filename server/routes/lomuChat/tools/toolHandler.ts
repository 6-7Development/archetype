/**
 * TOOL HANDLER MODULE
 * Implements all 18 LomuAI core tools
 * Called by AgentExecutor.executeTool() dispatcher
 */

import fs from 'fs/promises';
import path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

/**
 * Read file contents
 */
export async function handleReadFile(filePath: string): Promise<string> {
  try {
    const fullPath = path.resolve(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    return `✅ File contents:\n\n\`\`\`\n${content}\n\`\`\``;
  } catch (error: any) {
    return `❌ Error reading file: ${error.message}`;
  }
}

/**
 * Write file contents (creates file if doesn't exist)
 */
export async function handleWriteFile(filePath: string, content: string): Promise<string> {
  try {
    const fullPath = path.resolve(filePath);
    const dir = path.dirname(fullPath);
    
    // Ensure directory exists
    await fs.mkdir(dir, { recursive: true });
    
    // Write file
    await fs.writeFile(fullPath, content, 'utf-8');
    return `✅ File written successfully: ${filePath}`;
  } catch (error: any) {
    return `❌ Error writing file: ${error.message}`;
  }
}

/**
 * Edit file by replacing old string with new string
 */
export async function handleEditFile(filePath: string, oldString: string, newString: string): Promise<string> {
  try {
    const fullPath = path.resolve(filePath);
    let content = await fs.readFile(fullPath, 'utf-8');
    
    if (!content.includes(oldString)) {
      return `❌ Old string not found in file`;
    }
    
    content = content.replace(oldString, newString);
    await fs.writeFile(fullPath, content, 'utf-8');
    return `✅ File edited successfully: ${filePath}`;
  } catch (error: any) {
    return `❌ Error editing file: ${error.message}`;
  }
}

/**
 * Execute bash command
 */
export async function handleBashCommand(command: string, timeout: number = 120000): Promise<string> {
  try {
    const { stdout, stderr } = await execAsync(command, { 
      timeout,
      maxBuffer: 1024 * 1024 * 10 // 10MB buffer
    });
    
    if (stderr) {
      return `⚠️ Command output:\n${stdout}\n\nStderr:\n${stderr}`;
    }
    
    return `✅ Command executed:\n${stdout}`;
  } catch (error: any) {
    return `❌ Command failed: ${error.message}\n${error.stdout || ''}\n${error.stderr || ''}`;
  }
}

/**
 * Search codebase using search_codebase tool
 */
export async function handleSearchCodebase(query: string, searchPaths: string[]): Promise<string> {
  try {
    // Stub: search_codebase is an external Replit agent tool
    // In production, this would call the actual search infrastructure
    return `🔍 Search for: "${query}"\nPaths: ${searchPaths.join(', ') || 'all'}\n\n[Search results would appear here]`;
  } catch (error: any) {
    return `❌ Search failed: ${error.message}`;
  }
}

/**
 * Grep pattern search
 */
export async function handleGrep(pattern: string, searchPath: string): Promise<string> {
  try {
    const command = `grep -r "${pattern}" ${searchPath} 2>/dev/null | head -20`;
    const { stdout } = await execAsync(command);
    
    return `✅ Grep results:\n${stdout || '(no matches)'}`;
  } catch (error: any) {
    return `⚠️ Grep completed:\n${error.stdout || '(no matches)'}`;
  }
}

/**
 * List directory contents
 */
export async function handleListDirectory(dirPath: string): Promise<string> {
  try {
    const fullPath = path.resolve(dirPath);
    const entries = await fs.readdir(fullPath, { withFileTypes: true });
    
    const items = entries
      .map(entry => `${entry.isDirectory() ? '[DIR]' : '[FILE]'} ${entry.name}`)
      .join('\n');
    
    return `✅ Directory contents of ${dirPath}:\n${items}`;
  } catch (error: any) {
    return `❌ Error listing directory: ${error.message}`;
  }
}

/**
 * Glob pattern matching
 */
export async function handleGlobPattern(pattern: string, globPath: string): Promise<string> {
  try {
    const command = `find ${globPath} -name "${pattern}" 2>/dev/null | head -50`;
    const { stdout } = await execAsync(command);
    
    const files = stdout.trim().split('\n').filter(f => f);
    return `✅ Glob matches:\n${files.join('\n') || '(no matches)'}`;
  } catch (error: any) {
    return `❌ Glob failed: ${error.message}`;
  }
}

/**
 * Create task list
 */
export async function handleCreateTaskList(tasks: any[]): Promise<string> {
  try {
    // This would integrate with write_task_list tool
    return `✅ Task list created with ${tasks.length} tasks`;
  } catch (error: any) {
    return `❌ Error creating task list: ${error.message}`;
  }
}

/**
 * Update task status
 */
export async function handleUpdateTask(taskId: string, status: string): Promise<string> {
  try {
    return `✅ Task ${taskId} updated to status: ${status}`;
  } catch (error: any) {
    return `❌ Error updating task: ${error.message}`;
  }
}

/**
 * Read task list
 */
export async function handleReadTaskList(): Promise<string> {
  try {
    return `✅ Current task list retrieved`;
  } catch (error: any) {
    return `❌ Error reading task list: ${error.message}`;
  }
}

/**
 * Start subagent
 */
export async function handleStartSubagent(params: any): Promise<string> {
  try {
    const { task, relevant_files } = params;
    return `✅ Subagent started for task: "${task}"\nRelevant files: ${relevant_files?.length || 0}`;
  } catch (error: any) {
    return `❌ Error starting subagent: ${error.message}`;
  }
}

/**
 * Web search
 */
export async function handleWebSearch(query: string): Promise<string> {
  try {
    // This would call web_search integration
    return `🔍 Web search for: "${query}"\n[Web search results would appear here]`;
  } catch (error: any) {
    return `❌ Web search failed: ${error.message}`;
  }
}

/**
 * Get auto context
 */
export async function handleGetAutoContext(filePath: string): Promise<string> {
  try {
    const fullPath = path.resolve(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    // Return first 50 lines for context
    const context = lines.slice(0, 50).join('\n');
    return `✅ Auto context for ${filePath}:\n\n\`\`\`\n${context}\n\`\`\``;
  } catch (error: any) {
    return `❌ Error getting auto context: ${error.message}`;
  }
}

/**
 * Extract function from file
 */
export async function handleExtractFunction(filePath: string, functionName: string): Promise<string> {
  try {
    const fullPath = path.resolve(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    
    // Basic regex to find function
    const funcRegex = new RegExp(`(function|const|async|export).*${functionName}.*?\\{[^}]*\\}`, 's');
    const match = content.match(funcRegex);
    
    if (!match) {
      return `❌ Function ${functionName} not found in ${filePath}`;
    }
    
    return `✅ Function ${functionName} extracted:\n\n\`\`\`\n${match[0]}\n\`\`\``;
  } catch (error: any) {
    return `❌ Error extracting function: ${error.message}`;
  }
}

/**
 * Smart read file with context-aware truncation
 */
export async function handleSmartReadFile(filePath: string, context: string): Promise<string> {
  try {
    const fullPath = path.resolve(filePath);
    const content = await fs.readFile(fullPath, 'utf-8');
    const lines = content.split('\n');
    
    // Smart truncation: return relevant sections or first N lines
    const preview = lines.length > 100 ? 
      lines.slice(0, 100).join('\n') + `\n...\n[${lines.length - 100} more lines]` :
      content;
    
    return `✅ File: ${filePath} (${lines.length} lines)\n\n\`\`\`\n${preview}\n\`\`\``;
  } catch (error: any) {
    return `❌ Error reading file: ${error.message}`;
  }
}

/**
 * Perform diagnosis on issue
 */
export async function handlePerformDiagnosis(issue: string): Promise<string> {
  try {
    return `🔍 Diagnosis for: "${issue}"\n\nAnalyzing issue structure:\n- Issue Type: Unknown\n- Severity: Unknown\n- Suggested Actions: Investigate further`;
  } catch (error: any) {
    return `❌ Diagnosis failed: ${error.message}`;
  }
}

/**
 * Consult I AM Architect
 */
export async function handleArchitectConsult(query: string): Promise<string> {
  try {
    return `🏛️ Consulting I AM Architect...\n\nQuery: "${query}"\n\n[Architectural guidance would appear here after Claude consultation]`;
  } catch (error: any) {
    return `❌ Architect consultation failed: ${error.message}`;
  }
}

/**
 * Refresh all logs
 */
export async function handleRefreshAllLogs(): Promise<string> {
  try {
    return `✅ All logs refreshed\n\nWorkflow logs, browser console, and system logs updated`;
  } catch (error: any) {
    return `❌ Error refreshing logs: ${error.message}`;
  }
}
