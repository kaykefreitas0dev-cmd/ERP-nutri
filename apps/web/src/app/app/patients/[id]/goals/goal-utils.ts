// Helpers puros para metas do paciente (compartilhados server + client).
//
// Constantes de domínio ficam AQUI (não em actions.ts) porque um módulo
// "use server" só pode exportar funções async — exportar arrays runtime
// quebra o build do Next.js.

export const GOAL_TYPES = [
  "WEIGHT",
  "BODY_FAT",
  "MEASUREMENT",
  "HABIT",
  "PERFORMANCE",
  "OTHER",
] as const;
export const GOAL_DIRECTIONS = ["DECREASE", "INCREASE", "MAINTAIN"] as const;
export const GOAL_STATUSES = ["ACTIVE", "ACHIEVED", "ABANDONED"] as const;

export type GoalType = (typeof GOAL_TYPES)[number];
export type GoalDirection = (typeof GOAL_DIRECTIONS)[number];
export type GoalStatus = (typeof GOAL_STATUSES)[number];

export interface GoalView {
  id: string;
  title: string;
  description: string | null;
  type: string;
  direction: string;
  startValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  unit: string | null;
  dueDate: string | null; // ISO (YYYY-MM-DD)
  status: string;
  createdAt: string; // ISO
}

export const GOAL_TYPE_LABEL: Record<string, string> = {
  WEIGHT: "Peso",
  BODY_FAT: "% Gordura",
  MEASUREMENT: "Medida",
  HABIT: "Hábito",
  PERFORMANCE: "Performance",
  OTHER: "Outro",
};

export const GOAL_DIRECTION_LABEL: Record<string, string> = {
  DECREASE: "Reduzir",
  INCREASE: "Aumentar",
  MAINTAIN: "Manter",
};

export const GOAL_STATUS_LABEL: Record<string, string> = {
  ACTIVE: "Em andamento",
  ACHIEVED: "Concluída",
  ABANDONED: "Abandonada",
};

function clamp(n: number, min = 0, max = 100): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Progresso 0..100 baseado em início → atual → alvo, respeitando a direção.
 * Retorna null quando não há dados suficientes (sem barra).
 */
export function computeGoalProgress(g: {
  startValue: number | null;
  targetValue: number | null;
  currentValue: number | null;
  direction: string;
}): number | null {
  const s = g.startValue;
  const t = g.targetValue;
  const c = g.currentValue;
  if (s === null || t === null || c === null) return null;

  if (g.direction === "MAINTAIN") {
    const denom = Math.abs(s - t);
    if (denom < 1e-9) return c === t ? 100 : 0;
    return Math.round(clamp(100 - (Math.abs(c - t) / denom) * 100));
  }

  const denom = t - s;
  if (Math.abs(denom) < 1e-9) return c === t ? 100 : 0;
  return Math.round(clamp(((c - s) / denom) * 100));
}

/** Formata um valor numérico de meta com unidade. */
export function formatGoalValue(
  value: number | null,
  unit: string | null,
): string {
  if (value === null) return "—";
  const n = Number.isInteger(value) ? String(value) : value.toFixed(1);
  return unit ? `${n} ${unit}` : n;
}
