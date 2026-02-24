export const colors = {
  primary: '#7c3aed',
  primaryLight: '#a78bfa',
  primaryDark: '#5b21b6',
  background: '#f4f2ff',
  surface: '#ffffff',
  text: '#1e1b4b',
  textMuted: '#6b7280',
  border: '#e5e7eb',
  // Status colours
  statusInitial: '#6b7280',
  statusInProgress: '#3b82f6',
  statusAwaiting: '#f59e0b',
  statusSuccess: '#10b981',
  statusError: '#ef4444',
  // AI confidence colours
  confidenceHigh: '#10b981',
  confidenceMedium: '#f59e0b',
  confidenceLow: '#ef4444',
} as const;

export type ColorKey = keyof typeof colors;
