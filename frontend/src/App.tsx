// ============================================================================
// App - Layout root with routing
// ============================================================================

import { useEffect } from 'react';
import { Routes, Route } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import { useGlucoseData } from './hooks/useGlucoseData';
import { useDashboardStore } from './stores/dashboardStore';
import { getSettings } from './lib/api';

import { Header } from './components/layout/Header';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { ComparisonsPage } from './pages/ComparisonsPage';

function App() {
  // Initialize theme from persisted state
  useTheme();

  const { initFromServer } = useDashboardStore();

  // Load settings from server on startup (shared across devices)
  useEffect(() => {
    getSettings()
      .then((settings) => { if (settings) initFromServer(settings); })
      .catch(() => { /* Server unreachable — localStorage values remain */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // latest is needed by Header for "last updated" timestamp
  const { latest } = useGlucoseData();
  const lastUpdated = latest ? new Date(latest.date) : null;

  return (
    <div className="min-h-screen bg-background">
      <Header lastUpdated={lastUpdated} />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/comparisons" element={<ComparisonsPage />} />
      </Routes>
    </div>
  );
}

export default App;
