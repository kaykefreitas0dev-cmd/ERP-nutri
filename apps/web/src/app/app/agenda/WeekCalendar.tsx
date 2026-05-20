"use client";

import Link from "next/link";

// ── Layout constants ────────────────────────────────────────────────────────
const HOUR_START = 7; // 07:00
const HOUR_END = 20; // 20:00
const PX_PER_MIN = 1.2; // 72 px per hour → 936 px total
const TOTAL_MIN = (HOUR_END - HOUR_START) * 60;
const TOTAL_HEIGHT = TOTAL_MIN * PX_PER_MIN;

const WEEKDAY_PT = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

// ── Status color map ────────────────────────────────────────────────────────
const STATUS_COLOR: Record<string, string> = {
  SCHEDULED: "border-info/40 bg-info/10 text-info",
  CONFIRMED: "border-brand-200 bg-brand-primary-bg text-brand-700",
  CHECKED_IN: "border-brand-600 bg-brand-primary text-white",
  COMPLETED: "border-success/40 bg-success-bg text-success",
  CANCELLED: "border-border-subtle bg-bg-subtle text-text-muted",
  NO_SHOW: "border-danger/40 bg-danger-bg text-danger",
};

// ── Types ───────────────────────────────────────────────────────────────────
export interface WeekAppointment {
  id: string;
  startsAt: Date | string;
  endsAt: Date | string;
  status: string;
  modality: string;
  patientId: string | null;
  patientName: string | null;
  externalPatientName: string | null;
  notes: string | null;
}

interface Props {
  appointments: WeekAppointment[];
  weekStart: string; // YYYY-MM-DD (Monday)
  todayStr: string; // YYYY-MM-DD
}

// ── Helpers ─────────────────────────────────────────────────────────────────
function getApptStyle(
  startsAt: string | Date,
  endsAt: string | Date,
): { top: number; height: number } {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  const startMin = start.getHours() * 60 + start.getMinutes() - HOUR_START * 60;
  const durationMin = Math.max(15, (end.getTime() - start.getTime()) / 60_000);
  const clampedStart = Math.max(0, Math.min(startMin, TOTAL_MIN));
  const clampedDuration = Math.min(durationMin, TOTAL_MIN - clampedStart);
  return {
    top: clampedStart * PX_PER_MIN,
    height: Math.max(18, clampedDuration * PX_PER_MIN),
  };
}

// Assign non-overlapping horizontal lanes within a day column.
function assignLanes(
  appts: WeekAppointment[],
): (WeekAppointment & { lane: number; totalLanes: number })[] {
  const sorted = [...appts].sort(
    (a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime(),
  );
  const laneEnds: number[] = [];
  const staged: (WeekAppointment & { lane: number })[] = [];

  for (const appt of sorted) {
    const start = new Date(appt.startsAt).getTime();
    const end = new Date(appt.endsAt).getTime();
    let lane = laneEnds.findIndex((e) => e <= start);
    if (lane === -1) lane = laneEnds.length;
    laneEnds[lane] = end;
    staged.push({ ...appt, lane });
  }

  // Second pass: figure out total concurrent lanes per appointment
  const result = staged.map((appt) => {
    const start = new Date(appt.startsAt).getTime();
    const end = new Date(appt.endsAt).getTime();
    const concurrent = staged.filter((other) => {
      const os = new Date(other.startsAt).getTime();
      const oe = new Date(other.endsAt).getTime();
      return !(oe <= start || os >= end);
    });
    return { ...appt, totalLanes: Math.max(concurrent.length, 1) };
  });

  return result;
}

// ── Component ────────────────────────────────────────────────────────────────
export function WeekCalendar({ appointments, weekStart, todayStr }: Props) {
  // Build the 7 day objects (Mon–Sun)
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart + "T00:00:00");
    d.setDate(d.getDate() + i);
    return d;
  });

  // Group appointments by day key
  const byDay = new Map<string, WeekAppointment[]>();
  for (const day of days) {
    byDay.set(day.toISOString().slice(0, 10), []);
  }
  for (const appt of appointments) {
    const key = new Date(appt.startsAt).toISOString().slice(0, 10);
    const list = byDay.get(key);
    if (list) list.push(appt);
  }

  // Hour labels (full hours only)
  const hourLabels = Array.from(
    { length: HOUR_END - HOUR_START },
    (_, i) => HOUR_START + i,
  );

  return (
    <div className="overflow-x-auto rounded-lg border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-xs)]">
      <div className="min-w-[640px]">
        {/* ── Day header row ── */}
        <div
          className="grid border-b border-border-subtle"
          style={{ gridTemplateColumns: "52px repeat(7, 1fr)" }}
        >
          <div className="h-12 border-r border-border-subtle/40" />
          {days.map((day) => {
            const dayStr = day.toISOString().slice(0, 10);
            const isToday = dayStr === todayStr;
            const count = (byDay.get(dayStr) ?? []).filter(
              (a) => a.status !== "CANCELLED",
            ).length;

            return (
              <div
                key={dayStr}
                className="flex h-12 flex-col items-center justify-center border-l border-border-subtle/40"
              >
                <span className="text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                  {WEEKDAY_PT[day.getDay()]}
                </span>
                <div className="mt-0.5 flex items-center gap-1">
                  <Link
                    href={`/app/agenda?date=${dayStr}&view=day`}
                    className={
                      "flex h-6 w-6 items-center justify-center rounded-full text-tiny font-semibold transition-colors hover:bg-bg-subtle " +
                      (isToday
                        ? "bg-brand-primary text-white hover:bg-brand-primary-hover"
                        : "text-text-primary")
                    }
                  >
                    {day.getDate()}
                  </Link>
                  {count > 0 && (
                    <span className="flex h-4 min-w-[16px] items-center justify-center rounded-full bg-brand-primary-bg px-1 text-[10px] font-medium tabular-nums text-brand-primary">
                      {count}
                    </span>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* ── Time grid ── */}
        <div
          className="relative grid select-none overflow-y-auto"
          style={{
            gridTemplateColumns: "52px repeat(7, 1fr)",
            height: "min(calc(100vh - 280px), 720px)",
          }}
        >
          {/* Sticky left: time labels column (position context) */}
          <div
            className="pointer-events-none sticky left-0 z-20 border-r border-border-subtle/40 bg-bg-surface"
            style={{ height: `${TOTAL_HEIGHT}px` }}
          >
            {hourLabels.map((hour) => (
              <div
                key={hour}
                className="absolute right-2 text-right"
                style={{
                  top: `${(hour - HOUR_START) * 60 * PX_PER_MIN - 8}px`,
                }}
              >
                <span className="text-[10px] tabular-nums text-text-muted">
                  {String(hour).padStart(2, "0")}:00
                </span>
              </div>
            ))}
          </div>

          {/* Seven day columns */}
          {days.map((day) => {
            const dayStr = day.toISOString().slice(0, 10);
            const dayAppts = byDay.get(dayStr) ?? [];
            const laid = assignLanes(dayAppts);
            const isToday = dayStr === todayStr;

            return (
              <div
                key={dayStr}
                className={
                  "relative border-l border-border-subtle/40 " +
                  (isToday ? "bg-brand-primary-bg/20" : "")
                }
                style={{ height: `${TOTAL_HEIGHT}px` }}
              >
                {/* Hour lines */}
                {hourLabels.map((hour) => (
                  <div
                    key={hour}
                    className="pointer-events-none absolute inset-x-0 border-t border-border-subtle/50"
                    style={{
                      top: `${(hour - HOUR_START) * 60 * PX_PER_MIN}px`,
                    }}
                  />
                ))}
                {/* 30-min lines */}
                {hourLabels.map((hour) => (
                  <div
                    key={`${hour}h30`}
                    className="pointer-events-none absolute inset-x-0 border-t border-border-subtle/25"
                    style={{
                      top: `${((hour - HOUR_START) * 60 + 30) * PX_PER_MIN}px`,
                    }}
                  />
                ))}

                {/* Appointment blocks */}
                {laid.map((appt) => {
                  const { top, height } = getApptStyle(
                    appt.startsAt,
                    appt.endsAt,
                  );
                  const widthPct = 100 / appt.totalLanes;
                  const leftPct = appt.lane * widthPct;
                  const colorClass =
                    STATUS_COLOR[appt.status] ??
                    "border-border-subtle bg-bg-subtle text-text-secondary";
                  const patientName =
                    appt.patientName ?? appt.externalPatientName ?? "—";
                  const timeStr = new Date(appt.startsAt).toLocaleTimeString(
                    "pt-BR",
                    { hour: "2-digit", minute: "2-digit" },
                  );

                  return (
                    <Link
                      key={appt.id}
                      href={`/app/agenda?date=${dayStr}&view=day`}
                      title={`${timeStr} — ${patientName}`}
                      className={
                        "absolute overflow-hidden rounded border px-1.5 py-0.5 text-[11px] transition-opacity hover:opacity-75 " +
                        colorClass
                      }
                      style={{
                        top: `${top}px`,
                        height: `${height}px`,
                        left: `${leftPct + 1}%`,
                        width: `${widthPct - 2}%`,
                      }}
                    >
                      {height >= 32 ? (
                        <>
                          <span className="block font-semibold tabular-nums leading-tight">
                            {timeStr}
                          </span>
                          <span className="block truncate leading-tight opacity-80">
                            {patientName}
                          </span>
                        </>
                      ) : (
                        <span className="block truncate font-semibold tabular-nums leading-tight">
                          {timeStr} {patientName}
                        </span>
                      )}
                    </Link>
                  );
                })}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
