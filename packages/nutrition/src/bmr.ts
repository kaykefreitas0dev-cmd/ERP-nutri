// Basal Metabolic Rate (BMR / GEB) — múltiplas fórmulas
// Cada uma retorna kcal/dia
//
// Mifflin-St Jeor (1990): mais precisa para populações modernas
// Harris-Benedict revisada (1984): clássica
// FAO/OMS (1985): adotada por consenso internacional

import Decimal from "decimal.js";
import { D } from "./units";

export type BiologicalSex = "female" | "male";

export interface BmrInput {
  weightKg: Decimal.Value;
  heightCm: Decimal.Value;
  ageYears: number;
  sex: BiologicalSex;
}

// ============================================================
// Mifflin-St Jeor (recomendada)
// homem: 10*peso + 6.25*altura - 5*idade + 5
// mulher: 10*peso + 6.25*altura - 5*idade - 161
// ============================================================
export function bmrMifflin({ weightKg, heightCm, ageYears, sex }: BmrInput): Decimal {
  if (ageYears < 0 || ageYears > 130) throw new Error("idade inválida");
  const w = D(weightKg);
  const h = D(heightCm);
  const base = w.mul(10).plus(h.mul(6.25)).minus(D(ageYears).mul(5));
  return sex === "male" ? base.plus(5) : base.minus(161);
}

// ============================================================
// Harris-Benedict revisada (Roza & Shizgal 1984)
// homem: 88.362 + 13.397*peso + 4.799*altura - 5.677*idade
// mulher: 447.593 + 9.247*peso + 3.098*altura - 4.330*idade
// ============================================================
export function bmrHarris({ weightKg, heightCm, ageYears, sex }: BmrInput): Decimal {
  if (ageYears < 0 || ageYears > 130) throw new Error("idade inválida");
  const w = D(weightKg);
  const h = D(heightCm);
  const a = D(ageYears);

  if (sex === "male") {
    return D(88.362).plus(w.mul(13.397)).plus(h.mul(4.799)).minus(a.mul(5.677));
  }
  return D(447.593).plus(w.mul(9.247)).plus(h.mul(3.098)).minus(a.mul(4.33));
}

// ============================================================
// FAO/OMS (1985) por faixa etária — apenas peso
// Faixas:  0-3, 3-10, 10-18, 18-30, 30-60, 60+
// ============================================================
const FAO_COEFFICIENTS: Record<BiologicalSex, Array<{ maxAge: number; mult: number; add: number }>> = {
  male: [
    { maxAge: 3, mult: 60.9, add: -54 },
    { maxAge: 10, mult: 22.7, add: 495 },
    { maxAge: 18, mult: 17.5, add: 651 },
    { maxAge: 30, mult: 15.3, add: 679 },
    { maxAge: 60, mult: 11.6, add: 879 },
    { maxAge: Infinity, mult: 13.5, add: 487 },
  ],
  female: [
    { maxAge: 3, mult: 61, add: -51 },
    { maxAge: 10, mult: 22.5, add: 499 },
    { maxAge: 18, mult: 12.2, add: 746 },
    { maxAge: 30, mult: 14.7, add: 496 },
    { maxAge: 60, mult: 8.7, add: 829 },
    { maxAge: Infinity, mult: 10.5, add: 596 },
  ],
};

export function bmrFao(input: BmrInput): Decimal {
  const w = D(input.weightKg);
  const band = FAO_COEFFICIENTS[input.sex].find((b) => input.ageYears < b.maxAge);
  if (!band) throw new Error("faixa etária FAO não encontrada");
  return w.mul(band.mult).plus(band.add);
}

// ============================================================
// Helper: calcula todas e retorna Map
// ============================================================
export interface BmrAll {
  mifflin: Decimal;
  harris: Decimal;
  fao: Decimal;
}

export function bmrAll(input: BmrInput): BmrAll {
  return {
    mifflin: bmrMifflin(input),
    harris: bmrHarris(input),
    fao: bmrFao(input),
  };
}

// ============================================================
// Fator atividade (PAL) — para chegar de BMR ao GET (gasto total)
// ============================================================
export const PAL = {
  SEDENTARY: 1.2, // Sedentário
  LIGHT: 1.375, // Atividade leve (1-3x/sem)
  MODERATE: 1.55, // Atividade moderada (3-5x/sem)
  ACTIVE: 1.725, // Ativo (6-7x/sem)
  VERY_ACTIVE: 1.9, // Muito ativo (2x/dia ou trabalho braçal)
} as const;

export type ActivityLevel = keyof typeof PAL;

export function totalEnergyExpenditure(bmr: Decimal.Value, pal: ActivityLevel): Decimal {
  return D(bmr).mul(PAL[pal]);
}
