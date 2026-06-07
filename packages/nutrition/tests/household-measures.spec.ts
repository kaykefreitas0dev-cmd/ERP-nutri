import { describe, it, expect } from "vitest";
import {
  suggestHouseholdMeasure,
  findMeasureUnit,
} from "../src/household-measures";

// Valores de referência: IBGE POF 2008-2009 "Tabela de Medidas Referidas".
// Os pesos por medida abaixo são os oficiais; os testes garantem que a
// contagem e o casamento por token continuam corretos.

describe("suggestHouseholdMeasure — staples (valores oficiais POF)", () => {
  it("arroz cozido: 25 g por colher de sopa", () => {
    expect(suggestHouseholdMeasure("Arroz, integral, cozido", 100)).toBe(
      "4 colheres de sopa",
    );
    expect(suggestHouseholdMeasure("Arroz, tipo 1, cozido", 25)).toBe(
      "1 colher de sopa",
    );
  });

  it("feijão: 140 g por concha (com caldo)", () => {
    expect(suggestHouseholdMeasure("Feijão, carioca, cozido", 140)).toBe(
      "1 concha",
    );
    expect(suggestHouseholdMeasure("Feijão, preto, cozido", 70)).toBe(
      "½ concha",
    );
  });

  it("pão francês: 50 g por unidade", () => {
    expect(suggestHouseholdMeasure("Pão, francês", 50)).toBe("1 unidade");
    expect(suggestHouseholdMeasure("Pão, francês", 100)).toBe("2 unidades");
  });

  it("pão de forma / integral: 25 g por fatia", () => {
    expect(suggestHouseholdMeasure("Pão, de forma, integral", 50)).toBe(
      "2 fatias",
    );
  });

  it("leite líquido: 240 g por copo", () => {
    expect(suggestHouseholdMeasure("Leite, de vaca, integral", 240)).toBe(
      "1 copo",
    );
  });

  it("ovo de galinha: 50 g por unidade", () => {
    expect(
      suggestHouseholdMeasure("Ovo, de galinha, inteiro, cozido", 100),
    ).toBe("2 unidades");
  });

  it("banana: 75 g por unidade", () => {
    expect(suggestHouseholdMeasure("Banana, prata, crua", 75)).toBe(
      "1 unidade",
    );
  });

  it("queijo muçarela (grafia TACO): 20 g por fatia", () => {
    expect(suggestHouseholdMeasure("Queijo, muçarela", 40)).toBe("2 fatias");
  });

  it("carne moída usa colher de sopa, não filé", () => {
    expect(
      findMeasureUnit("Carne, bovina, acém, moído, cozido")?.singular,
    ).toBe("colher de sopa");
    expect(
      findMeasureUnit("Carne, bovina, contra-filé, grelhada")?.singular,
    ).toBe("filé");
  });
});

describe("suggestHouseholdMeasure — segurança (sem falsos positivos)", () => {
  it('"maçã" não casa com "macarrão" (token exato)', () => {
    expect(findMeasureUnit("Maçã, Fuji, com casca, crua")?.singular).toBe(
      "unidade",
    );
    // macarrão tem regra própria (colher de sopa), não a de maçã (unidade)
    expect(findMeasureUnit("Macarrão, trigo, cru")?.singular).toBe(
      "colher de sopa",
    );
  });

  it("sucos/molhos/doces de frutas não recebem medida de fruta", () => {
    expect(suggestHouseholdMeasure("Suco, de maçã, integral", 200)).toBeNull();
    expect(
      suggestHouseholdMeasure("Molho, de tomate, industrializado", 30),
    ).toBeNull();
  });

  it("clara/gema de ovo não recebem a medida do ovo inteiro", () => {
    expect(suggestHouseholdMeasure("Ovo, de galinha, clara", 30)).toBeNull();
  });

  it("alimentos sem regra confiável retornam null (preenchimento manual)", () => {
    expect(suggestHouseholdMeasure("Pescada, frita", 80)).toBeNull();
    expect(suggestHouseholdMeasure("Farinha, de trigo", 20)).toBeNull();
  });
});

describe("suggestHouseholdMeasure — formatação e limites", () => {
  it("arredonda para a meia-medida mais próxima", () => {
    // 60 g / 25 g = 2,4 → 2,5 → "2½ colheres de sopa"
    expect(suggestHouseholdMeasure("Arroz, tipo 1, cozido", 60)).toBe(
      "2½ colheres de sopa",
    );
  });

  it("quantidade pequena demais (< ½ medida) retorna null", () => {
    // 5 g / 25 g = 0,2 → arredonda para 0 → null
    expect(suggestHouseholdMeasure("Arroz, tipo 1, cozido", 5)).toBeNull();
  });

  it("quantidade não positiva retorna null", () => {
    expect(suggestHouseholdMeasure("Arroz, tipo 1, cozido", 0)).toBeNull();
    expect(suggestHouseholdMeasure("Arroz, tipo 1, cozido", -10)).toBeNull();
  });

  it("singular para 1 e ½; plural acima de 1", () => {
    expect(suggestHouseholdMeasure("Pão, francês", 25)).toBe("½ unidade");
    expect(suggestHouseholdMeasure("Pão, francês", 50)).toBe("1 unidade");
    expect(suggestHouseholdMeasure("Pão, francês", 100)).toBe("2 unidades");
  });
});
