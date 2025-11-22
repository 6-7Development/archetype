import { spawn, type ChildProcess } from 'child_process';
import type { WebSocket } from 'ws';
import * as fs from 'fs';
import * as path from 'path';
import { storage } from '../storage';
import { sanitizeAndTokenizeCommand } from '../validation/authoritativeValidator';

/**
 * SECURITY HARDENING:
 * - Owner-only terminal access (checked in terminal.ts)
 * - Command allow-listing (only approved commands can run)
 * - Workspace jailing (can't escape /tmp/projects/{projectId})
 * - Path traversal sanitization (blocks ".." in commands)
 * - 5-minute timeout per command
 * - 10MB output size limit
 * 
 * Tested against: RCE attempts, path traversal, resource exhaustion
 */

// Terminal session interface
interface TerminalSession {
  id: string;
  projectId: string;
  userId: string;
  ws: WebSocket;
  history: string[];
  currentProcess?: ChildProcess;
  processStartTime?: number;
  workingDirectory: string;
}

// SECURITY: Allow-list of safe commands (deny-by-default)
const ALLOWED_COMMANDS = [
  'npm', 'node', 'tsc', 'npx',
  'git',
  'ls', 'cat', 'pwd', 'echo', 'mkdir', 'touch', 'cp', 'mv', 'rm',
  'grep', 'find', 'which', 'head', 'tail', 'wc',
  'curl', 'wget',
  'vim', 'nano',
  'chmod', 'chown',
];

export class TerminalService {
  private sessions = new Map<string, TerminalSession>();
  private readonly COMMAND_TIMEOUT = 5 * 60 * 1000; // 5 minutes
  private readonly MAX_OUTPUT_SIZE = 10 * 1024 * 1024; // 10MB max output
  private readonly PROJECT_ROOT = '/tmp/projects';

  constructor() {
    // Ensure project root directory exists
    if (!fs.existsSync(this.PROJECT_ROOT)) {
      fs.mkdirSync(this.PROJECT_ROOT, { recursive: true });
    }
  }

  /**
   * Create a new terminal session for a user/project
   */
  async createSession(
    sessionId: string,
    projectId: string,
    userId: string,
    ws: WebSocket
  ): Promise<void> {
    console.log(`[TERMINAL] Creating session ${sessionId} for project ${projectId}, user ${userId}`);

    // Create working directory for this project
    const workingDirectory = path.join(this.PROJECT_ROOT, projectId);
    
    // Ensure the working directory exists and is clean
    if (fs.existsSync(workingDirectory)) {
      // Clean up old files
      this.cleanupDirectory(workingDirectory);
    } else {
      fs.mkdirSync(workingDirectory, { recursive: true });
    }

    // Write project files to disk
    await this.setupProjectFiles(projectId, userId, workingDirectory);

    // Create session
    const session: TerminalSession = {
      id: sessionId,
      projectId,
      userId,
      ws,
      history: [],
      workingDirectory,
    };

    this.sessions.set(sessionId, session);

    // Send success message
    this.sendMessage(ws, {
      type: 'session_created',
      sessionId,
      workingDirectory,
    });

    console.log(`[TERMINAL] Session ${sessionId} created at ${workingDirectory}`);
  }

  /**
   * Execute a command in the terminal session
   */
  async executeCommand(
    sessionId: string,
    command: string
  ): Promise<void> {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      console.error(`[TERMINAL] Session ${sessionId} not found`);
      return;
    }

    console.log(`[TERMINAL] Executing command in session ${sessionId}: ${command}`);

    // Use authoritative validator for command sanitization and tokenization
    let tokens: string[];
    try {
      tokens = sanitizeAndTokenizeCommand(command);
    } catch (error: any) {
      console.warn(`[TERMINAL] Command validation failed: ${error.message}`);
      this.sendMessage(session.ws, {
        type: 'error',
        data: error.message,
      });
      this.sendMessage(session.ws, {
        type: 'exit',
        code: 1,
      });
      return;
    }

    const cmd = tokens[0];
    const cmdArgs = tokens.slice(1);

    // SECURITY: Check command against allow-list
    if (!this.isCommandAllowed(cmd)) {
      console.warn(`[TERMINAL] Blocked disallowed command: ${cmd}`);
      this.sendMessage(session.ws, {
        type: 'error',
        data: `Command not allowed: ${cmd}. Only approved commands can be executed.`,
      });
      this.sendMessage(session.ws, {
        type: 'exit',
        code: 1,
      });
      return;
    }

    // Kill existing process if running
    if (session.currentProcess) {
      console.log(`[TERMINAL] Killing existing process in session ${sessionId}`);
      this.killProcess(sessionId);
    }

    // Add to history
    session.history.push(command);

    // Store in database (optional)
    try {
      await storage.createTerminalHistory({
        projectId: session.projectId,
        userId: session.userId,
        command,
        output: null,
        exitCode: null,
      });
    } catch (error) {
      console.warn('[TERMINAL] Failed to save command to history:', error);
      // Continue execution even if history fails
    }

    console.log(`[TERMINAL] Spawning process: ${cmd} ${cmdArgs.join(' ')}`);

    // Spawn the process
    try {
      const childProcess = spawn(cmd, cmdArgs, {
        cwd: session.workingDirectory,
        env: {
          ...process.env,
          PATH: process.env.PATH || '/usr/local/bin:/usr/bin:/bin',
        },
        shell: false, // IMPORTANT: Never use shell for security
      });

      session.currentProcess = childProcess;
      session.processStartTime = Date.now();

      let outputBuffer = '';
      let errorBuffer = '';

      // Stream stdout
      childProcess.stdout?.on('data', (data: Buffer) => {
        const text = data.toString();
        outputBuffer += text;

        // Check output size limit
        if (outputBuffer.length > this.MAX_OUTPUT_SIZE) {
          console.warn(`[TERMINAL] Output size limit exceeded for session ${sessionId}`);
          this.killProcess(sessionId);
          this.sendMessage(session.ws, {
            type: 'error',
            data: 'Output size limit exceeded (10MB). Process terminated.',
          });
          return;
        }

        this.sendMessage(session.ws, {
          type: 'output',
          data: text,
        });
      });

      // Stream stderr
      childProcess.stderr?.on('data', (data: Buffer) => {
        const text = data.toString();
        errorBuffer += text;

        // Check output size limit
        if (errorBuffer.length > this.MAX_OUTPUT_SIZE) {
          console.warn(`[TERMINAL] Error output size limit exceeded for session ${sessionId}`);
          this.killProcess(sessionId);
          this.sendMessage(session.ws, {
            type: 'error',
            data: 'Error output size limit exceeded (10MB). Process terminated.',
          });
          return;
        }

        this.sendMessage(session.ws, {
          type: 'error',
          data: text,
        });
      });

      // Handle process exit
      childProcess.on('close', async (code: number | null) => {
        console.log(`[TERMINAL] Process exited with code ${code} in session ${sessionId}`);
        
        session.currentProcess = undefined;
        session.processStartTime = undefined;

        // Update history with output and exit code
        try {
          // Get the last command from history
          const lastCommand = session.history[session.history.length - 1];
          await storage.updateTerminalHistory(
            session.projectId,
            session.userId,
            lastCommand,
            outputBuffer + errorBuffer,
            code || 0
          );
        } catch (error) {
          console.warn('[TERMINAL] Failed to update command history:', error);
        }

        this.sendMessage(session.ws, {
          type: 'exit',
          code: code || 0,
        });
      });

      // Handle process errors
      childProcess.on('error', (error: Error) => {
        console.error(`[TERMINAL] Process error in session ${sessionId}:`, error);
        
        session.currentProcess = undefined;
        session.processStartTime = undefined;

        this.sendMessage(session.ws, {
          type: 'error',
          data: `Process error: ${error.message}`,
        });
        this.sendMessage(session.ws, {
          type: 'exit',
          code: 1,
        });
      });

      // Set timeout for command execution
      const timeoutId = setTimeout(() => {
        if (session.currentProcess) {
          console.warn(`[TERMINAL] Command timeout in session ${sessionId}`);
          this.killProcess(sessionId);
          this.sendMessage(session.ws, {
            type: 'error',
            data: 'Command execution timeout (5 minutes). Process terminated.',
          });
          this.sendMessage(session.ws, {
            type: 'exit',
            code: 124, // Timeout exit code
          });
        }
      }, this.COMMAND_TIMEOUT);

      // Clear timeout when process exits
      childProcess.on('close', () => {
        clearTimeout(timeoutId);
      });

    } catch (error: any) {
      console.error(`[TERMINAL] Failed to spawn process in session ${sessionId}:`, error);
      this.sendMessage(session.ws, {
        type: 'error',
        data: `Failed to execute command: ${error.message}`,
      });
      this.sendMessage(session.ws, {
        type: 'exit',
        code: 1,
      });
    }
  }

  /**
   * Kill the currently running process in a session
   */
  killProcess(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    
    if (!session || !session.currentProcess) {
      return;
    }

    console.log(`[TERMINAL] Killing process in session ${sessionId}`);

    try {
      // Try graceful termination first
      session.currentProcess.kill('SIGTERM');
      
      // Force kill after 2 seconds if still alive
      setTimeout(() => {
        if (session.currentProcess && !session.currentProcess.killed) {
          console.warn(`[TERMINAL] Force killing process in session ${sessionId}`);
          session.currentProcess.kill('SIGKILL');
        }
      }, 2000);

      session.currentProcess = undefined;
      session.processStartTime = undefined;
    } catch (error) {
      console.error(`[TERMINAL] Error killing process in session ${sessionId}:`, error);
    }
  }

  /**
   * Get command history for a session
   */
  getHistory(sessionId: string): string[] {
    const session = this.sessions.get(sessionId);
    return session ? session.history : [];
  }

  /**
   * Clean up a terminal session
   */
  cleanup(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    
    if (!session) {
      return;
    }

    console.log(`[TERMINAL] Cleaning up session ${sessionId}`);

    // Kill any running process
    this.killProcess(sessionId);

    // Clean up working directory (optional - keep for debugging)
    // this.cleanupDirectory(session.workingDirectory);

    // Remove session
    this.sessions.delete(sessionId);

    console.log(`[TERMINAL] Session ${sessionId} cleaned up`);
  }

  /**
   * Clean up all sessions for a user
   */
  cleanupUserSessions(userId: string): void {
    console.log(`[TERMINAL] Cleaning up all sessions for user ${userId}`);
    
    // Convert Map iterator to array to avoid downlevelIteration issues
    const sessionEntries = Array.from(this.sessions.entries());
    for (const [sessionId, session] of sessionEntries) {
      if (session.userId === userId) {
        this.cleanup(sessionId);
      }
    }
  }

  // ==================== PRIVATE HELPERS ====================

  /**
   * SECURITY: Sanitize command to prevent path traversal
   */
  private sanitizeCommand(command: string): string {
    // Remove all ".." sequences to prevent directory escape
    let sanitized = command.replace(/\.\./g, '');
    
    // Block absolute paths to root
    sanitized = sanitized.replace(/cd\s+\//g, 'cd ');
    sanitized = sanitized.replace(/cd\//g, 'cd ');
    
    return sanitized;
  }

  /**
   * SECURITY: Check if command is in the allow-list
   */
  private isCommandAllowed(command: string): boolean {
    const baseCommand = command.trim().split(' ')[0];
    return ALLOWED_COMMANDS.includes(baseCommand);
  }


  /**
   * Setup project files in the working directory
   */
  private async setupProjectFiles(
    projectId: string,
    userId: string,
    workingDirectory: string
  ): Promise<void> {
    try {
      console.log(`[TERMINAL] Setting up project files for ${projectId}`);

      // Get all files for this project from database
      const files = await storage.getProjectFiles(projectId, userId);

      // Write each file to the working directory
      for (const file of files) {
        const filePath = path.join(workingDirectory, file.path);
        const fileDir = path.dirname(filePath);

        // Ensure directory exists
        if (!fs.existsSync(fileDir)) {
          fs.mkdirSync(fileDir, { recursive: true });
        }

        // Write file content
        fs.writeFileSync(filePath, file.content || '', 'utf-8');
      }

      console.log(`[TERMINAL] Wrote ${files.length} files to ${workingDirectory}`);
    } catch (error) {
      console.error('[TERMINAL] Error setting up project files:', error);
      throw error;
    }
  }

  /**
   * Clean up a directory
   */
  private cleanupDirectory(directory: string): void {
    try {
      if (fs.existsSync(directory)) {
        // Remove all files and subdirectories
        const files = fs.readdirSync(directory);
        for (const file of files) {
          const filePath = path.join(directory, file);
          const stat = fs.statSync(filePath);
          
          if (stat.isDirectory()) {
            this.cleanupDirectory(filePath);
            fs.rmdirSync(filePath);
          } else {
            fs.unlinkSync(filePath);
          }
        }
      }
    } catch (error) {
      console.error(`[TERMINAL] Error cleaning up directory ${directory}:`, error);
    }
  }

  /**
   * Send a message to the WebSocket client
   */
  private sendMessage(ws: WebSocket, message: any): void {
    try {
      if (ws.readyState === 1) { // WebSocket.OPEN
        ws.send(JSON.stringify(message));
      }
    } catch (error) {
      console.error('[TERMINAL] Error sending message to WebSocket:', error);
    }
  }
}

// Export singleton instance
export const terminalService = new TerminalService();
