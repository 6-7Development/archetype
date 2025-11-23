/**
 * Workspace Layout Defaults
 * Configure default behavior for the workspace layout across the app
 */

export const WORKSPACE_DEFAULTS = {
  // Default tab to show when workspace loads
  defaultTab: 'editor' as const,

  // Default panel widths
  leftPanelWidth: 288, // w-72 = 18rem = 288px
  minimumLeftPanelWidth: 240,
  maximumLeftPanelWidth: 500,

  // Default visibility
  showLeftPanel: true,
  showPreview: true,
  showConsole: true,

  // Status colors
  statusColors: {
    pending: 'bg-yellow-500',
    in_progress: 'bg-blue-500',
    completed: 'bg-green-500',
  },

  // Task list settings
  maxVisibleTasks: 10,
  maxActivityLogItems: 5,
  expandActivityLogOnHover: true,

  // Editor settings
  editorFontSize: 13,
  editorFontFamily: 'JetBrains Mono',
  editorTheme: 'vs-dark',
  enableMinimap: false,
  enableWordWrap: true,

  // Console settings
  maxConsoleLines: 500,
  consoleAutoScroll: true,

  // Performance
  debounceEditorSave: 2000, // milliseconds
  taskRefreshInterval: 5000, // milliseconds

  // Accessibility
  enableKeyboardShortcuts: true,
  focusModeHotkey: 'Cmd+Shift+F', // or Ctrl+Shift+F on Windows
  toggleSidebarHotkey: 'Cmd+B', // or Ctrl+B on Windows
};

/**
 * Get workspace defaults merged with user overrides
 */
export function getWorkspaceDefaults(overrides?: Partial<typeof WORKSPACE_DEFAULTS>) {
  return {
    ...WORKSPACE_DEFAULTS,
    ...overrides,
  };
}
