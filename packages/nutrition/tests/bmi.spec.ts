import { describe, it, expect } from "vitest";
import { calcBMI, classifyBMI, bmiRounded } from "../src/bmi";

describe("BMI / IMC", () => {
  it("calcula 70kg / 1.70m = 24.22", () => {
    expect(bmiRounded(70, 170)).toBeCloseTo(24.22, 1);
  });

  it("classifica eutrofia 22", () => {
    expect(classifyBMI(22)).toBe("normal");
  });

  it("classifica obesidade grau II em 38", () => {
    expect(classifyBMI(38)).toBe("obese_2");
  });

  it("classifica magreza grave em 15.5", () => {
    expect(classifyBMI(15.5)).toBe("underweight_severe");
  });

  it("classifica magreza leve em 18.4", () => {
    expect(classifyBMI(18.4)).toBe("underweight_mild");
  });

  it("lança erro se altura zero", () => {
    expect(() => calcBMI(70, 0)).toThrow();
  });

  it("lança erro se peso negativo", () => {
    expect(() => calcBMI(-1, 170)).toThrow();
  });

  it("precisão: 75.5kg / 1.78m = 23.83", () => {
    expect(bmiRounded(75.5, 178)).toBe(23.83);
  });
});
