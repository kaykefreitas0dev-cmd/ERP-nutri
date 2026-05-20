"use client";

import Link from "next/link";
import { TrendingUp, TrendingDown, ArrowRight } from "lucide-react";
import { useMemo, type ReactNode } from "react";
import CountUp from "react-countup";
import { Sparkline } from "./Sparkline";

interface Props {
  label: string;
  /** Valor numérico (animado via CountUp). */
  value: number;
  /** Sufixo (ex: "%", "ml"). */
  suffix?: string;
  /** Prefixo (ex: "R$"). */
  prefix?: string;
  /** Casas decimais — útil pra moeda. */
  decimals?: number;
  /**
   * Ícone contextual à direita (revelado em hover).
   *
   * Receba como ReactNode (JSX) porque MetricCard é Client Component:
   * passar a função do componente (`Icon={Users}`) viola
   * server→client serialization no React 19. Use `icon={<Users />}`.
   */
  icon: ReactNode;
  /** Variação vs período anterior (em %). Positivo = up, negativo = down. */
  delta?: number | null;
  /** Texto descritivo abaixo do delta. */
  deltaLabel?: string;
  /** Sub-info (ex: "47 ativos · 12 inativos"). */
  sub?: string;
  /** Destino do click. */
  href?: string;
  /**
   * Dados para sparkline (últimos N períodos).
   * Se ausente, sparkline não é renderizado.
   */
  sparkData?: number[];
  /** Cor da linha sparkline (CSS color ou var()). Default: brand-primary. */
  sparkColor?: string;
}

/**
 * MetricCard — KPI tile do dashboard (spec §VII.3).
 *
 * Composição:
 *  - Label + ícone contextual (ícone opacity 60 → 100 em hover)
 *  - Valor grande animado (CountUp 1.2s)
 *  - Delta opcional com TrendingUp/Down + comparação
 *  - Sub opcional em text-tiny
 *
 * Click navega pra href (relatório detalhado da métrica).
 */
export function MetricCard({
  label,
  value,
  suffix,
  prefix,
  decimals = 0,
  icon,
  delta,
  deltaLabel = "vs mês anterior",
  sub,
  href,
  sparkData,
  sparkColor,
}: Props) {
  const formattedDelta = useMemo(() => {
    if (delta == null) return null;
    const sign = delta > 0 ? "+" : "";
    return `${sign}${delta.toFixed(1)}%`;
  }, [delta]);

  const deltaPositive = delta != null && delta > 0;
  const deltaNegative = delta != null && delta < 0;

  const inner = (
    <>
      <div className="flex items-start justify-between">
        <p className="text-caption font-medium text-text-secondary">{label}</p>
        <div
          aria-hidden
          className="flex h-7 w-7 items-center justify-center rounded-md bg-brand-primary-bg text-brand-primary opacity-0 transition-opacity duration-fast group-hover:opacity-100 [&_svg]:h-4 [&_svg]:w-4"
        >
          {icon}
        </div>
      </div>

      <p className="mt-2 text-display font-semibold tracking-tight tabular-nums text-text-primary">
        {prefix && (
          <span className="text-h2 font-medium text-text-secondary">
            {prefix}{" "}
          </span>
        )}
        <CountUp
          end={value}
          duration={1.2}
          decimals={decimals}
          decimal=","
          separator="."
          preserveValue
        />
        {suffix && (
          <span className="text-h2 font-medium text-text-secondary">
            {" "}
            {suffix}
          </span>
        )}
      </p>

      {delta != null && (
        <div className="mt-1 flex items-center gap-1 text-tiny font-medium">
          {deltaPositive && (
            <TrendingUp className="h-3.5 w-3.5 text-success" strokeWidth={2} />
          )}
          {deltaNegative && (
            <TrendingDown className="h-3.5 w-3.5 text-danger" strokeWidth={2} />
          )}
          <span
            className={
              deltaPositive
                ? "text-success tabular-nums"
                : deltaNegative
                  ? "text-danger tabular-nums"
                  : "text-text-muted tabular-nums"
            }
          >
            {formattedDelta}
          </span>
          <span className="text-text-muted">{deltaLabel}</span>
        </div>
      )}

      {sub && !delta && <p className="mt-1 text-tiny text-text-muted">{sub}</p>}

      {sparkData && sparkData.length >= 2 && (
        <div className="mt-3 h-9 w-full opacity-70 transition-opacity duration-fast group-hover:opacity-100">
          <Sparkline
            data={sparkData}
            color={sparkColor ?? "var(--color-brand-primary)"}
          />
        </div>
      )}
    </>
  );

  if (href) {
    return (
      <Link
        href={href}
        className="group block rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)] transition-all duration-base [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-border-default hover:[box-shadow:var(--shadow-sm)]"
      >
        {inner}
      </Link>
    );
  }

  return (
    <div className="group rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
      {inner}
    </div>
  );
}

/**
 * NavCard — card de navegação grande pra seções principais.
 * Diferente do MetricCard: foca em descrição + CTA, não em métricas.
 */
export function NavCard({
  href,
  title,
  description,
  icon,
}: {
  href: string;
  title: string;
  description: string;
  /** ReactNode (JSX) — passe `<Users />`, não `Users`. */
  icon: ReactNode;
}) {
  return (
    <Link
      href={href}
      className="group block rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)] transition-all duration-base [transition-timing-function:var(--ease-out-expo)] hover:-translate-y-0.5 hover:border-brand-primary/40 hover:[box-shadow:var(--shadow-sm)]"
    >
      <div className="flex items-start justify-between">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-primary-bg text-brand-primary transition-colors group-hover:bg-brand-primary group-hover:text-white [&_svg]:h-5 [&_svg]:w-5">
          {icon}
        </div>
        <ArrowRight
          className="h-4 w-4 text-text-subtle opacity-0 transition-all duration-fast group-hover:translate-x-0.5 group-hover:opacity-100 group-hover:text-brand-primary"
          strokeWidth={2}
        />
      </div>
      <h3 className="mt-3 text-h3 font-semibold text-text-primary">{title}</h3>
      <p className="mt-1 text-caption text-text-secondary">{description}</p>
    </Link>
  );
}
