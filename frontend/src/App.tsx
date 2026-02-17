import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { getLatestGlucose, getAnalytics, type GlucoseEntry, type GlucoseAnalytics } from '@/lib/api';
import { formatGlucose, getGlucoseColor, getTrendArrow, timeAgo } from '@/lib/utils';
import { subHours } from 'date-fns';

function App() {
  const [latestGlucose, setLatestGlucose] = useState<GlucoseEntry | null>(null);
  const [analytics, setAnalytics] = useState<GlucoseAnalytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  async function loadData() {
    try {
      setLoading(true);
      setError(null);

      // Load latest glucose
      const glucose = await getLatestGlucose();
      setLatestGlucose(glucose);

      // Load 24h analytics
      const endDate = new Date();
      const startDate = subHours(endDate, 24);
      const analyticsData = await getAnalytics(
        startDate.toISOString(),
        endDate.toISOString()
      );
      setAnalytics(analyticsData);
    } catch (err) {
      console.error('Error loading data:', err);
      setError('Failed to load data. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <div className="animate-pulse text-4xl mb-4">📊</div>
          <p className="text-muted-foreground">Loading Nightscout data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <Card className="max-w-md">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={loadData} variant="outline" className="w-full">
              Retry
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold">Nightscout Modern</h1>
              <p className="text-sm text-muted-foreground">
                Continuous Glucose Monitoring
              </p>
            </div>
            <Button onClick={loadData} variant="outline" size="sm">
              Refresh
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-8">
        <div className="grid gap-6">
          {/* Current Glucose */}
          {latestGlucose && (
            <Card>
              <CardHeader>
                <CardTitle>Current Glucose</CardTitle>
                <CardDescription>
                  {timeAgo(latestGlucose.date)}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="flex items-center justify-between">
                  <div>
                    <div className={`text-6xl font-bold ${getGlucoseColor(latestGlucose.sgv)}`}>
                      {formatGlucose(latestGlucose.sgv)}
                      <span className="text-2xl ml-2">mg/dL</span>
                    </div>
                    {latestGlucose.trend !== undefined && (
                      <div className="text-xl mt-2 text-muted-foreground">
                        {getTrendArrow(latestGlucose.trend)}
                      </div>
                    )}
                  </div>
                  {latestGlucose.delta !== undefined && (
                    <div className="text-right">
                      <div className="text-sm text-muted-foreground">Delta</div>
                      <div className="text-2xl font-semibold">
                        {latestGlucose.delta > 0 ? '+' : ''}
                        {latestGlucose.delta}
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* 24h Analytics */}
          {analytics && (
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle>Average Glucose</CardTitle>
                  <CardDescription>Last 24 hours</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">
                    {analytics.stats.average} <span className="text-xl">mg/dL</span>
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    GMI: {analytics.stats.gmi}% | Est. A1c: {analytics.stats.estimatedA1c}%
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Time in Range</CardTitle>
                  <CardDescription>70-180 mg/dL</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold text-green-600">
                    {analytics.timeInRange.percentInRange}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    {analytics.timeInRange.inRange} of {analytics.totalReadings} readings
                  </p>
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle>Variability</CardTitle>
                  <CardDescription>Coefficient of Variation</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="text-4xl font-bold">
                    {analytics.stats.cv}%
                  </div>
                  <p className="text-sm text-muted-foreground mt-2">
                    Target: {'<'}36% | StdDev: {analytics.stats.stdDev}
                  </p>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Coming Soon */}
          <Card>
            <CardHeader>
              <CardTitle>🚧 Under Development</CardTitle>
              <CardDescription>
                This is the initial setup. More features coming soon!
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ul className="list-disc list-inside space-y-2 text-sm text-muted-foreground">
                <li>Interactive glucose charts (Recharts)</li>
                <li>Real-time WebSocket updates</li>
                <li>Daily pattern visualization</li>
                <li>Treatment tracking (insulin/carbs)</li>
                <li>AI-powered insights with Claude MCP</li>
                <li>Push notifications</li>
                <li>PDF/Excel export</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

export default App;
