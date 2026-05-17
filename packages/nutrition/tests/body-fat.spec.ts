import { describe, it, expect } from "vitest";
import {
  densityPollock3,
  densityToBodyFatSiri,
  calcBodyFat,
} from "../src/body-fat";

describe("Body Fat - Pollock 3 dobras", () => {
  it("homem 25 anos, dobras 15+25+18 = 58mm → ~14-15% GC", () => {
    const result = calcBodyFat(
      "pollock_3",
      { chest: 15, abdominal: 25, thigh: 18 },
      25,
      "male",
      75,
    );
    // Validação aproximada (literatura)
    expect(result.bodyFatPct).toBeGreaterThan(10);
    expect(result.bodyFatPct).toBeLessThan(20);
    expect(result.fatMassKg + result.leanMassKg).toBeCloseTo(75, 0);
  });

  it("mulher 30 anos, dobras 18+22+25 = 65mm → ~22-26% GC", () => {
    const result = calcBodyFat(
      "pollock_3",
      { triceps: 18, suprailiac: 22, thigh: 25 },
      30,
      "female",
      60,
    );
    expect(result.bodyFatPct).toBeGreaterThan(20);
    expect(result.bodyFatPct).toBeLessThan(28);
    expect(result.fatMassKg + result.leanMassKg).toBeCloseTo(60, 0);
  });

  it("Siri density → %GC conversion", () => {
    // densidade 1.05 → %GC = 495/1.05 - 450 = 21.43
    expect(densityToBodyFatSiri(1.05).toNumber()).toBeCloseTo(21.43, 1);
  });

  it("rejeita soma dobras zero", () => {
    expect(() => densityPollock3({ chest: 0, abdominal: 0, thigh: 0 }, 30, "male")).toThrow();
  });
});

describe("Body Fat - Pollock 7 dobras", () => {
  it("atleta masculino 25a, soma ~100mm → ~8-12% GC", () => {
    const result = calcBodyFat(
      "pollock_7",
      {
        chest: 10,
        midaxillary: 12,
        triceps: 8,
        subscapular: 14,
        abdominal: 18,
        suprailiac: 14,
        thigh: 16,
      },
      25,
      "male",
      80,
    );
    expect(result.bodyFatPct).toBeGreaterThan(5);
    expect(result.bodyFatPct).toBeLessThan(15);
  });
});
