// ============================================================================
// useTheme Hook - Theme management (dark/light)
// ============================================================================

import { useEffect } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';

export function useTheme() {
  const { darkMode, toggleDarkMode, setDarkMode } = useDashboardStore();

  // Sync classes whenever state changes (guard against external mutations)
  useEffect(() => {
    darkMode ? document.documentElement.classList.add('dark') : document.documentElement.classList.remove('dark');
  }, [darkMode]);

  function cycleTheme() {
    toggleDarkMode();
  }

  return { darkMode, toggleDarkMode, setDarkMode, cycleTheme };
}
