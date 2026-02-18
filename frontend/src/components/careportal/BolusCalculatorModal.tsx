// ============================================================================
// BolusCalculatorModal — Calculadora de dose de bolus
// ============================================================================
// Calcula a dose sugerida com base em:
//   - Glicose atual (preenchida automaticamente, editável)
//   - Carboidratos da refeição
//   - IOB atual
//   - ISF, ICR e glicose alvo (padrões das configurações, editáveis por cálculo)
//
// Fórmula:
//   Correção = (BG - alvo) / ISF
//   Carbos   = carbs / ICR
//   Sugerido = max(0, Carbos + Correção − IOB)
// ============================================================================

import { useState, useEffect, useMemo } from 'react';
import { X, RefreshCw } from 'lucide-react';
import { Button } from '../ui/button';
import { Input } from '../ui/input';
import { Label } from '../ui/label';
import { getLatestGlucose } from '../../lib/api';
import { useIOB } from '../../hooks/useIOB';
import { useDashboardStore } from '../../stores/dashboardStore';
import { calculateBolus } from '../../lib/bolus';
import { toDisplayUnit, fromDisplayUnit, unitLabel } from '../../lib/glucose';

// ---- Props ------------------------------------------------------------------

interface Props {
  onClose: () => void;
  onRegister: (
    eventType: 'Meal Bolus' | 'Correction Bolus',
    values: { insulin: string; carbs?: string; glucose?: string }
  ) => void;
}

// ---- Component --------------------------------------------------------------

export function BolusCalculatorModal({ onClose, onRegister }: Props) {
  const { unit, isf, icr, targetBG, rapidPenStep } = useDashboardStore();
  const iob = useIOB();
  const ul = unitLabel(unit);

  // ---- State ----------------------------------------------------------------

  const [bgDisplay, setBgDisplay] = useState('');           // BG in display unit
  const [carbs,     setCarbs]     = useState('');           // g
  const [isfLocal,  setIsfLocal]  = useState(             // display unit per U
    () => String(Math.round(toDisplayUnit(isf, unit) * 10) / 10)
  );
  const [icrLocal,  setIcrLocal]  = useState(String(icr)); // g / U
  const [targetLocal, setTargetLocal] = useState(           // display unit
    () => String(Math.round(toDisplayUnit(targetBG, unit) * 10) / 10)
  );
  const [bgLoading, setBgLoading] = useState(true);

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ---- Recalculate on every input change ------------------------------------

  const breakdown = useMemo(() => {
    const currentBG = fromDisplayUnit(parseFloat(bgDisplay) || 0, unit);
    const tgt       = fromDisplayUnit(parseFloat(targetLocal) || 0, unit);
    const isfMgdl   = fromDisplayUnit(parseFloat(isfLocal) || 0, unit);
    const icrVal    = parseFloat(icrLocal) || 0;
    const carbsVal  = parseFloat(carbs) || 0;

    return calculateBolus({
      currentBG,
      targetBG: tgt,
      isf:      isfMgdl,
      icr:      icrVal,
      carbs:    carbsVal,
      iob,
    });
  }, [bgDisplay, targetLocal, isfLocal, icrLocal, carbs, iob, unit]);

  // ---- Rounded dose (to pen step) -------------------------------------------

  const rounded = Math.round(breakdown.suggested / rapidPenStep) * rapidPenStep;
  const roundedStr = rapidPenStep === 0.5
    ? rounded.toFixed(1).replace('.', ',')
    : rounded.toFixed(0);

  // ---- Helpers --------------------------------------------------------------

  function signedStr(n: number) {
    if (n > 0) return `+${n.toFixed(2)}`;
    return n.toFixed(2);
  }

  function handleRegister(eventType: 'Meal Bolus' | 'Correction Bolus') {
    const glucoseMgdl = fromDisplayUnit(parseFloat(bgDisplay) || 0, unit);
    onRegister(eventType, {
      insulin:  String(rounded),
      carbs:    eventType === 'Meal Bolus' && carbs ? carbs : undefined,
      glucose:  bgDisplay ? String(Math.round(glucoseMgdl)) : undefined,
    });
  }

  // ---- Render ---------------------------------------------------------------

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="bg-background border border-border rounded-xl shadow-2xl w-full max-w-sm">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
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
              {iob >= 0 ? '' : ''}{iob.toFixed(2)} U
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

          {/* Alvo */}
          <div className="space-y-1.5">
            <Label htmlFor="target-local">Glicose Alvo</Label>
            <div className="relative max-w-[140px]">
              <Input
                id="target-local"
                type="number"
                min="1"
                step={unit === 'mmol' ? '0.1' : '1'}
                value={targetLocal}
                onChange={(e) => setTargetLocal(e.target.value)}
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                {ul}
              </span>
            </div>
          </div>

          {/* Breakdown */}
          <div className="rounded-lg border border-border bg-muted/40 px-4 py-3 text-sm space-y-1.5">
            <div className="flex justify-between text-muted-foreground">
              <span>Carbos</span>
              <span className="tabular-nums font-medium">{signedStr(breakdown.foodDose)} U</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>Correção</span>
              <span className="tabular-nums font-medium">{signedStr(breakdown.correctionDose)} U</span>
            </div>
            <div className="flex justify-between text-muted-foreground">
              <span>IOB</span>
              <span className="tabular-nums font-medium">{signedStr(breakdown.iobOffset)} U</span>
            </div>
            <div className="border-t border-border pt-1.5 mt-1.5 flex justify-between text-muted-foreground">
              <span>Calculado</span>
              <span className="tabular-nums">{breakdown.suggested.toFixed(2)} U</span>
            </div>
            <div className="flex justify-between font-semibold text-base">
              <span>
                Dose ({rapidPenStep === 0.5 ? '0,5' : '1'} U/dose)
              </span>
              <span className="tabular-nums text-primary">{roundedStr} U</span>
            </div>
          </div>

          {/* Ações */}
          <div className="flex flex-col gap-2 pt-1">
            <Button
              className="w-full"
              onClick={() => handleRegister('Meal Bolus')}
              disabled={breakdown.suggested <= 0 && !carbs}
            >
              Registrar Meal Bolus
            </Button>
            <Button
              variant="outline"
              className="w-full"
              onClick={() => handleRegister('Correction Bolus')}
              disabled={breakdown.suggested <= 0}
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
