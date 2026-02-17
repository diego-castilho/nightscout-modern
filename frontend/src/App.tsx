// ============================================================================
// App - Layout root with routing
// ============================================================================

import { Routes, Route } from 'react-router-dom';
import { useTheme } from './hooks/useTheme';
import { useGlucoseData } from './hooks/useGlucoseData';

import { Header } from './components/layout/Header';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';

function App() {
  // Initialize theme from persisted state
  useTheme();

  // latest is needed by Header for "last updated" timestamp
  const { latest } = useGlucoseData();
  const lastUpdated = latest ? new Date(latest.date) : null;

  return (
    <div className="min-h-screen bg-background">
      <Header lastUpdated={lastUpdated} />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Routes>
    </div>
  );
}

export default App;
