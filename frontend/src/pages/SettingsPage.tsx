// ============================================================================
// SettingsPage - User-configurable settings
// ============================================================================

import { useState, useEffect } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';
import { fromDisplayUnit, toDisplayUnit, unitLabel } from '../lib/glucose';
import type { GlucoseUnit } from '../lib/glucose';
import type { AlarmThresholds } from '../stores/dashboardStore';
import { saveSettings } from '../lib/api';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { User, SlidersHorizontal, RefreshCw, RotateCcw, Syringe } from 'lucide-react';

const DEFAULT_THRESHOLDS_MGDL: AlarmThresholds = {
  veryLow: 54, low: 70, high: 180, veryHigh: 250,
};

const REFRESH_OPTIONS = [
  { value: 1,  label: '1 minuto' },
  { value: 2,  label: '2 minutos' },
  { value: 5,  label: '5 minutos' },
  { value: 10, label: '10 minutos' },
  { value: 15, label: '15 minutos' },
  { value: 30, label: '30 minutos' },
];

const DIA_OPTIONS = [
  { value: 2,   label: '2 horas' },
  { value: 2.5, label: '2,5 horas' },
  { value: 3,   label: '3 horas (padrão)' },
  { value: 3.5, label: '3,5 horas' },
  { value: 4,   label: '4 horas' },
  { value: 4.5, label: '4,5 horas' },
  { value: 5,   label: '5 horas' },
  { value: 6,   label: '6 horas' },
];

export function SettingsPage() {
  const {
    unit, setUnit,
    patientName, setPatientName,
    refreshInterval, setRefreshInterval,
    alarmThresholds, setAlarmThresholds,
    dia, setDia,
  } = useDashboardStore();

  // Local threshold state (shown in selected unit)
  const [localThresholds, setLocalThresholds] = useState({
    veryLow:  toDisplayUnit(alarmThresholds.veryLow,  unit),
    low:      toDisplayUnit(alarmThresholds.low,       unit),
    high:     toDisplayUnit(alarmThresholds.high,      unit),
    veryHigh: toDisplayUnit(alarmThresholds.veryHigh,  unit),
  });

  const [localName, setLocalName] = useState(patientName);
  const [saved, setSaved] = useState(false);
  const [errors, setErrors] = useState<string[]>([]);

  // Recalculate displayed thresholds when unit changes
  useEffect(() => {
    setLocalThresholds({
      veryLow:  toDisplayUnit(alarmThresholds.veryLow,  unit),
      low:      toDisplayUnit(alarmThresholds.low,       unit),
      high:     toDisplayUnit(alarmThresholds.high,      unit),
      veryHigh: toDisplayUnit(alarmThresholds.veryHigh,  unit),
    });
  }, [unit, alarmThresholds]);

  function handleUnitChange(newUnit: GlucoseUnit) {
    setUnit(newUnit);
    saveSettings({ unit: newUnit }).catch(() => {});
  }

  function handleRefreshIntervalChange(minutes: number) {
    setRefreshInterval(minutes);
    saveSettings({ refreshInterval: minutes }).catch(() => {});
  }

  function handleDiaChange(hours: number) {
    setDia(hours);
    saveSettings({ dia: hours }).catch(() => {});
  }

  function handleThresholdChange(
    field: keyof AlarmThresholds,
    value: string
  ) {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      setLocalThresholds((prev) => ({ ...prev, [field]: num }));
    } else {
      setLocalThresholds((prev) => ({ ...prev, [field]: value as unknown as number }));
    }
  }

  function validate(): boolean {
    const { veryLow, low, high, veryHigh } = localThresholds;
    const errs: string[] = [];

    if (isNaN(veryLow) || isNaN(low) || isNaN(high) || isNaN(veryHigh)) {
      errs.push('Todos os valores de threshold devem ser numéricos.');
    } else if (!(veryLow < low && low < high && high < veryHigh)) {
      errs.push('Os thresholds devem respeitar: Muito Baixo < Baixo < Alto < Muito Alto.');
    } else {
      // Bounds check in mg/dL
      const vlMg = fromDisplayUnit(veryLow, unit);
      const vhMg = fromDisplayUnit(veryHigh, unit);
      if (vlMg < 40 || vhMg > 400) {
        errs.push('Valores fora do intervalo aceitável (40–400 mg/dL).');
      }
    }

    setErrors(errs);
    return errs.length === 0;
  }

  function handleSave() {
    if (!validate()) return;

    const newName = localName.trim();
    const newThresholds: AlarmThresholds = {
      veryLow:  fromDisplayUnit(localThresholds.veryLow,  unit),
      low:      fromDisplayUnit(localThresholds.low,       unit),
      high:     fromDisplayUnit(localThresholds.high,      unit),
      veryHigh: fromDisplayUnit(localThresholds.veryHigh,  unit),
    };

    setPatientName(newName);
    setAlarmThresholds(newThresholds);

    // Persist to server so settings are shared across all devices
    saveSettings({
      unit,
      patientName:     newName,
      refreshInterval,
      alarmThresholds: newThresholds,
    }).catch(() => { /* Server unreachable — localStorage still updated */ });

    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  }

  function handleReset() {
    setAlarmThresholds(DEFAULT_THRESHOLDS_MGDL);
    setLocalThresholds({
      veryLow:  toDisplayUnit(DEFAULT_THRESHOLDS_MGDL.veryLow,  unit),
      low:      toDisplayUnit(DEFAULT_THRESHOLDS_MGDL.low,       unit),
      high:     toDisplayUnit(DEFAULT_THRESHOLDS_MGDL.high,      unit),
      veryHigh: toDisplayUnit(DEFAULT_THRESHOLDS_MGDL.veryHigh,  unit),
    });
    setErrors([]);

    saveSettings({ alarmThresholds: DEFAULT_THRESHOLDS_MGDL }).catch(() => {});
  }

  const step = unit === 'mmol' ? '0.1' : '1';
  const ul = unitLabel(unit);

  return (
    <main className="container mx-auto px-4 py-6 max-w-2xl">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold">Configurações</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Personalize o dashboard. As alterações são salvas automaticamente no seu dispositivo.
          </p>
        </div>

        {/* ============ EXIBIÇÃO ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <User className="h-4 w-4" />
              Exibição
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Patient name */}
            <div className="space-y-1.5">
              <Label htmlFor="patientName">Nome do paciente</Label>
              <Input
                id="patientName"
                placeholder="Ex: Diego"
                value={localName}
                onChange={(e) => setLocalName(e.target.value)}
                maxLength={40}
              />
              <p className="text-xs text-muted-foreground">
                Exibido no cabeçalho do dashboard.
              </p>
            </div>

            {/* Unit */}
            <div className="space-y-1.5">
              <Label>Unidade de glicose</Label>
              <div className="flex gap-2">
                <Button
                  variant={unit === 'mgdl' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleUnitChange('mgdl')}
                >
                  mg/dL
                </Button>
                <Button
                  variant={unit === 'mmol' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => handleUnitChange('mmol')}
                >
                  mmol/L
                </Button>
              </div>
            </div>

            {/* Refresh interval */}
            <div className="space-y-1.5">
              <Label htmlFor="refreshInterval">
                <RefreshCw className="inline h-3.5 w-3.5 mr-1" />
                Atualização automática
              </Label>
              <Select
                id="refreshInterval"
                value={String(refreshInterval)}
                onChange={(e) => handleRefreshIntervalChange(Number(e.target.value))}
                className="max-w-[180px]"
              >
                {REFRESH_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
            </div>

            {/* DIA — Duration of Insulin Action */}
            <div className="space-y-1.5">
              <Label htmlFor="dia">
                <Syringe className="inline h-3.5 w-3.5 mr-1" />
                Duração da ação da insulina (DIA)
              </Label>
              <Select
                id="dia"
                value={String(dia)}
                onChange={(e) => handleDiaChange(Number(e.target.value))}
                className="max-w-[180px]"
              >
                {DIA_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Usado para calcular o IOB (Insulina Ativa). Varia por tipo de insulina:
                análogos rápidos ~3h, regular ~5h.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ============ FAIXAS LIMITES ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4" />
              Faixas Limites
            </CardTitle>
            <CardDescription>
              Define os limiares de glicose para as zonas de cor e alertas visuais.
              Os valores são armazenados em mg/dL e exibidos aqui em {ul}.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">
            {/* Threshold inputs */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label htmlFor="veryLow" className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
                  Muito baixo ({ul})
                </Label>
                <Input
                  id="veryLow"
                  type="number"
                  step={step}
                  value={localThresholds.veryLow}
                  onChange={(e) => handleThresholdChange('veryLow', e.target.value)}
                  className="border-red-300 dark:border-red-800"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="low" className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-orange-500" />
                  Baixo ({ul})
                </Label>
                <Input
                  id="low"
                  type="number"
                  step={step}
                  value={localThresholds.low}
                  onChange={(e) => handleThresholdChange('low', e.target.value)}
                  className="border-orange-300 dark:border-orange-800"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="high" className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-yellow-500" />
                  Alto ({ul})
                </Label>
                <Input
                  id="high"
                  type="number"
                  step={step}
                  value={localThresholds.high}
                  onChange={(e) => handleThresholdChange('high', e.target.value)}
                  className="border-yellow-300 dark:border-yellow-800"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="veryHigh" className="flex items-center gap-1.5">
                  <span className="inline-block w-2.5 h-2.5 rounded-full bg-red-500" />
                  Muito alto ({ul})
                </Label>
                <Input
                  id="veryHigh"
                  type="number"
                  step={step}
                  value={localThresholds.veryHigh}
                  onChange={(e) => handleThresholdChange('veryHigh', e.target.value)}
                  className="border-red-300 dark:border-red-800"
                />
              </div>
            </div>

            {/* Threshold visual preview */}
            <ThresholdPreview thresholds={localThresholds} unit={unit} />

            {/* Errors */}
            {errors.length > 0 && (
              <div className="rounded-md border border-destructive bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {errors.map((e, i) => <p key={i}>{e}</p>)}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ============ ACTIONS ============ */}
        <div className="flex items-center gap-3">
          <Button onClick={handleSave} className="flex-1 sm:flex-none sm:min-w-[120px]">
            {saved ? '✓ Salvo!' : 'Salvar'}
          </Button>
          <Button
            variant="outline"
            onClick={handleReset}
            className="flex items-center gap-1.5"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restaurar padrões
          </Button>
        </div>
      </div>
    </main>
  );
}

// ============================================================================
// ThresholdPreview - Visual bar showing glucose zones
// ============================================================================

interface ThresholdPreviewProps {
  thresholds: { veryLow: number; low: number; high: number; veryHigh: number };
  unit: GlucoseUnit;
}

function ThresholdPreview({ thresholds, unit }: ThresholdPreviewProps) {
  const ul = unitLabel(unit);
  const { veryLow, low, high, veryHigh } = thresholds;
  const max = unit === 'mmol' ? 22 : 400;
  const min = 0;
  const range = max - min;

  const pct = (v: number) => Math.max(0, Math.min(100, ((v - min) / range) * 100));

  const zones = [
    { label: 'Muito Baixo', color: 'bg-red-500',    from: 0,       to: pct(veryLow) },
    { label: 'Baixo',       color: 'bg-orange-500', from: pct(veryLow), to: pct(low) },
    { label: 'Alvo',        color: 'bg-green-500',  from: pct(low),     to: pct(high) },
    { label: 'Alto',        color: 'bg-yellow-400', from: pct(high),    to: pct(veryHigh) },
    { label: 'Muito Alto',  color: 'bg-red-500',    from: pct(veryHigh), to: 100 },
  ];

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground font-medium">Visualização das zonas</p>
      <div className="relative h-6 w-full rounded-full overflow-hidden flex">
        {zones.map((z, i) => (
          <div
            key={i}
            className={`${z.color} h-full`}
            style={{ width: `${z.to - z.from}%` }}
            title={`${z.label}: ${i === 0 ? `< ${veryLow}` : i === zones.length - 1 ? `> ${veryHigh}` : ''} ${ul}`}
          />
        ))}
      </div>
      <div className="flex justify-between text-xs text-muted-foreground">
        <span>{veryLow} {ul}</span>
        <span>{low} {ul}</span>
        <span>{high} {ul}</span>
        <span>{veryHigh} {ul}</span>
      </div>
    </div>
  );
}
