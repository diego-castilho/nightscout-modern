// ============================================================================
// BolusCalculatorModal — Calculadora de dose de bolus
// ============================================================================
// Calcula a dose sugerida com base em:
//   - Glicose atual (preenchida automaticamente, editável)
//   - Carboidratos da refeição
//   - IOB atual
//   - ISF, ICR e faixa alvo (padrões das configurações, editáveis por cálculo)
//
// Fórmula (espelho de NS boluswizardpreview.js):
//   Projetado = BG − IOB × ISF
//   Correção  = 0 se Projetado ∈ [targetLow, targetHigh]
//             = (Projetado − targetHigh) / ISF  se acima (positivo)
//             = (Projetado − targetLow)  / ISF  se abaixo (negativo)
//   Carbos    = carbs / ICR
//   Sugerido  = Carbos + Correção  (pode ser negativo)
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { getLatestGlucose, getTreatments } from '../../lib/api';
import type { Treatment } from '../../lib/api';
import { useIOB } from '../../hooks/useIOB';
import { useDashboardStore } from '../../stores/dashboardStore';
import { calculateBolus } from '../../lib/bolus';
import { toDisplayUnit, fromDisplayUnit, unitLabel, formatGlucose } from '../../lib/glucose';

// ---- Props ------------------------------------------------------------------

interface Props {
  onClose: () => void;
  onRegister: (
    eventType: 'Meal Bolus' | 'Snack Bolus' | 'Correction Bolus',
    values: { insulin: string; carbs?: string; glucose?: string }
  ) => void;
}

// ---- Helpers ----------------------------------------------------------------

function minsAgo(isoStr: string): number {
  return Math.round((Date.now() - new Date(isoStr).getTime()) / 60_000);
}

// ---- Component --------------------------------------------------------------

export function BolusCalculatorModal({ onClose, onRegister }: Props) {
  const {
    unit, isf, icr, targetBG, targetBGHigh,
    rapidPenStep, scheduledBasalRate,
  } = useDashboardStore();
  const iob = useIOB();
  const ul = unitLabel(unit);

  // ---- State ----------------------------------------------------------------

  const [bgDisplay,       setBgDisplay]       = useState('');
  const [carbs,           setCarbs]           = useState('');
  const [isfLocal,        setIsfLocal]        = useState(
    () => String(Math.round(toDisplayUnit(isf, unit) * 10) / 10)
  );
  const [icrLocal,        setIcrLocal]        = useState(String(icr));
  const [targetLowLocal,  setTargetLowLocal]  = useState(
    () => String(Math.round(toDisplayUnit(targetBG, unit) * 10) / 10)
  );
  const [targetHighLocal, setTargetHighLocal] = useState(
    () => String(Math.round(toDisplayUnit(targetBGHigh, unit) * 10) / 10)
  );
  const [bgLoading,       setBgLoading]       = useState(true);
  const [recentCarbs,     setRecentCarbs]     = useState<Treatment[]>([]);

  // ---- Auto-fetch latest BG on mount ----------------------------------------

  useEffect(() => {
    getLatestGlucose()
      .then((entry) => {
        if (entry?.sgv) {
          const display = Math.round(toDisplayUnit(entry.sgv, unit) * 10) / 10;
          setBgDisplay(String(display));
        }
      })
      .catch(() => { /* deixa vazio — usuário preenche manualmente */ })
      .finally(() => setBgLoading(false));
  }, [unit]);

  // ---- Auto-fetch recent carb treatments ------------------------------------

  useEffect(() => {
    const since = new Date(Date.now() - 60 * 60_000).toISOString();
    getTreatments({ startDate: since, limit: 20 })
      .then((list) => {
        const withCarbs = list.filter((t) => t.carbs && t.carbs > 0);
        setRecentCarbs(withCarbs);
      })
      .catch(() => {});
  }, []);

  // ---- Recalculate on every input change ------------------------------------

  const breakdown = useMemo(() => {
    const currentBG  = fromDisplayUnit(parseFloat(bgDisplay)       || 0, unit);
    const tgtLow     = fromDisplayUnit(parseFloat(targetLowLocal)  || 0, unit);
    const tgtHigh    = fromDisplayUnit(parseFloat(targetHighLocal)  || 0, unit);
    const isfMgdl    = fromDisplayUnit(parseFloat(isfLocal)        || 0, unit);
    const icrVal     = parseFloat(icrLocal) || 0;
    const carbsVal   = parseFloat(carbs)    || 0;

    return calculateBolus({
      currentBG,
      targetLow:  tgtLow,
      targetHigh: tgtHigh,
      isf:        isfMgdl,
      icr:        icrVal,
      carbs:      carbsVal,
      iob,
      basalRate:  scheduledBasalRate > 0 ? scheduledBasalRate : undefined,
    });
  }, [bgDisplay, targetLowLocal, targetHighLocal, isfLocal, icrLocal, carbs, iob, unit, scheduledBasalRate]);

  // ---- Rounded dose (to pen step, clamped ≥ 0) ------------------------------

  const clampedSuggested = Math.max(0, breakdown.suggested);
  const rounded    = Math.round(clampedSuggested / rapidPenStep) * rapidPenStep;
  const roundedStr = rapidPenStep === 0.5
    ? rounded.toFixed(1).replace('.', ',')
    : rounded.toFixed(0);

  // ---- Helpers --------------------------------------------------------------

  function signedStr(n: number) {
    if (n > 0) return `+${n.toFixed(2)}`;
    return n.toFixed(2);
  }

  function handleRegister(eventType: 'Meal Bolus' | 'Snack Bolus' | 'Correction Bolus') {
    const glucoseMgdl = fromDisplayUnit(parseFloat(bgDisplay) || 0, unit);
    const includesCarbs = eventType === 'Meal Bolus' || eventType === 'Snack Bolus';
    onRegister(eventType, {
      insulin: String(rounded),
      carbs:   includesCarbs && carbs ? carbs : undefined,
      glucose: bgDisplay ? String(Math.round(glucoseMgdl)) : undefined,
    });
  }

  // ---- Derived display values -----------------------------------------------

  const projectedDisplay = formatGlucose(breakdown.projectedBG, unit);
  const inTargetRange    = breakdown.correctionDose === 0;

  // Show temp basal row only when values are within 0-200% (like NS)
  const showTempBasal30 = breakdown.tempBasal30min !== null
    && breakdown.tempBasal30min >= 0 && breakdown.tempBasal30min <= 200;
  const showTempBasal1h = breakdown.tempBasal1h !== null
    && breakdown.tempBasal1h >= 0 && breakdown.tempBasal1h <= 200;
  const hasTempBasal    = showTempBasal30 || showTempBasal1h;

  // ---- Render ---------------------------------------------------------------

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm max-h-[92vh] overflow-y-auto">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-background z-10">
          <h2 className="text-base font-semibold">Calculadora de Bolus</h2>
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4">

          {/* Glicose atual */}
          <div className="space-y-1.5">
            <Label htmlFor="bg">
              Glicose atual
              {bgLoading && <RefreshCw className="inline h-3 w-3 ml-1.5 animate-spin text-muted-foreground" />}
            </Label>
            <div className="relative">
              <Input
                id="bg"
                type="number"
                min="0"
                step={unit === 'mmol' ? '0.1' : '1'}
                placeholder={unit === 'mmol' ? '5.5' : '100'}
                value={bgDisplay}
                onChange={(e) => setBgDisplay(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {ul}
              </span>
            </div>
          </div>

          {/* Carboidratos */}
          <div className="space-y-1.5">
            <Label htmlFor="carbs">Carboidratos</Label>
            <div className="relative">
              <Input
                id="carbs"
                type="number"
                min="0"
                step="1"
                placeholder="0"
                value={carbs}
                onChange={(e) => setCarbs(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">g</span>
            </div>
          </div>

          {/* IOB */}
          <div className="space-y-1.5">
            <Label>IOB atual</Label>
            <p className="text-sm font-medium tabular-nums">
              {iob.toFixed(2)} U
              <span className="text-xs text-muted-foreground ml-1.5 font-normal">(calculado automaticamente)</span>
            </p>
          </div>

          {/* Parâmetros — linha dupla: ISF + ICR */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="isf-local">ISF</Label>
              <div className="relative">
                <Input
                  id="isf-local"
                  type="number"
                  min="1"
                  step={unit === 'mmol' ? '0.1' : '1'}
                  value={isfLocal}
                  onChange={(e) => setIsfLocal(e.target.value)}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {ul}/U
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="icr-local">ICR</Label>
              <div className="relative">
                <Input
                  id="icr-local"
                  type="number"
                  min="1"
                  step="0.5"
                  value={icrLocal}
                  onChange={(e) => setIcrLocal(e.target.value)}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">g/U</span>
              </div>
            </div>
          </div>

          {/* Alvo mín + máx */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="target-low">Alvo Mín.</Label>
              <div className="relative">
                <Input
                  id="target-low"
                  type="number"
                  min="1"
                  step={unit === 'mmol' ? '0.1' : '1'}
                  value={targetLowLocal}
                  onChange={(e) => setTargetLowLocal(e.target.value)}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {ul}
                </span>
              </div>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="target-high">Alvo Máx.</Label>
              <div className="relative">
                <Input
                  id="target-high"
                  type="number"
                  min="1"
                  step={unit === 'mmol' ? '0.1' : '1'}
                  value={targetHighLocal}
                  onChange={(e) => setTargetHighLocal(e.target.value)}
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                  {ul}
                </span>
              </div>
            </div>
          </div>

          {/* Breakdown */}
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm space-y-1.5">

            {/* Glicose projetada (após IOB) */}
            <div className="flex justify-between text-muted-foreground text-xs pb-0.5">
              <span>Glicose projetada <span className="opacity-70">(após IOB)</span></span>
              <span className="tabular-nums font-medium">
                {projectedDisplay} {ul}
              </span>
            </div>

            {/* Carbos */}
            <div className="flex justify-between text-muted-foreground">
              <span>Carbos</span>
              <span className="tabular-nums font-medium">{signedStr(breakdown.foodDose)} U</span>
            </div>

            {/* Correção */}
            <div className="flex justify-between text-muted-foreground">
              <span>
                Correção
                {inTargetRange && (
                  <span className="text-xs text-green-600 dark:text-green-500 ml-1">(dentro do alvo)</span>
                )}
              </span>
              <span className="tabular-nums font-medium">{signedStr(breakdown.correctionDose)} U</span>
            </div>

            {/* Total calculado */}
            <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between font-medium">
              <span>Calculado</span>
              <span className={`tabular-nums ${breakdown.suggested < 0 ? 'text-amber-500 dark:text-amber-400' : ''}`}>
                {breakdown.suggested.toFixed(2)} U
              </span>
            </div>

            {/* Excesso de insulina → equivalente em carbos */}
            {breakdown.suggested < 0 && (
              <div className="rounded-md bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 px-3 py-2 text-xs space-y-0.5 mt-1">
                <p className="font-semibold text-amber-700 dark:text-amber-400">
                  ⚠️ Excesso de insulina ativa
                </p>
                <p className="text-amber-600 dark:text-amber-500">
                  Equivalente a <strong>{breakdown.carbEquivalent}g</strong> de carboidratos para cobrir
                </p>
              </div>
            )}

            {/* Dose arredondada (só quando positiva) */}
            {breakdown.suggested > 0 && (
              <div className="flex justify-between font-semibold text-base">
                <span>
                  Dose ({rapidPenStep === 0.5 ? '0,5' : '1'} U/dose)
                </span>
                <span className="tabular-nums text-primary">{roundedStr} U</span>
              </div>
            )}

            {/* Sugestões de basal temporária */}
            {hasTempBasal && (
              <div className="border-t border-border pt-1.5 mt-1 space-y-1 text-xs text-muted-foreground">
                <p className="font-medium text-foreground">Alternativa — Basal Temporária:</p>
                {showTempBasal30 && (
                  <div className="flex justify-between">
                    <span>30 min</span>
                    <span className="tabular-nums font-medium">{breakdown.tempBasal30min}%</span>
                  </div>
                )}
                {showTempBasal1h && (
                  <div className="flex justify-between">
                    <span>1 hora</span>
                    <span className="tabular-nums font-medium">{breakdown.tempBasal1h}%</span>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Carboidratos recentes (última hora) */}
          {recentCarbs.length > 0 && (
            <div className="rounded-lg border border-border bg-muted/20 px-4 py-3 text-xs space-y-1.5">
              <p className="font-medium text-foreground">Carboidratos recentes (última hora)</p>
              {recentCarbs.map((t) => (
                <div key={t._id} className="flex justify-between text-muted-foreground">
                  <span>{t.eventType}</span>
                  <span className="tabular-nums">
                    {t.carbs}g · {minsAgo(t.created_at)}min atrás
                  </span>
                </div>
              ))}
            </div>
          )}

          {/* Ações */}
          <div className="flex flex-col gap-2 pt-1">
            <Button
              className="w-full"
              onClick={() => handleRegister('Meal Bolus')}
              disabled={rounded <= 0 && !carbs}
            >
              Registrar Meal Bolus
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleRegister('Snack Bolus')}
              disabled={rounded <= 0 && !carbs}
            >
              Registrar Snack Bolus
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleRegister('Correction Bolus')}
              disabled={rounded <= 0}
            >
              Registrar Correction Bolus
            </Button>
            <Button variant="ghost" className="w-full text-muted-foreground" onClick={onClose}>
              Fechar sem registrar
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
