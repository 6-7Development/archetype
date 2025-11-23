/**
 * ✅ Centralized Deployment Status Enums
 * Prevents mismatches between WebSocket (in_progress/successful) and system (running/completed)
 */

// Status values from WebSocket deployment events
export const WEBSOCKET_DEPLOYMENT_STATUS = {
  IN_PROGRESS: 'in_progress',
  SUCCESSFUL: 'successful',
  FAILED: 'failed',
} as const;

export type WebSocketDeploymentStatus = typeof WEBSOCKET_DEPLOYMENT_STATUS[keyof typeof WEBSOCKET_DEPLOYMENT_STATUS];

// Status values for system database and UI
export const SYSTEM_DEPLOYMENT_STATUS = {
  PENDING: 'pending',
  RUNNING: 'running',
  COMPLETED: 'completed',
  FAILED: 'failed',
} as const;

export type SystemDeploymentStatus = typeof SYSTEM_DEPLOYMENT_STATUS[keyof typeof SYSTEM_DEPLOYMENT_STATUS];

// Conversion helper: WebSocket → System
export function convertDeploymentStatus(status: WebSocketDeploymentStatus): SystemDeploymentStatus {
  switch (status) {
    case 'in_progress':
      return 'running';
    case 'successful':
      return 'completed';
    case 'failed':
      return 'failed';
    default:
      return 'pending';
  }
}

// Conversion helper: Step status mapping
export function convertStepStatus(
  status: string | 'pending' | 'in_progress' | 'complete' | 'failed' | 'running' | 'completed'
): SystemDeploymentStatus {
  const statusMap: Record<string, SystemDeploymentStatus> = {
    'pending': 'pending',
    'in_progress': 'running',
    'complete': 'completed',
    'completed': 'completed',
    'running': 'running',
    'failed': 'failed',
  };
  return statusMap[status] || 'pending';
}
