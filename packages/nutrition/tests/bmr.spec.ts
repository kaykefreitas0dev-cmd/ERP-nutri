import { describe, it, expect } from "vitest";
import { bmrMifflin, bmrHarris, bmrFao, totalEnergyExpenditure } from "../src/bmr";

describe("BMR / GEB", () => {
  describe("Mifflin-St Jeor", () => {
    it("homem 70kg 175cm 30a = 1648.75", () => {
      const v = bmrMifflin({ weightKg: 70, heightCm: 175, ageYears: 30, sex: "male" });
      expect(v.toNumber()).toBeCloseTo(1648.75, 1);
    });

    it("mulher 60kg 165cm 35a = 1320.5", () => {
      // 10*60 + 6.25*165 - 5*35 - 161 = 600 + 1031.25 - 175 - 161 = 1295.25
      const v = bmrMifflin({ weightKg: 60, heightCm: 165, ageYears: 35, sex: "female" });
      expect(v.toNumber()).toBeCloseTo(1295.25, 1);
    });

    it("rejeita idade negativa", () => {
      expect(() =>
        bmrMifflin({ weightKg: 70, heightCm: 170, ageYears: -1, sex: "male" }),
      ).toThrow();
    });

    it("rejeita idade > 130", () => {
      expect(() =>
        bmrMifflin({ weightKg: 70, heightCm: 170, ageYears: 131, sex: "male" }),
      ).toThrow();
    });
  });

  describe("Harris-Benedict revisada", () => {
    it("homem 70kg 175cm 30a ≈ 1695.7", () => {
      // 88.362 + 13.397*70 + 4.799*175 - 5.677*30
      // = 88.362 + 937.79 + 839.825 - 170.31 = 1695.667
      const v = bmrHarris({ weightKg: 70, heightCm: 175, ageYears: 30, sex: "male" });
      expect(v.toNumber()).toBeCloseTo(1695.67, 1);
    });

    it("mulher 60kg 165cm 35a", () => {
      // 447.593 + 9.247*60 + 3.098*165 - 4.330*35
      // = 447.593 + 554.82 + 511.17 - 151.55 = 1362.033
      const v = bmrHarris({ weightKg: 60, heightCm: 165, ageYears: 35, sex: "female" });
      expect(v.toNumber()).toBeCloseTo(1362.03, 1);
    });
  });

  describe("FAO/OMS por faixa etária", () => {
    it("homem 25 anos 70kg (banda 18-30: 15.3*70 + 679 = 1750)", () => {
      const v = bmrFao({ weightKg: 70, heightCm: 175, ageYears: 25, sex: "male" });
      expect(v.toNumber()).toBeCloseTo(1750, 1);
    });

    it("mulher 35 anos 60kg (banda 30-60: 8.7*60 + 829 = 1351)", () => {
      const v = bmrFao({ weightKg: 60, heightCm: 165, ageYears: 35, sex: "female" });
      expect(v.toNumber()).toBeCloseTo(1351, 1);
    });

    it("criança 2 anos 12kg (banda 0-3 masc: 60.9*12 - 54 = 676.8)", () => {
      const v = bmrFao({ weightKg: 12, heightCm: 85, ageYears: 2, sex: "male" });
      expect(v.toNumber()).toBeCloseTo(676.8, 1);
    });
  });

  describe("Total Energy Expenditure (PAL)", () => {
    it("BMR 1500 * sedentário (1.2) = 1800", () => {
      expect(totalEnergyExpenditure(1500, "SEDENTARY").toNumber()).toBe(1800);
    });

    it("BMR 2000 * ativo (1.725) = 3450", () => {
      expect(totalEnergyExpenditure(2000, "ACTIVE").toNumber()).toBe(3450);
    });
  });
});
