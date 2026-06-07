// =====================================================================
// Medida caseira automática — referência oficial IBGE POF 2008-2009
// =====================================================================
// Sugere uma medida caseira ("2 colheres de sopa", "1 concha") a partir do
// nome do alimento e da quantidade em gramas. Os pesos por medida vêm da
// "Tabela de Medidas Referidas para os Alimentos Consumidos no Brasil"
// (IBGE, Pesquisa de Orçamentos Familiares 2008-2009) — fonte oficial e de
// domínio público. A TACO (composição) não traz medidas caseiras; a POF é a
// tabela oficial complementar para isso.
//
// IMPORTANTE (segurança clínica):
//   - A medida é uma SUGESTÃO. A quantidade em gramas continua sendo o valor
//     clínico autoritativo, exibido ao lado. O nutricionista revisa e pode
//     sobrescrever qualquer medida (vide householdMeasureAuto no MealItem).
//   - Só sugerimos para alimentos com correspondência confiável por palavra-
//     chave (staples mais prescritos). Para os demais, retornamos null e o
//     nutri preenche manualmente — nunca "chutamos" um peso.
//   - Os gramas-por-medida abaixo são os valores oficiais da POF. Onde a POF
//     lista mais de uma variação (ex.: queijo de minas frescal/light),
//     escolhemos uma medida representativa, documentada na linha.
//
// Casamento por TOKEN exato (não substring), para evitar falsos positivos
// como "maçã" casar com "macarrão". Regras ordenadas do mais específico para
// o mais genérico — a primeira que casar vence.

import { FOOD_MEASURES_BY_EXTERNAL_ID } from "./food-measures-data";

export interface MeasureUnit {
  /** Rótulo no singular, ex.: "colher de sopa". */
  singular: string;
  /** Rótulo no plural, ex.: "colheres de sopa". */
  plural: string;
  /** Peso oficial (POF) de UMA medida, em gramas. */
  gramsPerUnit: number;
}

interface MeasureRule {
  /** Todos estes tokens precisam estar presentes no nome do alimento. */
  all: string[];
  /** Se informado, ao menos UM destes tokens precisa estar presente. */
  any?: string[];
  /** Nenhum destes tokens pode estar presente. */
  not?: string[];
  unit: MeasureUnit;
}

const COLHER_SOPA = (g: number): MeasureUnit => ({
  singular: "colher de sopa",
  plural: "colheres de sopa",
  gramsPerUnit: g,
});
const COLHER_CHA = (g: number): MeasureUnit => ({
  singular: "colher de chá",
  plural: "colheres de chá",
  gramsPerUnit: g,
});
const UNIDADE = (g: number): MeasureUnit => ({
  singular: "unidade",
  plural: "unidades",
  gramsPerUnit: g,
});
const FATIA = (g: number): MeasureUnit => ({
  singular: "fatia",
  plural: "fatias",
  gramsPerUnit: g,
});
const CONCHA = (g: number): MeasureUnit => ({
  singular: "concha",
  plural: "conchas",
  gramsPerUnit: g,
});
const COPO = (g: number): MeasureUnit => ({
  singular: "copo",
  plural: "copos",
  gramsPerUnit: g,
});
const POTE = (g: number): MeasureUnit => ({
  singular: "pote",
  plural: "potes",
  gramsPerUnit: g,
});
const FOLHA = (g: number): MeasureUnit => ({
  singular: "folha",
  plural: "folhas",
  gramsPerUnit: g,
});
const PEDACO = (g: number): MeasureUnit => ({
  singular: "pedaço",
  plural: "pedaços",
  gramsPerUnit: g,
});
const FILE = (g: number): MeasureUnit => ({
  singular: "filé",
  plural: "filés",
  gramsPerUnit: g,
});

// Excludes compartilhados para frutas (evita sucos, doces, bolos, etc.).
const FRUIT_NOT = [
  "suco",
  "nectar",
  "polpa",
  "geleia",
  "doce",
  "bolo",
  "torta",
  "vitamina",
  "passa",
  "seca",
  "desidratada",
  "cristalizada",
  "calda",
  "compota",
  "sorvete",
];

// Ordem: mais específico → mais genérico. Valores em g/medida = POF 2008-2009.
const RULES: MeasureRule[] = [
  // ── Cereais e derivados ─────────────────────────────────────────────
  // ARROZ (POLIDO/PARBOILIZADO/INTEGRAL): colher de sopa = 25 g
  {
    all: ["arroz"],
    not: ["doce", "leite", "carreteiro", "bolo"],
    unit: COLHER_SOPA(25),
  },
  // MACARRÃO cozido: colher de sopa = 25 g
  { all: ["macarrao"], not: ["instantaneo"], unit: COLHER_SOPA(25) },
  // PÃO FRANCÊS / PÃO DE SAL: unidade = 50 g (POF "PÃO DE SAL")
  { all: ["pao"], any: ["frances", "sal"], unit: UNIDADE(50) },
  // PÃO DE FORMA / INTEGRAL: fatia = 25 g
  { all: ["pao"], any: ["forma", "integral"], unit: FATIA(25) },
  // CUSCUZ (de milho): fatia = 135 g
  { all: ["cuscuz"], unit: FATIA(135) },
  // AVEIA (flocos): colher de sopa = 15 g
  { all: ["aveia"], unit: COLHER_SOPA(15) },
  // GRANOLA: colher de sopa = 10 g
  { all: ["granola"], unit: COLHER_SOPA(10) },
  // MILHO VERDE: colher de sopa = 24 g
  {
    all: ["milho"],
    any: ["verde", "conserva", "cozido"],
    unit: COLHER_SOPA(24),
  },
  // FARINHA DE MANDIOCA: colher de sopa = 16 g
  { all: ["farinha", "mandioca"], unit: COLHER_SOPA(16) },

  // ── Leguminosas ─────────────────────────────────────────────────────
  // FEIJÃO (preto/carioca/...): concha = 140 g (com caldo, POF)
  {
    all: ["feijao"],
    not: ["broto", "soja", "vagem", "verde"],
    unit: CONCHA(140),
  },
  // LENTILHA: colher de sopa = 18 g
  { all: ["lentilha"], unit: COLHER_SOPA(18) },
  // GRÃO DE BICO: colher de sopa = 22 g
  { all: ["grao", "bico"], unit: COLHER_SOPA(22) },
  // ERVILHA: colher de sopa = 27 g
  { all: ["ervilha"], unit: COLHER_SOPA(27) },

  // ── Tubérculos / hortaliças ─────────────────────────────────────────
  // BATATA DOCE: fatia = 70 g
  { all: ["batata", "doce"], unit: FATIA(70) },
  // BATATA (inglesa): unidade = 140 g
  {
    all: ["batata"],
    not: ["doce", "palha", "frita", "chips"],
    unit: UNIDADE(140),
  },
  // MANDIOCA / AIPIM / MACAXEIRA: pedaço = 100 g
  { all: ["mandioca"], unit: PEDACO(100) },
  { all: ["aipim"], unit: PEDACO(100) },
  { all: ["macaxeira"], unit: PEDACO(100) },
  // ABÓBORA / JERIMUM: colher de sopa = 36 g
  { all: ["abobora"], not: ["semente", "doce"], unit: COLHER_SOPA(36) },
  { all: ["jerimum"], unit: COLHER_SOPA(36) },
  // BETERRABA (ralada): colher de sopa = 16 g
  { all: ["beterraba"], not: ["suco"], unit: COLHER_SOPA(16) },
  // CENOURA (ralada): colher de sopa = 12 g
  { all: ["cenoura"], not: ["bolo", "suco"], unit: COLHER_SOPA(12) },
  // ALFACE: folha = 10 g
  { all: ["alface"], unit: FOLHA(10) },
  // TOMATE: unidade = 100 g
  {
    all: ["tomate"],
    not: ["molho", "suco", "seco", "extrato"],
    unit: UNIDADE(100),
  },

  // ── Carnes / pescados / ovos ────────────────────────────────────────
  // CARNE MOÍDA: colher de sopa = 25 g
  { all: ["carne"], any: ["moida", "moido"], unit: COLHER_SOPA(25) },
  // CARNE bovina (bife/filé): filé = 100 g
  {
    all: ["carne"],
    not: ["seca", "sol", "charque", "moida", "moido", "enlatada"],
    unit: FILE(100),
  },
  // FRANGO (peito/filé): filé = 100 g
  { all: ["frango"], not: ["caldo", "empanado", "nuggets"], unit: FILE(100) },
  // PEIXE: filé = 120 g
  { all: ["peixe"], not: ["oleo", "empanado"], unit: FILE(120) },
  // OVO de galinha: unidade = 50 g
  {
    all: ["ovo"],
    not: ["codorna", "po", "clara", "gema", "chocolate", "pascoa"],
    unit: UNIDADE(50),
  },

  // ── Leite e derivados ───────────────────────────────────────────────
  // LEITE EM PÓ: colher de sopa = 16 g
  { all: ["leite", "po"], unit: COLHER_SOPA(16) },
  // LEITE líquido: copo = 240 g (copo médio POF)
  {
    all: ["leite"],
    not: ["po", "condensado", "coco", "fermentado", "soja"],
    unit: COPO(240),
  },
  // IOGURTE: pote = 200 g
  { all: ["iogurte"], unit: POTE(200) },
  // QUEIJO MUÇARELA (TACO grafa "muçarela"): fatia = 20 g
  { all: ["queijo"], any: ["mucarela", "mussarela"], unit: FATIA(20) },
  // QUEIJO PRATO: fatia = 15 g
  { all: ["queijo"], any: ["prato"], unit: FATIA(15) },
  // QUEIJO MINAS / FRESCAL: fatia = 30 g
  { all: ["queijo"], any: ["minas", "frescal"], unit: FATIA(30) },
  // REQUEIJÃO: colher de sopa = 30 g
  { all: ["requeijao"], unit: COLHER_SOPA(30) },
  // PRESUNTO: fatia = 15 g
  { all: ["presunto"], unit: FATIA(15) },
  // MANTEIGA: colher de chá = 8 g
  {
    all: ["manteiga"],
    not: ["amendoim", "garrafa", "cacau"],
    unit: COLHER_CHA(8),
  },
  // MARGARINA: colher de chá = 8 g
  { all: ["margarina"], unit: COLHER_CHA(8) },

  // ── Gorduras / açúcar ───────────────────────────────────────────────
  // ÓLEO (soja/girassol/etc.): colher de sopa = 8 g
  { all: ["oleo"], not: ["figado"], unit: COLHER_SOPA(8) },
  // AZEITE: colher de sopa = 8 g
  { all: ["azeite"], not: ["azeitona"], unit: COLHER_SOPA(8) },
  // AÇÚCAR: colher de sopa = 24 g
  { all: ["acucar"], unit: COLHER_SOPA(24) },

  // ── Frutas (cruas) ──────────────────────────────────────────────────
  // BANANA: unidade = 75 g
  {
    all: ["banana"],
    not: [...FRUIT_NOT, "farofa", "terra"],
    unit: UNIDADE(75),
  },
  // MAÇÃ: unidade = 150 g
  { all: ["maca"], not: FRUIT_NOT, unit: UNIDADE(150) },
  // LARANJA: unidade = 180 g
  { all: ["laranja"], not: FRUIT_NOT, unit: UNIDADE(180) },
  // MAMÃO: fatia = 170 g
  { all: ["mamao"], not: FRUIT_NOT, unit: FATIA(170) },
  // MANGA: unidade = 140 g
  { all: ["manga"], not: FRUIT_NOT, unit: UNIDADE(140) },
  // MELANCIA: fatia = 200 g
  { all: ["melancia"], not: FRUIT_NOT, unit: FATIA(200) },
  // MELÃO: fatia = 90 g
  { all: ["melao"], not: FRUIT_NOT, unit: FATIA(90) },
  // ABACAXI: fatia = 75 g
  { all: ["abacaxi"], not: FRUIT_NOT, unit: FATIA(75) },
  // PERA: unidade = 130 g
  { all: ["pera"], not: [...FRUIT_NOT, "nespera"], unit: UNIDADE(130) },
  // GOIABA: unidade = 170 g
  { all: ["goiaba"], not: FRUIT_NOT, unit: UNIDADE(170) },
  // ABACATE: colher de sopa = 45 g
  { all: ["abacate"], not: FRUIT_NOT, unit: COLHER_SOPA(45) },
  // TANGERINA / MEXERICA / MEXIRICA: unidade = 135 g
  { all: ["tangerina"], not: FRUIT_NOT, unit: UNIDADE(135) },
  { all: ["mexerica"], not: FRUIT_NOT, unit: UNIDADE(135) },
  { all: ["mexirica"], not: FRUIT_NOT, unit: UNIDADE(135) },
  // MORANGO: unidade = 12 g
  { all: ["morango"], not: FRUIT_NOT, unit: UNIDADE(12) },
  // UVA: unidade = 8 g
  { all: ["uva"], not: FRUIT_NOT, unit: UNIDADE(8) },
];

/** Remove acentos, baixa caixa. */
function normalize(s: string): string {
  return s
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase();
}

/** Quebra o nome em tokens alfanuméricos. */
function tokenize(name: string): Set<string> {
  return new Set(
    normalize(name)
      .split(/[^a-z0-9]+/)
      .filter(Boolean),
  );
}

function matchesRule(tokens: Set<string>, rule: MeasureRule): boolean {
  for (const t of rule.all) if (!tokens.has(t)) return false;
  if (rule.any && !rule.any.some((t) => tokens.has(t))) return false;
  if (rule.not && rule.not.some((t) => tokens.has(t))) return false;
  return true;
}

/**
 * Encontra a unidade de medida para um alimento.
 * Prioridade: (1) mapa por alimento TACO (externalId) — valores oficiais POF
 * curados e auditados por alimento; (2) regras por palavra-chave (fallback
 * para alimentos custom/sem mapeamento). Retorna null se nada casar.
 */
export function findMeasureUnit(
  foodName: string,
  externalId?: string | null,
): MeasureUnit | null {
  if (externalId) {
    const e = FOOD_MEASURES_BY_EXTERNAL_ID[externalId];
    if (e) {
      return {
        singular: e.singular,
        plural: e.plural,
        gramsPerUnit: e.gramsPerUnit,
      };
    }
  }
  const tokens = tokenize(foodName);
  for (const rule of RULES) {
    if (matchesRule(tokens, rule)) return rule.unit;
  }
  return null;
}

/** Formata uma contagem (0,5 → "½"; 2,5 → "2½"; 3 → "3"). */
function formatCount(n: number): string {
  const whole = Math.floor(n + 1e-9);
  const hasHalf = Math.abs(n - whole - 0.5) < 1e-9;
  if (hasHalf) return whole === 0 ? "½" : `${whole}½`;
  return String(whole);
}

/**
 * Sugere a medida caseira para `quantityG` gramas de um alimento, baseada nos
 * pesos oficiais POF/IBGE. Retorna null quando não há correspondência confiável
 * ou quando a quantidade é pequena/grande demais para a medida fazer sentido.
 *
 * Passe `externalId` (ex.: "TACO_001") para usar o mapa oficial por alimento;
 * sem ele, cai nas regras por palavra-chave.
 *
 * Ex.: suggestHouseholdMeasure("Arroz, integral, cozido", 100) → "5 colheres de sopa"
 *      suggestHouseholdMeasure("Banana, prata, crua", 75)      → "1 unidade"
 *      suggestHouseholdMeasure("Pescada, frita", 80)           → null (sem regra)
 */
export function suggestHouseholdMeasure(
  foodName: string,
  quantityG: number,
  externalId?: string | null,
): string | null {
  if (!Number.isFinite(quantityG) || quantityG <= 0) return null;
  const unit = findMeasureUnit(foodName, externalId);
  if (!unit || unit.gramsPerUnit <= 0) return null;

  // Arredonda para a meia-medida mais próxima.
  const rounded = Math.round((quantityG / unit.gramsPerUnit) * 2) / 2;
  // Pequena demais (< ½) ou grande demais (> 30) → medida deixa de ajudar.
  if (rounded < 0.5 || rounded > 30) return null;

  const label = rounded > 1 ? unit.plural : unit.singular;
  return `${formatCount(rounded)} ${label}`;
}
