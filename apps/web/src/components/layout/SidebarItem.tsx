"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { SimpleTooltip } from "@repo/ui/tooltip";
import { type LucideIcon } from "lucide-react";
import { useSidebarStore } from "./sidebar-store";

interface Props {
  href: string;
  label: string;
  Icon: LucideIcon;
  /** Counter à direita (notificações, pendências). */
  badge?: number | string;
  /** Hint de atalho (mostrado em hover). */
  shortcut?: string;
  /** Match exato vs prefix (default: prefix). */
  exact?: boolean;
}

export function SidebarItem({
  href,
  label,
  Icon,
  badge,
  shortcut,
  exact = false,
}: Props) {
  const pathname = usePathname();
  const collapsed = useSidebarStore((s) => s.collapsed);

  const active = exact
    ? pathname === href
    : pathname === href || pathname.startsWith(href + "/");

  const link = (
    <Link
      href={href}
      data-active={active}
      className={
        "group relative mx-2 flex h-10 items-center gap-3 rounded-md px-3 text-body font-medium transition-all duration-fast " +
        "[transition-timing-function:var(--ease-out-expo)] " +
        (active
          ? "bg-brand-primary-bg text-brand-primary " +
            "before:absolute before:left-0 before:top-1/2 before:h-5 before:w-1 " +
            "before:-translate-y-1/2 before:rounded-r-full before:bg-brand-primary"
          : "text-text-secondary hover:bg-bg-subtle hover:text-text-primary")
      }
    >
      <Icon
        className="h-[18px] w-[18px] shrink-0"
        strokeWidth={1.75}
        aria-hidden
      />
      {!collapsed && (
        <>
          <span className="flex-1 truncate">{label}</span>
          {badge != null && (
            <span
              className={
                "inline-flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-tiny font-semibold tabular-nums " +
                (active
                  ? "bg-brand-primary text-white"
                  : "bg-bg-muted text-text-secondary")
              }
            >
              {badge}
            </span>
          )}
          {shortcut && !badge && (
            <kbd className="hidden h-5 items-center rounded border border-border-subtle bg-bg-muted px-1.5 font-mono text-tiny font-medium text-text-muted group-hover:inline-flex">
              {shortcut}
            </kbd>
          )}
        </>
      )}
    </Link>
  );

  if (collapsed) {
    return (
      <SimpleTooltip content={label} side="right">
        {link}
      </SimpleTooltip>
    );
  }

  return link;
}

/** Section header (uppercase tracking wider). */
export function SidebarSection({ title }: { title: string }) {
  const collapsed = useSidebarStore((s) => s.collapsed);
  if (collapsed) {
    return <div className="mt-4 h-px bg-border-subtle mx-3" aria-hidden />;
  }
  return (
    <div className="mt-4 px-5 pb-1 text-tiny font-semibold uppercase tracking-wider text-text-muted">
      {title}
    </div>
  );
}
