// Conversões + sistema unificado de unidades (decimal.js para precisão clínica)
import Decimal from "decimal.js";

// Configuração: 15 dígitos significativos (mais que suficiente para clínica)
Decimal.set({ precision: 15, rounding: Decimal.ROUND_HALF_UP });

export const D = (v: Decimal.Value): Decimal => new Decimal(v);

export function round(v: Decimal.Value, decimals = 2): number {
  return D(v).toDecimalPlaces(decimals).toNumber();
}

// Massa
export function kgToG(kg: Decimal.Value): Decimal {
  return D(kg).mul(1000);
}
export function gToKg(g: Decimal.Value): Decimal {
  return D(g).div(1000);
}
export function gToMg(g: Decimal.Value): Decimal {
  return D(g).mul(1000);
}

// Comprimento
export function cmToM(cm: Decimal.Value): Decimal {
  return D(cm).div(100);
}
export function mToCm(m: Decimal.Value): Decimal {
  return D(m).mul(100);
}

// Energia
export function kcalToKj(kcal: Decimal.Value): Decimal {
  return D(kcal).mul(4.184);
}
export function kjToKcal(kj: Decimal.Value): Decimal {
  return D(kj).div(4.184);
}
