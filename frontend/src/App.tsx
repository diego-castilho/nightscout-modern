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
import { CalendarPage } from './pages/CalendarPage';
import { WeeklyPage } from './pages/WeeklyPage';
import { HourlyStatsPage } from './pages/HourlyStatsPage';
import { DistributionPage } from './pages/DistributionPage';
import { DailyLogPage } from './pages/DailyLogPage';
import { MealPatternsPage } from './pages/MealPatternsPage';
import { AGPPage } from './pages/AGPPage';
import { SpaghettiPage } from './pages/SpaghettiPage';
import { HelpPage } from './pages/HelpPage';

// Inner layout: only rendered when authenticated
function AuthenticatedLayout() {
  const { initFromServer } = useDashboardStore();

  useEffect(() => {
    getSettings()
      .then((settings) => { if (settings) initFromServer(settings); })
      .catch((err) => { console.error('Failed to load settings:', err); });
  }, [initFromServer]);

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
        <Route path="/calendar" element={<CalendarPage />} />
        <Route path="/weekly" element={<WeeklyPage />} />
        <Route path="/hourly" element={<HourlyStatsPage />} />
        <Route path="/distribution" element={<DistributionPage />} />
        <Route path="/daily" element={<DailyLogPage />} />
        <Route path="/meals" element={<MealPatternsPage />} />
        <Route path="/agp" element={<AGPPage />} />
        <Route path="/spaghetti" element={<SpaghettiPage />} />
        <Route path="/help" element={<HelpPage />} />
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
