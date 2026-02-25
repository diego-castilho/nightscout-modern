// ============================================================================
// SettingsPage - User-configurable settings
// ============================================================================

import { useState, useEffect } from 'react';
import { useDashboardStore } from '../stores/dashboardStore';
import { fromDisplayUnit, toDisplayUnit, unitLabel } from '../lib/glucose';
import type { GlucoseUnit } from '../lib/glucose';
import type { AlarmThresholds } from '../stores/dashboardStore';
import { saveSettings, generateAccessToken, getVapidPublicKey, registerPushSubscription, unregisterPushSubscription } from '../lib/api';
import { subscribeToPush, unsubscribeFromPush, getCurrentSubscription } from '../lib/pushSubscription';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Select } from '../components/ui/select';
import { Button } from '../components/ui/button';
import { User, SlidersHorizontal, RefreshCw, RotateCcw, Syringe, Timer, Activity, Calculator, Link2, Copy, Check, Bell, BellOff } from 'lucide-react';
import { DEFAULT_DEVICE_AGE_THRESHOLDS } from '../lib/deviceAge';
import type { DeviceAgeThresholds } from '../lib/deviceAge';

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

const CARB_ABSORPTION_OPTIONS = [
  { value: 10, label: '10 g/h (muito lento)' },
  { value: 15, label: '15 g/h (lento)' },
  { value: 20, label: '20 g/h' },
  { value: 25, label: '25 g/h' },
  { value: 30, label: '30 g/h (padrão)' },
  { value: 35, label: '35 g/h' },
  { value: 40, label: '40 g/h (rápido)' },
  { value: 50, label: '50 g/h (muito rápido)' },
];

const SAGE_WARN_OPTIONS = [
  { value: 7,  label: '7 dias (1 semana)' },
  { value: 10, label: '10 dias — padrão' },
  { value: 12, label: '12 dias' },
  { value: 14, label: '14 dias (2 semanas)' },
  { value: 15, label: '15 dias' },
];

const SAGE_URGENT_OPTIONS = [
  { value: 10, label: '10 dias' },
  { value: 12, label: '12 dias' },
  { value: 14, label: '14 dias — padrão' },
  { value: 15, label: '15 dias' },
  { value: 21, label: '21 dias (3 semanas)' },
];

const CAGE_WARN_OPTIONS = [
  { value: 24, label: '24 h (1 dia)' },
  { value: 36, label: '36 h (1,5 dias)' },
  { value: 48, label: '48 h (2 dias) — padrão' },
  { value: 60, label: '60 h (2,5 dias)' },
  { value: 72, label: '72 h (3 dias)' },
  { value: 96, label: '96 h (4 dias)' },
];

const CAGE_URGENT_OPTIONS = [
  { value: 48,  label: '48 h (2 dias)' },
  { value: 60,  label: '60 h (2,5 dias)' },
  { value: 72,  label: '72 h (3 dias) — padrão' },
  { value: 84,  label: '84 h (3,5 dias)' },
  { value: 96,  label: '96 h (4 dias)' },
  { value: 120, label: '120 h (5 dias)' },
];

const PEN_WARN_OPTIONS = [
  { value: 14, label: '14 dias (2 semanas)' },
  { value: 21, label: '21 dias (3 semanas)' },
  { value: 20, label: '20 dias — padrão' },
  { value: 25, label: '25 dias' },
  { value: 28, label: '28 dias (4 semanas)' },
  { value: 35, label: '35 dias (5 semanas)' },
];

const PEN_URGENT_OPTIONS = [
  { value: 21, label: '21 dias (3 semanas)' },
  { value: 25, label: '25 dias' },
  { value: 28, label: '28 dias (4 semanas) — padrão' },
  { value: 35, label: '35 dias (5 semanas)' },
  { value: 42, label: '42 dias (6 semanas)' },
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
    carbAbsorptionRate, setCarbAbsorptionRate,
    deviceAgeThresholds, setDeviceAgeThresholds,
    scheduledBasalRate, setScheduledBasalRate,
    isf, setIsf,
    icr, setIcr,
    targetBG, setTargetBG,
    targetBGHigh, setTargetBGHigh,
    rapidPenStep, setRapidPenStep,
    predictionsDefault, setPredictionsDefault,
    alarmConfig, setAlarmConfig,
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

  // Direct access link state
  const [directUrl,      setDirectUrl]      = useState<string | null>(null);
  const [generatingLink, setGeneratingLink] = useState(false);
  const [linkError,      setLinkError]      = useState<string | null>(null);
  const [copied,         setCopied]         = useState(false);

  // Push notification state
  const [pushActive,    setPushActive]    = useState(false);
  const [pushLoading,   setPushLoading]   = useState(false);
  const [pushError,     setPushError]     = useState<string | null>(null);

  // Check current push subscription status on mount
  useEffect(() => {
    getCurrentSubscription()
      .then((sub) => setPushActive(!!sub))
      .catch(() => {});
  }, []);

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

  function handleCarbAbsorptionRateChange(gPerHour: number) {
    setCarbAbsorptionRate(gPerHour);
    saveSettings({ carbAbsorptionRate: gPerHour }).catch(() => {});
  }

  function handleDeviceAgeThresholdChange(
    field: keyof DeviceAgeThresholds,
    value: number,
  ) {
    const next = { ...deviceAgeThresholds, [field]: value };
    setDeviceAgeThresholds(next);
    saveSettings({ deviceAgeThresholds: next }).catch(() => {});
  }

  function handleScheduledBasalRateChange(value: string) {
    const num = parseFloat(value);
    const rate = isNaN(num) || num < 0 ? 0 : Math.round(num * 100) / 100;
    setScheduledBasalRate(rate);
    saveSettings({ scheduledBasalRate: rate }).catch(() => {});
  }

  function handleIsfChange(value: string) {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    const mgdl = Math.round(fromDisplayUnit(num, unit) * 10) / 10;
    setIsf(mgdl);
    saveSettings({ isf: mgdl }).catch(() => {});
  }

  function handleIcrChange(value: string) {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    const val = Math.round(num * 10) / 10;
    setIcr(val);
    saveSettings({ icr: val }).catch(() => {});
  }

  function handleTargetBGChange(value: string) {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    const mgdl = Math.round(fromDisplayUnit(num, unit) * 10) / 10;
    setTargetBG(mgdl);
    saveSettings({ targetBG: mgdl }).catch(() => {});
  }

  function handleTargetBGHighChange(value: string) {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return;
    const mgdl = Math.round(fromDisplayUnit(num, unit) * 10) / 10;
    setTargetBGHigh(mgdl);
    saveSettings({ targetBGHigh: mgdl }).catch(() => {});
  }

  function handlePredictionsDefaultChange(on: boolean) {
    setPredictionsDefault(on);
    saveSettings({ predictionsDefault: on }).catch(() => {});
  }

  function handleAlarmConfigChange(updates: Partial<typeof alarmConfig>) {
    const next = { ...alarmConfig, ...updates };
    setAlarmConfig(updates);
    saveSettings({ alarmConfig: next }).catch(() => {});
  }

  async function handlePushSubscribe() {
    setPushLoading(true);
    setPushError(null);
    try {
      const key = await getVapidPublicKey();
      const sub = await subscribeToPush(key);
      await registerPushSubscription(sub.toJSON());
      setPushActive(true);
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Erro ao ativar notificações.');
    } finally {
      setPushLoading(false);
    }
  }

  async function handlePushUnsubscribe() {
    setPushLoading(true);
    setPushError(null);
    try {
      const sub = await getCurrentSubscription();
      if (sub) {
        await unregisterPushSubscription(sub.endpoint);
        await unsubscribeFromPush();
      }
      setPushActive(false);
    } catch (err) {
      setPushError(err instanceof Error ? err.message : 'Erro ao desativar notificações.');
    } finally {
      setPushLoading(false);
    }
  }

  function handleDeviceAgeReset() {
    setDeviceAgeThresholds(DEFAULT_DEVICE_AGE_THRESHOLDS);
    saveSettings({ deviceAgeThresholds: DEFAULT_DEVICE_AGE_THRESHOLDS }).catch(() => {});
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

  async function handleGenerateLink() {
    setGeneratingLink(true);
    setLinkError(null);
    try {
      const { token } = await generateAccessToken();
      const url = new URL(window.location.origin);
      url.searchParams.set('token', token);
      setDirectUrl(url.toString());
    } catch {
      setLinkError('Erro ao gerar link. Tente novamente.');
    } finally {
      setGeneratingLink(false);
    }
  }

  async function handleCopyLink() {
    if (!directUrl) return;
    await navigator.clipboard.writeText(directUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
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

            {/* Carb absorption rate */}
            <div className="space-y-1.5">
              <Label htmlFor="carbAbsorptionRate">
                🍞 Taxa de absorção de carboidratos
              </Label>
              <Select
                id="carbAbsorptionRate"
                value={String(carbAbsorptionRate)}
                onChange={(e) => handleCarbAbsorptionRateChange(Number(e.target.value))}
                className="max-w-[220px]"
              >
                {CARB_ABSORPTION_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-muted-foreground">
                Usado para calcular o COB (Carboidratos Ativos). Carboidratos simples
                absorvem mais rápido; refeições com gordura/proteína, mais devagar.
              </p>
            </div>

            {/* AR2 Prediction default */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label className="flex items-center gap-1.5">
                  <Activity className="h-3.5 w-3.5" />
                  Preditivo AR2 ativado por padrão
                </Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Exibe a linha de previsão de glicose ao abrir o gráfico.
                  Pode ser alterado pontualmente no próprio gráfico.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={predictionsDefault}
                onClick={() => handlePredictionsDefaultChange(!predictionsDefault)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                            transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                            ${predictionsDefault ? 'bg-primary' : 'bg-input'}`}
              >
                <span
                  className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform
                              ${predictionsDefault ? 'translate-x-5' : 'translate-x-0'}`}
                />
              </button>
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

        {/* ============ IDADE DOS DISPOSITIVOS ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Timer className="h-4 w-4" />
              Idade dos Dispositivos
            </CardTitle>
            <CardDescription>
              Limites de tempo para SAGE (sensor), CAGE (cânula), IAGE (insulina) e canetas.
              Amarelo = aviso; vermelho = vencido.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* SAGE */}
            <div>
              <p className="text-sm font-medium mb-3 flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-cyan-400" />
                Sensor CGM (Sensor Change)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="sageWarnD">Avisar após</Label>
                  <Select
                    id="sageWarnD"
                    value={String(deviceAgeThresholds.sageWarnD ?? 10)}
                    onChange={(e) => handleDeviceAgeThresholdChange('sageWarnD', Number(e.target.value))}
                  >
                    {SAGE_WARN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="sageUrgentD">Crítico após</Label>
                  <Select
                    id="sageUrgentD"
                    value={String(deviceAgeThresholds.sageUrgentD ?? 14)}
                    onChange={(e) => handleDeviceAgeThresholdChange('sageUrgentD', Number(e.target.value))}
                  >
                    {SAGE_URGENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            {/* CAGE */}
            <div>
              <p className="text-sm font-medium mb-3 flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-green-500" />
                Cânula (Site Change)
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="cageWarnH">Avisar após</Label>
                  <Select
                    id="cageWarnH"
                    value={String(deviceAgeThresholds.cageWarnH)}
                    onChange={(e) => handleDeviceAgeThresholdChange('cageWarnH', Number(e.target.value))}
                  >
                    {CAGE_WARN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="cageUrgentH">Crítico após</Label>
                  <Select
                    id="cageUrgentH"
                    value={String(deviceAgeThresholds.cageUrgentH)}
                    onChange={(e) => handleDeviceAgeThresholdChange('cageUrgentH', Number(e.target.value))}
                  >
                    {CAGE_URGENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            {/* Pens / IAGE */}
            <div>
              <p className="text-sm font-medium mb-3 flex items-center gap-1.5">
                <span className="inline-block w-2.5 h-2.5 rounded-full bg-amber-400" />
                Insulina (IAGE · Caneta Basal · Caneta Rápida)
              </p>
              <p className="text-xs text-muted-foreground mb-3 -mt-1">
                Mesmo limite para "Troca de Insulina", "Nova Caneta Basal" e "Nova Caneta Rápida".
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label htmlFor="penWarnD">Avisar após</Label>
                  <Select
                    id="penWarnD"
                    value={String(deviceAgeThresholds.penWarnD)}
                    onChange={(e) => handleDeviceAgeThresholdChange('penWarnD', Number(e.target.value))}
                  >
                    {PEN_WARN_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="penUrgentD">Crítico após</Label>
                  <Select
                    id="penUrgentD"
                    value={String(deviceAgeThresholds.penUrgentD)}
                    onChange={(e) => handleDeviceAgeThresholdChange('penUrgentD', Number(e.target.value))}
                  >
                    {PEN_URGENT_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex justify-end">
              <Button variant="outline" size="sm" onClick={handleDeviceAgeReset}
                      className="flex items-center gap-1.5 text-xs">
                <RotateCcw className="h-3 w-3" />
                Restaurar padrões
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* ============ BOMBA DE INSULINA ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Activity className="h-4 w-4" />
              Bomba de Insulina
            </CardTitle>
            <CardDescription>
              Configurações específicas para usuários de bomba (CSII).
              Não é necessário preencher se usar canetas (MDI).
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="scheduledBasalRate">
                Taxa basal programada
              </Label>
              <div className="relative max-w-[180px]">
                <Input
                  id="scheduledBasalRate"
                  type="number"
                  min="0"
                  step="0.05"
                  placeholder="0.00"
                  value={scheduledBasalRate === 0 ? '' : String(scheduledBasalRate)}
                  onChange={(e) => handleScheduledBasalRateChange(e.target.value)}
                  onBlur={(e) => handleScheduledBasalRateChange(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  U/h
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Usada para calcular o IOB de basais temporárias (desvio da taxa
                programada). Deixe em 0 se não usar bomba ou se não quiser incluir
                Temp Basal no IOB.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ============ CALCULADORA DE BOLUS ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Calculator className="h-4 w-4" />
              Calculadora de Bolus
            </CardTitle>
            <CardDescription>
              Parâmetros padrão para cálculo de dose. Podem ser ajustados individualmente
              a cada cálculo no modal da calculadora.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* ISF */}
            <div className="space-y-1.5">
              <Label htmlFor="isf">
                ISF — Sensibilidade à Insulina
              </Label>
              <div className="relative max-w-[180px]">
                <Input
                  id="isf"
                  type="number"
                  min="1"
                  step={unit === 'mmol' ? '0.1' : '1'}
                  placeholder={unit === 'mmol' ? '2.8' : '50'}
                  value={isf > 0 ? String(Math.round(toDisplayUnit(isf, unit) * 10) / 10) : ''}
                  onChange={(e) => handleIsfChange(e.target.value)}
                  onBlur={(e) => handleIsfChange(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {ul}/U
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Quanto 1 U de insulina reduz a glicose.
              </p>
            </div>

            {/* ICR */}
            <div className="space-y-1.5">
              <Label htmlFor="icr">
                ICR — Relação Insulina-Carboidrato
              </Label>
              <div className="relative max-w-[180px]">
                <Input
                  id="icr"
                  type="number"
                  min="1"
                  step="0.5"
                  placeholder="15"
                  value={icr > 0 ? String(icr) : ''}
                  onChange={(e) => handleIcrChange(e.target.value)}
                  onBlur={(e) => handleIcrChange(e.target.value)}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  g/U
                </span>
              </div>
              <p className="text-xs text-muted-foreground">
                Quantos gramas de carboidrato 1 U cobre.
              </p>
            </div>

            {/* Target BG — faixa mín / máx */}
            <div className="space-y-1.5">
              <Label>Faixa Alvo</Label>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Mínimo</p>
                  <div className="relative">
                    <Input
                      id="targetBG"
                      type="number"
                      min="1"
                      step={unit === 'mmol' ? '0.1' : '1'}
                      placeholder={unit === 'mmol' ? '5.5' : '100'}
                      value={targetBG > 0 ? String(Math.round(toDisplayUnit(targetBG, unit) * 10) / 10) : ''}
                      onChange={(e) => handleTargetBGChange(e.target.value)}
                      onBlur={(e) => handleTargetBGChange(e.target.value)}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {ul}
                    </span>
                  </div>
                </div>
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Máximo</p>
                  <div className="relative">
                    <Input
                      id="targetBGHigh"
                      type="number"
                      min="1"
                      step={unit === 'mmol' ? '0.1' : '1'}
                      placeholder={unit === 'mmol' ? '6.7' : '120'}
                      value={targetBGHigh > 0 ? String(Math.round(toDisplayUnit(targetBGHigh, unit) * 10) / 10) : ''}
                      onChange={(e) => handleTargetBGHighChange(e.target.value)}
                      onBlur={(e) => handleTargetBGHighChange(e.target.value)}
                    />
                    <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      {ul}
                    </span>
                  </div>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">
                A correção é zero quando a glicose projetada (após IOB) está dentro dessa faixa.
              </p>
            </div>

            {/* Pen step */}
            <div className="space-y-1.5">
              <Label>Incremento da caneta rápida</Label>
              <div className="flex gap-4">
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="rapidPenStep"
                    value="1"
                    checked={rapidPenStep === 1}
                    onChange={() => {
                      setRapidPenStep(1);
                      saveSettings({ rapidPenStep: 1 }).catch(() => {});
                    }}
                    className="accent-primary"
                  />
                  1 U
                </label>
                <label className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input
                    type="radio"
                    name="rapidPenStep"
                    value="0.5"
                    checked={rapidPenStep === 0.5}
                    onChange={() => {
                      setRapidPenStep(0.5);
                      saveSettings({ rapidPenStep: 0.5 }).catch(() => {});
                    }}
                    className="accent-primary"
                  />
                  0,5 U
                </label>
              </div>
              <p className="text-xs text-muted-foreground">
                Dose mínima aplicável. A calculadora arredonda para o múltiplo mais próximo.
                Atualizado automaticamente ao registrar uma Nova Caneta Rápida.
              </p>
            </div>
          </CardContent>
        </Card>

        {/* ============ ALARMES ============ */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <Bell className="h-4 w-4" />
              Alarmes
            </CardTitle>
            <CardDescription>
              Notificações sonoras e push quando a glicose sair dos limites configurados.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-5">

            {/* Master toggle */}
            <div className="flex items-center justify-between gap-4">
              <div>
                <Label>Alarmes habilitados</Label>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Liga/desliga todos os alarmes de glicose.
                </p>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={alarmConfig.enabled}
                onClick={() => handleAlarmConfigChange({ enabled: !alarmConfig.enabled })}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                            transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                            ${alarmConfig.enabled ? 'bg-primary' : 'bg-input'}`}
              >
                <span className={`pointer-events-none block h-5 w-5 rounded-full bg-background shadow-lg ring-0 transition-transform
                                  ${alarmConfig.enabled ? 'translate-x-5' : 'translate-x-0'}`} />
              </button>
            </div>

            {alarmConfig.enabled && (
              <>
                {/* Per-type toggles */}
                <div className="space-y-3 border-t pt-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Tipos de alarme</p>

                  {(
                    [
                      { key: 'veryLow',    label: 'Muito baixo',      dot: 'bg-red-500'    },
                      { key: 'low',        label: 'Baixo',            dot: 'bg-orange-500' },
                      { key: 'high',       label: 'Alto',             dot: 'bg-yellow-400' },
                      { key: 'veryHigh',   label: 'Muito alto',       dot: 'bg-red-500'    },
                      { key: 'predictive', label: 'Preditivo AR2',    dot: 'bg-cyan-400'   },
                      { key: 'rapidChange',label: 'Variação rápida',  dot: 'bg-purple-400' },
                    ] as const
                  ).map(({ key, label, dot }) => (
                    <div key={key} className="flex items-center justify-between">
                      <Label className="flex items-center gap-2 cursor-pointer font-normal">
                        <span className={`inline-block w-2 h-2 rounded-full ${dot}`} />
                        {label}
                      </Label>
                      <button
                        type="button"
                        role="switch"
                        aria-checked={alarmConfig[key]}
                        onClick={() => handleAlarmConfigChange({ [key]: !alarmConfig[key] })}
                        className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                                    transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                                    ${alarmConfig[key] ? 'bg-primary' : 'bg-input'}`}
                      >
                        <span className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform
                                          ${alarmConfig[key] ? 'translate-x-4' : 'translate-x-0'}`} />
                      </button>
                    </div>
                  ))}

                  {/* Stale toggle + staleMins */}
                  <div className="flex items-center justify-between">
                    <Label className="flex items-center gap-2 cursor-pointer font-normal">
                      <span className="inline-block w-2 h-2 rounded-full bg-gray-400" />
                      Dados desatualizados
                    </Label>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={alarmConfig.stale}
                      onClick={() => handleAlarmConfigChange({ stale: !alarmConfig.stale })}
                      className={`relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border-2 border-transparent
                                  transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring
                                  ${alarmConfig.stale ? 'bg-primary' : 'bg-input'}`}
                    >
                      <span className={`pointer-events-none block h-4 w-4 rounded-full bg-background shadow-lg ring-0 transition-transform
                                        ${alarmConfig.stale ? 'translate-x-4' : 'translate-x-0'}`} />
                    </button>
                  </div>
                  {alarmConfig.stale && (
                    <div className="flex items-center gap-3 pl-4">
                      <Label htmlFor="staleMins" className="text-xs text-muted-foreground shrink-0">
                        Alertar após
                      </Label>
                      <div className="relative w-[90px]">
                        <Input
                          id="staleMins"
                          type="number"
                          min={5}
                          max={60}
                          step={5}
                          value={alarmConfig.staleMins}
                          onChange={(e) => {
                            const v = parseInt(e.target.value, 10);
                            if (!isNaN(v) && v >= 5) handleAlarmConfigChange({ staleMins: v });
                          }}
                        />
                        <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">min</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Push notification section */}
                <div className="space-y-3 border-t pt-4">
                  <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
                    Notificações push neste dispositivo
                  </p>
                  <p className="text-xs text-muted-foreground">
                    Permite que alarmes acordem o browser mesmo com a aba fechada ou em segundo plano.
                    Cada dispositivo precisa ser ativado separadamente.
                  </p>
                  {pushActive ? (
                    <div className="flex items-center gap-3">
                      <span className="flex items-center gap-1.5 text-sm text-green-600 dark:text-green-400">
                        <Bell className="h-4 w-4" />
                        Ativo neste dispositivo
                      </span>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={pushLoading}
                        onClick={handlePushUnsubscribe}
                        className="gap-1.5 text-xs"
                      >
                        <BellOff className="h-3.5 w-3.5" />
                        {pushLoading ? 'Aguarde…' : 'Desativar'}
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pushLoading}
                      onClick={handlePushSubscribe}
                      className="gap-1.5"
                    >
                      <Bell className="h-3.5 w-3.5" />
                      {pushLoading ? 'Aguarde…' : 'Ativar notificações neste dispositivo'}
                    </Button>
                  )}
                  {pushError && (
                    <p className="text-xs text-destructive">{pushError}</p>
                  )}
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* ============ ACESSO DIRETO ============ */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              Acesso Direto
            </CardTitle>
            <CardDescription>
              Gere um link que abre o dashboard sem precisar fazer login.
              Válido por 30 dias. Guarde-o em segurança — qualquer pessoa com o link tem acesso total.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {directUrl ? (
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <Input
                    readOnly
                    value={directUrl}
                    className="text-xs font-mono"
                    onFocus={(e) => e.target.select()}
                  />
                  <Button variant="outline" size="sm" onClick={handleCopyLink} className="shrink-0">
                    {copied
                      ? <Check className="h-4 w-4 text-green-500" />
                      : <Copy className="h-4 w-4" />
                    }
                  </Button>
                </div>
                <div className="flex items-center justify-between">
                  <p className="text-xs text-muted-foreground">
                    Expira em 30 dias. Gere um novo para invalidar este.
                  </p>
                  <button
                    onClick={() => setDirectUrl(null)}
                    className="text-xs text-muted-foreground hover:text-foreground underline"
                  >
                    Fechar
                  </button>
                </div>
              </div>
            ) : (
              <Button
                variant="outline"
                size="sm"
                onClick={handleGenerateLink}
                disabled={generatingLink}
                className="gap-1.5"
              >
                <Link2 className="h-3.5 w-3.5" />
                {generatingLink ? 'Gerando…' : 'Gerar link de acesso'}
              </Button>
            )}
            {linkError && (
              <p className="text-xs text-destructive">{linkError}</p>
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
