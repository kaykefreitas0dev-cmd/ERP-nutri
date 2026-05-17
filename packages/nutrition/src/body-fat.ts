// %GC (Body Fat Percentage) — Protocolos clássicos
// Pollock 3 dobras, Pollock 7 dobras, Jackson-Pollock variante
// Siri (1961): %GC = (495 / densidade) - 450

import Decimal from "decimal.js";
import { D, round } from "./units";
import type { BiologicalSex } from "./bmr";

// ============================================================
// Pollock 3 dobras
// Homem: peitoral, abdominal, coxa
// Mulher: tricipital, supra-ilíaca, coxa
// ============================================================
export interface Pollock3Skinfolds {
  // homem
  chest?: number;
  abdominal?: number;
  // mulher
  triceps?: number;
  suprailiac?: number;
  // ambos
  thigh: number;
}

// Density via Pollock 3 / Jackson-Pollock 1980
export function densityPollock3(
  skinfolds: Pollock3Skinfolds,
  ageYears: number,
  sex: BiologicalSex,
): Decimal {
  const sum =
    sex === "male"
      ? D(skinfolds.chest ?? 0).plus(skinfolds.abdominal ?? 0).plus(skinfolds.thigh)
      : D(skinfolds.triceps ?? 0)
          .plus(skinfolds.suprailiac ?? 0)
          .plus(skinfolds.thigh);

  if (sum.lte(0)) throw new Error("Soma das dobras deve ser > 0");

  const sumSquared = sum.pow(2);
  const age = D(ageYears);

  if (sex === "male") {
    // Jackson & Pollock 1978
    return D(1.10938)
      .minus(sum.mul(0.0008267))
      .plus(sumSquared.mul(0.0000016))
      .minus(age.mul(0.0002574));
  }
  // Jackson, Pollock & Ward 1980
  return D(1.0994921)
    .minus(sum.mul(0.0009929))
    .plus(sumSquared.mul(0.0000023))
    .minus(age.mul(0.0001392));
}

// Siri equation: converte densidade em %GC
export function densityToBodyFatSiri(density: Decimal.Value): Decimal {
  return D(495).div(D(density)).minus(450);
}

// ============================================================
// Pollock 7 dobras (mais preciso, especialmente para atletas)
// Pontos: peitoral, axilar média, tricipital, subescapular,
//         abdominal, supra-ilíaca, coxa
// ============================================================
export interface Pollock7Skinfolds {
  chest: number;
  midaxillary: number;
  triceps: number;
  subscapular: number;
  abdominal: number;
  suprailiac: number;
  thigh: number;
}

export function densityPollock7(
  skinfolds: Pollock7Skinfolds,
  ageYears: number,
  sex: BiologicalSex,
): Decimal {
  const sum = Object.values(skinfolds).reduce((acc, v) => acc.plus(v), D(0));
  if (sum.lte(0)) throw new Error("Soma das dobras deve ser > 0");

  const sumSquared = sum.pow(2);
  const age = D(ageYears);

  if (sex === "male") {
    return D(1.112)
      .minus(sum.mul(0.00043499))
      .plus(sumSquared.mul(0.00000055))
      .minus(age.mul(0.00028826));
  }
  return D(1.097)
    .minus(sum.mul(0.00046971))
    .plus(sumSquared.mul(0.00000056))
    .minus(age.mul(0.00012828));
}

// ============================================================
// Helper alto nível
// ============================================================
export interface BodyFatResult {
  density: number;
  bodyFatPct: number;
  leanMassKg: number;
  fatMassKg: number;
}

export function calcBodyFat(
  protocol: "pollock_3" | "pollock_7",
  skinfolds: Pollock3Skinfolds | Pollock7Skinfolds,
  ageYears: number,
  sex: BiologicalSex,
  weightKg: number,
): BodyFatResult {
  const density =
    protocol === "pollock_3"
      ? densityPollock3(skinfolds as Pollock3Skinfolds, ageYears, sex)
      : densityPollock7(skinfolds as Pollock7Skinfolds, ageYears, sex);

  const bodyFatPct = densityToBodyFatSiri(density);
  const fatMass = D(weightKg).mul(bodyFatPct).div(100);
  const leanMass = D(weightKg).minus(fatMass);

  return {
    density: round(density, 5),
    bodyFatPct: round(bodyFatPct, 2),
    fatMassKg: round(fatMass, 2),
    leanMassKg: round(leanMass, 2),
  };
}
