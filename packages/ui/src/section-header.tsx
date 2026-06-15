import { type ReactNode } from "react";
import { cn } from "./utils";

/**
 * SectionHeader — assinatura editorial do design system.
 *
 * Padrão "Verde Clínico Editorial":
 *   - eyebrow (label) em CAPS espaçado, discreto;
 *   - título em fonte display (Geist) com tracking apertado;
 *   - descrição opcional;
 *   - slot de ação à direita (ex.: "Ver tudo →").
 *
 * Use no topo de cada seção/página para dar ritmo e hierarquia consistentes.
 */
export interface SectionHeaderProps {
  /** Eyebrow em caixa alta (ex.: "HOJE", "PACIENTES"). */
  label?: string;
  title: ReactNode;
  description?: ReactNode;
  /** Conteúdo alinhado à direita (link "ver tudo", botão, contador). */
  action?: ReactNode;
  /** Nível do heading — afeta tamanho e semântica. Default h2. */
  as?: "h1" | "h2" | "h3";
  className?: string;
}

const TITLE_SIZE: Record<NonNullable<SectionHeaderProps["as"]>, string> = {
  h1: "text-h1",
  h2: "text-h2",
  h3: "text-h3",
};

export function SectionHeader({
  label,
  title,
  description,
  action,
  as = "h2",
  className,
}: SectionHeaderProps) {
  const Title = as;
  return (
    <div className={cn("mb-4 flex items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {label ? (
          <p className="section-label flex items-center gap-2">
            <span className="accent-rule" aria-hidden />
            {label}
          </p>
        ) : null}
        <Title
          className={cn(
            "font-display font-semibold tracking-tight text-text-primary",
            TITLE_SIZE[as],
            label ? "mt-1.5" : undefined,
          )}
        >
          {title}
        </Title>
        {description ? (
          <p className="mt-1 max-w-prose text-caption text-text-secondary">
            {description}
          </p>
        ) : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}
