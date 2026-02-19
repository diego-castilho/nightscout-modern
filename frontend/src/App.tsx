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
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { ComparisonsPage } from './pages/ComparisonsPage';
import { TreatmentsPage } from './pages/TreatmentsPage';

// Inner layout: only rendered when authenticated
function AuthenticatedLayout() {
  const { initFromServer } = useDashboardStore();

  useEffect(() => {
    getSettings()
      .then((settings) => { if (settings) initFromServer(settings); })
      .catch(() => {});
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const { latest } = useGlucoseData();
  const lastUpdated = latest ? new Date(latest.date) : null;

  return (
    <div className="min-h-screen bg-background">
      <Header lastUpdated={lastUpdated} />
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/comparisons" element={<ComparisonsPage />} />
        <Route path="/treatments" element={<TreatmentsPage />} />
      </Routes>
    </div>
  );
}

function App() {
  useTheme();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route path="/*" element={<AuthenticatedLayout />} />
      </Route>
    </Routes>
  );
}

export default App;
