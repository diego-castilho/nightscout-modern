// ============================================================================
// bolus.ts — Pure bolus calculation logic
// ============================================================================
// Fórmula padrão:
//   Correção  = (BG_atual − targetBG) / ISF
//   Carbos    = carbs / ICR
//   Sugerido  = max(0, Carbos + Correção − IOB)
//
// Todos os valores de glicose em mg/dL internamente.
// IOB pode ser negativo (basal reduzida/suspensa).
// ============================================================================

export interface BolusBreakdown {
  correctionDose: number;  // (BG - target) / ISF  (pode ser negativo)
  foodDose:       number;  // carbs / ICR            (0 se carbs = 0)
  iobOffset:      number;  // − IOB
  suggested:      number;  // max(0, food + correction − IOB)
}

export function calculateBolus(params: {
  currentBG: number;  // mg/dL
  targetBG:  number;  // mg/dL
  isf:       number;  // mg/dL por U
  icr:       number;  // g por U
  carbs:     number;  // g
  iob:       number;  // U (pode ser negativo)
}): BolusBreakdown {
  const { currentBG, targetBG, isf, icr, carbs, iob } = params;

  // Guard: evitar divisão por zero
  if (isf <= 0 || icr <= 0) {
    return { correctionDose: 0, foodDose: 0, iobOffset: -iob, suggested: 0 };
  }

  const correctionDose = (currentBG - targetBG) / isf;
  const foodDose       = carbs > 0 ? carbs / icr : 0;
  const iobOffset      = -iob;
  const suggested      = Math.max(0, foodDose + correctionDose + iobOffset);

  return {
    correctionDose: Math.round(correctionDose * 100) / 100,
    foodDose:       Math.round(foodDose       * 100) / 100,
    iobOffset:      Math.round(iobOffset      * 100) / 100,
    suggested:      Math.round(suggested      * 100) / 100,
  };
}
