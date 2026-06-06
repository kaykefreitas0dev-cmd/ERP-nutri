"use client";

import { useState, useEffect } from "react";
import {
  Award,
  Sparkles,
  CheckCheck,
  Medal,
  Flame,
  Trophy,
  Target,
  Lock,
  type LucideIcon,
} from "lucide-react";
import {
  getAchievementsAction,
  type Achievement,
} from "@/app/app/conquistas/actions";

const ICONS: Record<string, LucideIcon> = {
  sparkles: Sparkles,
  checkcheck: CheckCheck,
  medal: Medal,
  flame: Flame,
  trophy: Trophy,
  target: Target,
};

export function AchievementsCard() {
  const [items, setItems] = useState<Achievement[] | null>(null);

  useEffect(() => {
    let active = true;
    getAchievementsAction().then((a) => {
      if (active) setItems(a);
    });
    return () => {
      active = false;
    };
  }, []);

  if (items === null || items.length === 0) return null;

  const unlockedCount = items.filter((i) => i.unlocked).length;

  return (
    <section className="mt-6">
      <h2 className="mb-2 flex items-center gap-1.5 text-tiny font-semibold uppercase tracking-wider text-text-muted">
        <Award className="h-3.5 w-3.5" strokeWidth={1.75} />
        Conquistas
        <span className="text-text-subtle tabular-nums">
          ({unlockedCount}/{items.length})
        </span>
      </h2>
      <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {items.map((a) => {
          const Icon = a.unlocked ? (ICONS[a.icon] ?? Award) : Lock;
          const pct =
            a.target > 0 ? Math.round((a.current / a.target) * 100) : 0;
          return (
            <li
              key={a.key}
              className={
                "rounded-lg border p-3 text-center [box-shadow:var(--shadow-xs)] " +
                (a.unlocked
                  ? "border-brand-primary/30 bg-brand-primary-bg"
                  : "border-border-subtle bg-bg-surface opacity-80")
              }
              title={a.description}
            >
              <div
                className={
                  "mx-auto flex h-9 w-9 items-center justify-center rounded-full " +
                  (a.unlocked
                    ? "bg-brand-primary text-white"
                    : "bg-bg-subtle text-text-muted")
                }
              >
                <Icon className="h-[18px] w-[18px]" strokeWidth={1.75} />
              </div>
              <p
                className={
                  "mt-1.5 text-tiny font-semibold " +
                  (a.unlocked ? "text-text-primary" : "text-text-secondary")
                }
              >
                {a.label}
              </p>
              {a.unlocked ? (
                <p className="text-tiny text-brand-primary">Desbloqueada</p>
              ) : (
                <p className="text-tiny text-text-muted tabular-nums">
                  {a.current}/{a.target} ({pct}%)
                </p>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
