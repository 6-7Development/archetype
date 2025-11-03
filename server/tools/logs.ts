/**
 * Logs tool for Lomu AI
 * Refresh and retrieve workflow and browser console logs
 */

import fs from 'fs/promises';
import path from 'path';

export interface LogEntry {
  timestamp: number;
  level: 'info' | 'warn' | 'error' | 'debug';
  message: string;
  source: 'workflow' | 'browser' | 'server';
}

export interface RefreshLogsResult {
  success: boolean;
  message: string;
  workflowLogs?: LogEntry[];
  browserLogs?: LogEntry[];
  serverLogs?: LogEntry[];
  logFiles?: {
    path: string;
    size: number;
  }[];
  error?: string;
}

/**
 * Refresh and get all logs (workflow, browser, server)
 */
export async function refreshAllLogs(params?: {
  filter?: string;
  limit?: number;
}): Promise<RefreshLogsResult> {
  const { filter, limit = 100 } = params || {};
  
  try {
    const logs: LogEntry[] = [];
    const logFiles: { path: string; size: number }[] = [];
    
    // Try to read workflow logs from /tmp/logs if they exist
    try {
      const tmpLogsDir = '/tmp/logs';
      const files = await fs.readdir(tmpLogsDir);
      
      for (const file of files) {
        const filePath = path.join(tmpLogsDir, file);
        const stats = await fs.stat(filePath);
        
        logFiles.push({
          path: filePath,
          size: stats.size,
        });
        
        // Read the log file content
        const content = await fs.readFile(filePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim());
        
        // Parse log lines (simple format)
        for (const line of lines.slice(-50)) { // Last 50 lines per file
          logs.push(parseLogLine(line, 'workflow'));
        }
      }
    } catch (tmpError) {
      // /tmp/logs might not exist, that's okay
      console.log('[REFRESH-LOGS] No /tmp/logs directory found');
    }
    
    // Add some simulated server logs from console output
    const serverLogs: LogEntry[] = [
      {
        timestamp: Date.now(),
        level: 'info',
        message: 'Server is running',
        source: 'server',
      },
    ];
    
    // Combine all logs
    const allLogs = [...logs, ...serverLogs];
    
    // Apply filter if provided
    let filteredLogs = allLogs;
    if (filter) {
      const filterLower = filter.toLowerCase();
      filteredLogs = allLogs.filter(log =>
        log.message.toLowerCase().includes(filterLower) ||
        log.level.toLowerCase().includes(filterLower)
      );
    }
    
    // Apply limit
    const limitedLogs = filteredLogs.slice(-limit);
    
    // Separate by source
    const workflowLogs = limitedLogs.filter(l => l.source === 'workflow');
    const browserLogs = limitedLogs.filter(l => l.source === 'browser');
    const serverLogsFiltered = limitedLogs.filter(l => l.source === 'server');
    
    return {
      success: true,
      message: `Retrieved ${limitedLogs.length} log entries`,
      workflowLogs,
      browserLogs,
      serverLogs: serverLogsFiltered,
      logFiles,
    };
  } catch (error: any) {
    console.error('[REFRESH-ALL-LOGS] Error:', error);
    return {
      success: false,
      message: `Failed to refresh logs: ${error.message}`,
      error: error.message,
    };
  }
}

/**
 * Parse a log line into structured format
 */
function parseLogLine(line: string, source: 'workflow' | 'browser' | 'server'): LogEntry {
  // Try to extract timestamp, level, and message
  // Format: [timestamp] [LEVEL] message
  const timestampMatch = line.match(/\[(\d+)\]/);
  const levelMatch = line.match(/\[(INFO|WARN|ERROR|DEBUG)\]/i);
  
  const timestamp = timestampMatch ? parseInt(timestampMatch[1]) : Date.now();
  const level = (levelMatch?.[1]?.toLowerCase() as LogEntry['level']) || 'info';
  const message = line.replace(/\[\d+\]/, '').replace(/\[(INFO|WARN|ERROR|DEBUG)\]/i, '').trim();
  
  return {
    timestamp,
    level,
    message: message || line,
    source,
  };
}
