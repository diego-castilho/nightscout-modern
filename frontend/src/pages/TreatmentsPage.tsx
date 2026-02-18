// ============================================================================
// TreatmentsPage — Histórico de tratamentos registrados
// Filtros: período + tipo de evento. Agrupado por dia, deletar inline.
// ============================================================================

import { useState, useEffect, useCallback } from 'react';
import { Plus, Trash2, Syringe } from 'lucide-react';
import { format, parseISO, isValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Button } from '../components/ui/button';
import { getTreatments, deleteTreatment } from '../lib/api';
import type { Treatment } from '../lib/api';
import { useDashboardStore } from '../stores/dashboardStore';
import { formatGlucose, unitLabel } from '../lib/glucose';
import { TreatmentModal } from '../components/careportal/TreatmentModal';
import { EVENT_TYPES } from '../components/careportal/TreatmentModal';

// ---- Constantes -------------------------------------------------------------

const PERIOD_OPTIONS = [
  { value: '1d',  label: 'Hoje' },
  { value: '7d',  label: 'Últimos 7d' },
  { value: '14d', label: 'Últimos 14d' },
  { value: '30d', label: 'Últimos 30d' },
];

const PERIOD_MS: Record<string, number> = {
  '1d':  86_400_000,
  '7d':  7  * 86_400_000,
  '14d': 14 * 86_400_000,
  '30d': 30 * 86_400_000,
};

const EVENT_LABEL: Record<string, string> = Object.fromEntries(
  EVENT_TYPES.map((t) => [t.value, t.label])
);

// ---- Helpers ----------------------------------------------------------------

function periodDates(period: string): { startDate: string; endDate: string } {
  const ms = PERIOD_MS[period] ?? PERIOD_MS['1d'];
  const now = Date.now();
  return {
    startDate: new Date(now - ms).toISOString(),
    endDate:   new Date(now).toISOString(),
  };
}

function treatmentSummary(t: Treatment, unit: import('../lib/glucose').GlucoseUnit): string {
  const ul = unitLabel(unit);
  const parts: string[] = [];
  if (t.insulin != null)  parts.push(`${t.insulin}U`);
  if (t.carbs   != null)  parts.push(`${t.carbs}g carbos`);
  if (t.glucose != null)  parts.push(`${formatGlucose(t.glucose, unit)} ${ul}`);
  if (t.protein != null)  parts.push(`${t.protein}g prot`);
  if (t.fat     != null)  parts.push(`${t.fat}g gord`);
  if (t.notes)            parts.push(`"${t.notes}"`);
  return parts.join(' · ');
}

function parseDate(dateStr: string): Date | null {
  try {
    const d = parseISO(dateStr);
    return isValid(d) ? d : null;
  } catch {
    return null;
  }
}

// Agrupa tratamentos por dia (chave: 'dd/MM/yyyy')
function groupByDay(treatments: Treatment[]): Array<{ dayLabel: string; items: Treatment[] }> {
  const groups: Map<string, Treatment[]> = new Map();
  for (const t of treatments) {
    const d = parseDate(t.created_at);
    if (!d) continue;
    const key = format(d, 'eeee, dd/MM/yyyy', { locale: ptBR });
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(t);
  }
  return Array.from(groups.entries()).map(([dayLabel, items]) => ({ dayLabel, items }));
}

// ---- Component --------------------------------------------------------------

export function TreatmentsPage() {
  const { unit } = useDashboardStore();

  const [period,    setPeriod]    = useState('1d');
  const [eventType, setEventType] = useState('');
  const [treatments, setTreatments] = useState<Treatment[]>([]);
  const [loading,   setLoading]   = useState(false);
  const [error,     setError]     = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [deleting,  setDeleting]  = useState<string | null>(null);

  const fetchTreatments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const { startDate, endDate } = periodDates(period);
      const params: Record<string, string | number> = { startDate, endDate, limit: 500 };
      if (eventType) params.eventType = eventType;
      const data = await getTreatments(params as any);
      setTreatments(data);
    } catch {
      setError('Erro ao carregar tratamentos. Tente novamente.');
    } finally {
      setLoading(false);
    }
  }, [period, eventType]);

  useEffect(() => {
    fetchTreatments();
  }, [fetchTreatments]);

  async function handleDelete(id: string) {
    if (!confirm('Remover este tratamento?')) return;
    setDeleting(id);
    try {
      await deleteTreatment(id);
      setTreatments((prev) => prev.filter((t) => t._id !== id));
    } catch {
      alert('Erro ao remover tratamento.');
    } finally {
      setDeleting(null);
    }
  }

  const grouped = groupByDay(treatments);

  return (
    <>
      <main className="container mx-auto px-4 py-4 max-w-3xl">
        {/* Cabeçalho da página */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Syringe className="h-5 w-5 text-muted-foreground" />
            <h1 className="text-lg font-semibold">Tratamentos</h1>
          </div>
          <Button size="sm" onClick={() => setModalOpen(true)} className="gap-1.5">
            <Plus className="h-4 w-4" />
            Registrar
          </Button>
        </div>

        {/* Filtros */}
        <div className="flex gap-3 mb-4">
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            value={eventType}
            onChange={(e) => setEventType(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="">Todos os tipos</option>
            {EVENT_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-2">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        )}

        {/* Erro */}
        {!loading && error && (
          <div className="rounded-lg border border-destructive bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
            <button onClick={fetchTreatments} className="ml-2 underline text-xs">
              Tentar novamente
            </button>
          </div>
        )}

        {/* Vazio */}
        {!loading && !error && treatments.length === 0 && (
          <div className="text-center py-16 text-muted-foreground">
            <Syringe className="h-10 w-10 mx-auto mb-3 opacity-30" />
            <p className="text-sm">Nenhum tratamento registrado neste período.</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => setModalOpen(true)}
            >
              <Plus className="h-4 w-4 mr-1.5" />
              Registrar primeiro tratamento
            </Button>
          </div>
        )}

        {/* Lista agrupada por dia */}
        {!loading && !error && grouped.length > 0 && (
          <div className="space-y-5">
            {grouped.map(({ dayLabel, items }) => (
              <div key={dayLabel}>
                {/* Separador de dia */}
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wide capitalize">
                    {dayLabel}
                  </span>
                  <div className="flex-1 h-px bg-border" />
                </div>

                {/* Itens do dia */}
                <div className="space-y-1.5">
                  {items.map((t) => {
                    const d = parseDate(t.created_at);
                    const timeStr = d ? format(d, 'HH:mm') : '—';
                    const summary = treatmentSummary(t, unit);
                    const labelPT = EVENT_LABEL[t.eventType] ?? t.eventType;

                    return (
                      <div
                        key={t._id}
                        className="flex items-start justify-between gap-3 rounded-lg border border-border bg-card px-3 py-2.5 text-sm"
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          <span className="text-xs text-muted-foreground font-mono mt-0.5 shrink-0">{timeStr}</span>
                          <div className="min-w-0">
                            <span className="font-medium">{labelPT}</span>
                            {summary && (
                              <p className="text-xs text-muted-foreground truncate mt-0.5">{summary}</p>
                            )}
                          </div>
                        </div>
                        <button
                          onClick={() => handleDelete(t._id)}
                          disabled={deleting === t._id}
                          className="shrink-0 text-muted-foreground hover:text-destructive transition-colors disabled:opacity-40 mt-0.5"
                          title="Remover"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Modal */}
      {modalOpen && (
        <TreatmentModal
          onClose={() => setModalOpen(false)}
          onSuccess={() => { setModalOpen(false); fetchTreatments(); }}
        />
      )}
    </>
  );
}
