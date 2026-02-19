// ============================================================================
// useTheme Hook - Theme management (dark/light × default/dracula)
// ============================================================================

import { useEffect } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';

export function useTheme() {
  const { darkMode, colorTheme, toggleDarkMode, setDarkMode, setColorTheme } = useDashboardStore();

  // Sync classes whenever state changes (guard against external mutations)
  useEffect(() => {
    const html = document.documentElement;
    darkMode          ? html.classList.add('dark')    : html.classList.remove('dark');
    colorTheme === 'dracula' ? html.classList.add('dracula') : html.classList.remove('dracula');
  }, [darkMode, colorTheme]);

  // Cycles: default/light → default/dark → dracula/light → dracula/dark → default/light
  function cycleTheme() {
    if (colorTheme === 'default' && !darkMode) {
      setDarkMode(true);                            // → default/dark
    } else if (colorTheme === 'default' && darkMode) {
      setDarkMode(false);
      setColorTheme('dracula');                     // → dracula/light
    } else if (colorTheme === 'dracula' && !darkMode) {
      setDarkMode(true);                            // → dracula/dark
    } else {
      setDarkMode(false);
      setColorTheme('default');                     // → default/light
    }
  }

  return { darkMode, colorTheme, toggleDarkMode, setDarkMode, setColorTheme, cycleTheme };
}
