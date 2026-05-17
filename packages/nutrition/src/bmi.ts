// Body Mass Index (IMC) — OMS

import Decimal from "decimal.js";
import { D, cmToM, round } from "./units";

export function calcBMI(weightKg: Decimal.Value, heightCm: Decimal.Value): Decimal {
  const w = D(weightKg);
  const h = cmToM(heightCm);
  if (h.lte(0) || w.lte(0)) {
    throw new Error("Peso e altura devem ser > 0");
  }
  return w.div(h.pow(2));
}

export type BmiClassification =
  | "underweight_severe"
  | "underweight_moderate"
  | "underweight_mild"
  | "normal"
  | "overweight"
  | "obese_1"
  | "obese_2"
  | "obese_3";

export function classifyBMI(bmi: Decimal.Value): BmiClassification {
  const v = D(bmi).toNumber();
  if (v < 16) return "underweight_severe";
  if (v < 17) return "underweight_moderate";
  if (v < 18.5) return "underweight_mild";
  if (v < 25) return "normal";
  if (v < 30) return "overweight";
  if (v < 35) return "obese_1";
  if (v < 40) return "obese_2";
  return "obese_3";
}

export const BMI_LABELS: Record<BmiClassification, string> = {
  underweight_severe: "Magreza grave (Grau III)",
  underweight_moderate: "Magreza moderada (Grau II)",
  underweight_mild: "Magreza leve (Grau I)",
  normal: "Eutrofia",
  overweight: "Sobrepeso",
  obese_1: "Obesidade Grau I",
  obese_2: "Obesidade Grau II",
  obese_3: "Obesidade Grau III (mórbida)",
};

export function bmiRounded(weightKg: Decimal.Value, heightCm: Decimal.Value): number {
  return round(calcBMI(weightKg, heightCm), 2);
}
