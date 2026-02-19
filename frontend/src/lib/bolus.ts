// ============================================================================
// bolus.ts — Pure bolus calculation logic
// ============================================================================
// Fórmula (inspirada no NS BWP — boluswizardpreview.js):
//
//   Projetado = BG_atual − IOB × ISF
//             (glicose esperada após o IOB ser completamente consumido)
//
//   Correção  = 0                            se Projetado ∈ [targetLow, targetHigh]
//             = (Projetado − targetHigh) / ISF  se Projetado > targetHigh  (positivo)
//             = (Projetado − targetLow)  / ISF  se Projetado < targetLow   (negativo)
//
//   Carbos    = carbs / ICR
//   Sugerido  = Carbos + Correção  (pode ser negativo: excesso de insulina ativa)
//
// Todos os valores de glicose em mg/dL internamente.
// IOB pode ser negativo (basal reduzida/suspensa).
// ============================================================================

export interface BolusBreakdown {
  projectedBG:    number;        // BG após IOB ser consumido (mg/dL)
  correctionDose: number;        // dose de correção (negativa = excesso de insulina)
  foodDose:       number;        // carbs / ICR (0 se carbs = 0)
  suggested:      number;        // foodDose + correctionDose (pode ser negativo)
  carbEquivalent: number;        // gramas p/ cobrir excesso quando suggested < 0
  tempBasal30min: number | null; // % de basal temporária 30 min (null se basalRate ausente)
  tempBasal1h:    number | null; // % de basal temporária 1 h   (null se basalRate ausente)
}

export function calculateBolus(params: {
  currentBG:  number;    // mg/dL
  targetLow:  number;    // mg/dL — limite inferior do alvo
  targetHigh: number;    // mg/dL — limite superior do alvo
  isf:        number;    // mg/dL por U
  icr:        number;    // g por U
  carbs:      number;    // g
  iob:        number;    // U (pode ser negativo)
  basalRate?: number;    // U/h — para sugestões de basal temporária
}): BolusBreakdown {
  const { currentBG, targetLow, targetHigh, isf, icr, carbs, iob, basalRate } = params;

  // Guard: evitar divisão por zero
  if (isf <= 0 || icr <= 0) {
    return {
      projectedBG: Math.round(currentBG),
      correctionDose: 0, foodDose: 0, suggested: 0,
      carbEquivalent: 0, tempBasal30min: null, tempBasal1h: null,
    };
  }

  // Glicose projetada após o IOB ser consumido (espelho de NS: outcome = scaled - effect)
  const projectedBG = currentBG - iob * isf;

  // Dose de correção baseada na faixa alvo
  let correctionDose: number;
  if (projectedBG > targetHigh) {
    correctionDose = (projectedBG - targetHigh) / isf;   // positivo → insulina necessária
  } else if (projectedBG < targetLow) {
    correctionDose = (projectedBG - targetLow)  / isf;   // negativo → excesso de insulina
  } else {
    correctionDose = 0;                                   // dentro do alvo → sem correção
  }

  const foodDose  = carbs > 0 ? carbs / icr : 0;
  const suggested = foodDose + correctionDose;

  // Equivalente em carboidratos para cobrir o excesso de insulina
  const carbEquivalent = suggested < 0
    ? Math.ceil(Math.abs(suggested) * icr)
    : 0;

  // Sugestões de basal temporária (baseadas apenas na correção, como NS BWP)
  // Fórmula NS: thirtyMin = (basal/2 + bolus) / (basal/2) × 100
  //             oneHour   = (basal   + bolus) / basal      × 100
  let tempBasal30min: number | null = null;
  let tempBasal1h:    number | null = null;
  if (basalRate && basalRate > 0 && correctionDose !== 0) {
    tempBasal30min = Math.round((basalRate / 2 + correctionDose) / (basalRate / 2) * 100);
    tempBasal1h    = Math.round((basalRate     + correctionDose) / basalRate       * 100);
  }

  const r = (n: number) => Math.round(n * 100) / 100;

  return {
    projectedBG:    Math.round(projectedBG),
    correctionDose: r(correctionDose),
    foodDose:       r(foodDose),
    suggested:      r(suggested),
    carbEquivalent,
    tempBasal30min,
    tempBasal1h,
  };
}
