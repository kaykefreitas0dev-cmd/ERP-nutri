// Distribuição de macronutrientes — Plano alimentar
// - Proteína: g/kg de peso (ex: 1.6 g/kg para hipertrofia)
// - Lipídio: % do GET (ex: 25%)
// - Carboidrato: kcal restantes / 4

import Decimal from "decimal.js";
import { D, round } from "./units";

// kcal por grama
export const KCAL_PER_G = {
  protein: 4,
  carb: 4,
  fat: 9,
  alcohol: 7,
  fiber: 2, // varia por país; FAO 1998 = 2
} as const;

export interface MacroPlan {
  targetKcal: number;
  proteinGPerKg: number; // ex: 1.2 - 2.2
  fatPctOfKcal: number; // ex: 0.25 - 0.35
  weightKg: number;
}

export interface MacroBreakdown {
  proteinG: number;
  proteinKcal: number;
  fatG: number;
  fatKcal: number;
  carbG: number;
  carbKcal: number;
  totalKcal: number;
  pctProtein: number;
  pctFat: number;
  pctCarb: number;
}

export function calcMacroBreakdown(plan: MacroPlan): MacroBreakdown {
  if (plan.targetKcal < 600 || plan.targetKcal > 6000) {
    throw new Error(`targetKcal fora do range fisiológico: ${plan.targetKcal}`);
  }
  if (plan.proteinGPerKg < 0.4 || plan.proteinGPerKg > 4) {
    throw new Error(`proteinGPerKg fora do range: ${plan.proteinGPerKg}`);
  }
  if (plan.fatPctOfKcal < 0.1 || plan.fatPctOfKcal > 0.6) {
    throw new Error(`fatPctOfKcal fora do range: ${plan.fatPctOfKcal}`);
  }

  const totalKcal = D(plan.targetKcal);
  const proteinG = D(plan.proteinGPerKg).mul(plan.weightKg);
  const proteinKcal = proteinG.mul(KCAL_PER_G.protein);

  const fatKcal = totalKcal.mul(plan.fatPctOfKcal);
  const fatG = fatKcal.div(KCAL_PER_G.fat);

  const carbKcal = totalKcal.minus(proteinKcal).minus(fatKcal);
  if (carbKcal.lt(0)) {
    throw new Error(
      "Proteína + lipídio excedem o targetKcal. Reduza proteinGPerKg ou fatPctOfKcal.",
    );
  }
  const carbG = carbKcal.div(KCAL_PER_G.carb);

  return {
    proteinG: round(proteinG),
    proteinKcal: round(proteinKcal),
    fatG: round(fatG),
    fatKcal: round(fatKcal),
    carbG: round(carbG),
    carbKcal: round(carbKcal),
    totalKcal: round(totalKcal),
    pctProtein: round(proteinKcal.div(totalKcal).mul(100), 1),
    pctFat: round(fatKcal.div(totalKcal).mul(100), 1),
    pctCarb: round(carbKcal.div(totalKcal).mul(100), 1),
  };
}

// Helper: sugestões padrão por objetivo
export const MACRO_PRESETS = {
  weight_loss: { proteinGPerKg: 1.6, fatPctOfKcal: 0.3 },
  maintenance: { proteinGPerKg: 1.2, fatPctOfKcal: 0.3 },
  hypertrophy: { proteinGPerKg: 1.8, fatPctOfKcal: 0.25 },
  endurance: { proteinGPerKg: 1.4, fatPctOfKcal: 0.25 },
  low_carb: { proteinGPerKg: 1.5, fatPctOfKcal: 0.45 },
  keto: { proteinGPerKg: 1.2, fatPctOfKcal: 0.7 }, // edge case validação manual
} as const;

export type MacroPreset = keyof typeof MACRO_PRESETS;
