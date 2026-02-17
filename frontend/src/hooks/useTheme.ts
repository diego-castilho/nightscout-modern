// ============================================================================
// useTheme Hook - Dark mode management
// ============================================================================

import { useEffect } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';

export function useTheme() {
  const { darkMode, toggleDarkMode } = useDashboardStore();

  // Sync class on mount and when darkMode changes
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return { darkMode, toggleDarkMode };
}
