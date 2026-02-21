// ============================================================================
// useTheme Hook - Theme management (dark/light)
// ============================================================================

import { useEffect } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';

export function useTheme() {
  const { darkMode, toggleDarkMode, setDarkMode } = useDashboardStore();

  // Sync classes whenever state changes (guard against external mutations)
  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  function cycleTheme() {
    toggleDarkMode();
  }

  return { darkMode, toggleDarkMode, setDarkMode, cycleTheme };
}
