/**
 * Centralized API utilities - all endpoints from config
 * No more hard-coded API URLs scattered throughout components
 */

import { APP_CONFIG } from '@/config/app.config';

export const API_ENDPOINTS = {
  // Chat endpoints
  CHAT_MESSAGE: APP_CONFIG.api.endpoints.chat,
  CHAT_SESSION: `${APP_CONFIG.api.endpoints.chat}/session`,

  // Platform health
  PLATFORM_HEALTH: APP_CONFIG.api.endpoints.health,
  INCIDENTS: APP_CONFIG.api.endpoints.incidents,
  JOBS: APP_CONFIG.api.endpoints.jobs,
  HEALING_START: APP_CONFIG.api.endpoints.healing,

  // Commands
  COMMANDS: APP_CONFIG.api.endpoints.commands,
  COMMANDS_STREAM: `${APP_CONFIG.api.endpoints.commands}/stream`,

  // Projects
  PROJECTS: APP_CONFIG.api.endpoints.projects,
  PROJECT_UPLOAD: '/api/import/zip',
  PROJECT_IMPORT: '/api/import/zip',

  // Auth
  AUTH_LOGIN: APP_CONFIG.api.endpoints.auth.login,
  AUTH_LOGOUT: APP_CONFIG.api.endpoints.auth.logout,
  AUTH_REGISTER: APP_CONFIG.api.endpoints.auth.register,
  AUTH_ME: '/api/auth/me',

  // Deployments
  DEPLOYMENTS: '/api/deployments',
  DEPLOYMENT_INFO: '/api/deployment-info',
  DEPLOYMENT_LOGS: '/api/logs',

  // User
  USER: APP_CONFIG.api.endpoints.user,

  // Chat specific
  CHAT_UPLOAD_IMAGE: '/api/chat/upload-image',
  CHAT_SESSION: '/api/chat/session',

  // Templates
  TEMPLATES: '/api/templates',
  TEMPLATE_INSTANTIATE: (templateId: string) => `/api/templates/${templateId}/instantiate`,
  TEMPLATE_REVIEWS: (templateId: string) => `/api/templates/${templateId}/reviews`,

  // Git
  GIT_COMMIT: '/api/git/commit',

  // Healing
  HEALING: APP_CONFIG.api.endpoints.healing,
} as const;

/**
 * Build a full API URL
 */
export function buildApiUrl(endpoint: string): string {
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    return endpoint;
  }
  const base = APP_CONFIG.api.baseURL;
  return endpoint.startsWith('/') ? `${base}${endpoint}` : `${base}/${endpoint}`;
}

/**
 * Fetch with config-aware URL building
 */
export async function fetchApi<T = any>(
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const url = buildApiUrl(endpoint);
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.json();
}

/**
 * POST request with config-aware URL
 */
export async function postApi<T = any>(
  endpoint: string,
  data?: any,
  options?: RequestInit
): Promise<T> {
  return fetchApi(endpoint, {
    method: 'POST',
    body: data ? JSON.stringify(data) : undefined,
    ...options,
  });
}

/**
 * Stream API response
 */
export async function streamApi(
  endpoint: string,
  options?: RequestInit
): Promise<ReadableStream<Uint8Array>> {
  const url = buildApiUrl(endpoint);
  const response = await fetch(url, {
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers,
    },
    ...options,
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${response.statusText}`);
  }

  return response.body!;
}

/**
 * Query key builder - prevents hard-coded query keys
 */
export function getQueryKey(endpoint: string, ...params: any[]): (string | any)[] {
  return [endpoint, ...params];
}
