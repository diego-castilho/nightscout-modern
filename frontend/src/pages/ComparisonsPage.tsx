// ============================================================================
// ComparisonsPage - Página de comparação de períodos
// Exibe os 4 pares de comparação (24h, 7d, 14d, 30d) simultaneamente,
// cada um buscando seus próprios dados de forma independente.
// ============================================================================

import { ComparisonChart } from '../components/charts/ComparisonChart';

export function ComparisonsPage() {
  return (
    <main className="container mx-auto px-4 py-4 max-w-5xl">
      <div className="space-y-4">
        <ComparisonChart fixedPeriod="24h" />
        <ComparisonChart fixedPeriod="7d" />
        <ComparisonChart fixedPeriod="14d" />
        <ComparisonChart fixedPeriod="30d" />
      </div>
    </main>
  );
}
