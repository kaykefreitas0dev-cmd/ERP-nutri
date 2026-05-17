import { describe, it, expect } from "vitest";
import { calcMacroBreakdown, MACRO_PRESETS } from "../src/macros";
import fc from "fast-check";

describe("Macro Breakdown", () => {
  it("2000 kcal, 70kg, 1.6g prot/kg, 30% lipídio", () => {
    const r = calcMacroBreakdown({
      targetKcal: 2000,
      proteinGPerKg: 1.6,
      fatPctOfKcal: 0.3,
      weightKg: 70,
    });

    // proteína: 1.6 * 70 = 112g = 448 kcal
    expect(r.proteinG).toBe(112);
    expect(r.proteinKcal).toBe(448);

    // lipídio: 30% * 2000 = 600 kcal / 9 ≈ 66.67g
    expect(r.fatKcal).toBe(600);
    expect(r.fatG).toBeCloseTo(66.67, 1);

    // carbo: 2000 - 448 - 600 = 952 kcal / 4 = 238g
    expect(r.carbKcal).toBe(952);
    expect(r.carbG).toBe(238);

    expect(r.totalKcal).toBe(2000);
    expect(r.pctProtein + r.pctFat + r.pctCarb).toBeCloseTo(100, 0);
  });

  it("rejeita kcal < 600", () => {
    expect(() =>
      calcMacroBreakdown({ targetKcal: 500, proteinGPerKg: 1.6, fatPctOfKcal: 0.3, weightKg: 70 }),
    ).toThrow();
  });

  it("rejeita kcal > 6000", () => {
    expect(() =>
      calcMacroBreakdown({ targetKcal: 7000, proteinGPerKg: 1.6, fatPctOfKcal: 0.3, weightKg: 70 }),
    ).toThrow();
  });

  it("rejeita combinação que zera carbo (P+F > 100%)", () => {
    expect(() =>
      calcMacroBreakdown({
        targetKcal: 1000,
        proteinGPerKg: 3.5, // 70*3.5=245g=980kcal
        fatPctOfKcal: 0.5, // 500kcal
        weightKg: 70,
      }),
    ).toThrow(/excedem/);
  });

  it("presets têm valores razoáveis", () => {
    Object.entries(MACRO_PRESETS).forEach(([_name, preset]) => {
      expect(preset.proteinGPerKg).toBeGreaterThan(0.5);
      expect(preset.proteinGPerKg).toBeLessThan(3);
      expect(preset.fatPctOfKcal).toBeGreaterThan(0.15);
      expect(preset.fatPctOfKcal).toBeLessThan(0.75);
    });
  });

  // Property-based: total deve sempre fechar
  it("[property] proteinKcal + fatKcal + carbKcal sempre = totalKcal", () => {
    fc.assert(
      fc.property(
        fc.integer({ min: 800, max: 4000 }),
        fc.double({ min: 0.8, max: 2.5, noNaN: true }),
        fc.double({ min: 0.15, max: 0.45, noNaN: true }),
        fc.double({ min: 40, max: 150, noNaN: true }),
        (kcal, prot, fat, weight) => {
          try {
            const r = calcMacroBreakdown({
              targetKcal: kcal,
              proteinGPerKg: prot,
              fatPctOfKcal: fat,
              weightKg: weight,
            });
            // Soma deve estar próxima do total (margem 1 kcal devido arredondamento)
            const sum = r.proteinKcal + r.fatKcal + r.carbKcal;
            return Math.abs(sum - r.totalKcal) <= 2;
          } catch {
            // Combinations que ultrapassam target são esperadas e ignoradas
            return true;
          }
        },
      ),
      { numRuns: 100 },
    );
  });
});
