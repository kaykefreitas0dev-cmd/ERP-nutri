"use client";

import { useState, useTransition, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import {
  MapPin,
  Video,
  Phone,
  CircleCheck,
  Calendar,
  Pencil,
  TriangleAlert,
  type LucideIcon,
} from "lucide-react";
import { Badge } from "@repo/ui/badge";
import { Avatar } from "@repo/ui/avatar";
import { StatusDot } from "@repo/ui/status-dot";
import { updateAppointmentStatusAction } from "./actions";
import { CompleteWithPaymentModal } from "./CompleteWithPaymentModal";
import { EditAppointmentModal } from "./EditAppointmentModal";

interface Appointment {
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
  appointments: Appointment[];
}

type BadgeVariant =
  | "neutral"
  | "info"
  | "primary"
  | "success"
  | "warning"
  | "danger";

interface StatusInfo {
  label: string;
  variant: BadgeVariant;
  dot?: "active" | "warning" | "danger" | "inactive" | "info";
}

const STATUS_INFO: Record<string, StatusInfo> = {
  SCHEDULED: { label: "Agendado", variant: "info", dot: "info" },
  CONFIRMED: { label: "Confirmado", variant: "primary", dot: "active" },
  CHECKED_IN: { label: "Check-in", variant: "info", dot: "info" },
  COMPLETED: { label: "Realizada", variant: "success", dot: "active" },
  CANCELLED: { label: "Cancelada", variant: "neutral", dot: "inactive" },
  NO_SHOW: { label: "No-show", variant: "danger", dot: "danger" },
};

const MODALITY: Record<string, { Icon: LucideIcon; label: string }> = {
  in_person: { Icon: MapPin, label: "Presencial" },
  video: { Icon: Video, label: "Vídeo" },
  phone: { Icon: Phone, label: "Telefone" },
};

type OverlayType = "CANCEL" | "NO_SHOW";

interface OverlayAction {
  type: OverlayType;
  appointmentId: string;
}

const OVERLAY_CONFIG: Record<
  OverlayType,
  { title: string; placeholder: string; confirmTone: "danger" | "warning" }
> = {
  CANCEL: {
    title: "Cancelar consulta?",
    placeholder: "Motivo (opcional)",
    confirmTone: "danger",
  },
  NO_SHOW: {
    title: "Marcar como No-show?",
    placeholder: "Observação (opcional)",
    confirmTone: "danger",
  },
};

export function AppointmentList({ appointments }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [updatingId, setUpdatingId] = useState<string | null>(null);
  const [payingAppt, setPayingAppt] = useState<Appointment | null>(null);
  const [editingAppt, setEditingAppt] = useState<Appointment | null>(null);
  const [overlayAction, setOverlayAction] = useState<OverlayAction | null>(
    null,
  );
  const [overlayReason, setOverlayReason] = useState<string>("");
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const errorTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-dismiss error banner after 6 seconds
  useEffect(() => {
    if (!errorMsg) return;
    errorTimerRef.current = setTimeout(() => setErrorMsg(null), 6_000);
    return () => {
      if (errorTimerRef.current) clearTimeout(errorTimerRef.current);
    };
  }, [errorMsg]);

  function updateStatus(
    appointmentId: string,
    toStatus: Parameters<typeof updateAppointmentStatusAction>[0]["toStatus"],
    reason?: string,
  ) {
    setUpdatingId(appointmentId);
    startTransition(async () => {
      const result = await updateAppointmentStatusAction({
        appointmentId,
        toStatus,
        reason: reason || undefined,
      });
      setUpdatingId(null);
      if (!result.ok)
        setErrorMsg(result.message ?? "Erro ao atualizar consulta");
      else router.refresh();
    });
  }

  function startOverlay(type: OverlayType, appointmentId: string) {
    setOverlayAction({ type, appointmentId });
    setOverlayReason("");
  }

  function confirmOverlay() {
    if (!overlayAction) return;
    const { type, appointmentId } = overlayAction;
    setOverlayAction(null);
    const toStatus = type === "CANCEL" ? "CANCELLED" : "NO_SHOW";
    updateStatus(appointmentId, toStatus, overlayReason);
  }

  function abortOverlay() {
    setOverlayAction(null);
    setOverlayReason("");
  }

  if (appointments.length === 0) {
    return (
      <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-12 text-center">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
          <Calendar className="h-5 w-5" strokeWidth={1.75} />
        </div>
        <h2 className="mt-4 text-h3 font-semibold text-text-primary">
          Nenhuma consulta agendada
        </h2>
        <p className="mt-1 text-caption text-text-secondary">
          Use o formulário ao lado para criar uma nova consulta.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-2.5">
      {/* Inline error banner (replaces alert()) */}
      {errorMsg && (
        <div
          role="alert"
          className="flex items-center gap-2 rounded-lg border border-danger-border bg-danger-bg px-4 py-3 text-caption text-danger"
        >
          <TriangleAlert className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          <span className="flex-1">{errorMsg}</span>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            aria-label="Fechar"
            className="rounded p-0.5 hover:bg-danger/10"
          >
            ×
          </button>
        </div>
      )}
      <ul className="space-y-2.5">
        {appointments.map((apt) => {
          const start = new Date(apt.startsAt);
          const end = new Date(apt.endsAt);
          const info = STATUS_INFO[apt.status] ?? {
            label: apt.status,
            variant: "neutral" as const,
          };
          const mod = MODALITY[apt.modality];
          const patientName =
            apt.patientName ?? apt.externalPatientName ?? "(sem paciente)";
          const isCompleted = apt.status === "COMPLETED";
          const isCancelled = apt.status === "CANCELLED";

          return (
            <li
              key={apt.id}
              className={
                "relative rounded-lg border bg-bg-surface p-4 transition-all duration-fast " +
                (isCancelled
                  ? "border-border-subtle opacity-60"
                  : isCompleted
                    ? "border-border-subtle [box-shadow:var(--shadow-xs)]"
                    : "border-border-subtle [box-shadow:var(--shadow-xs)] hover:[box-shadow:var(--shadow-sm)]")
              }
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-start gap-3 min-w-0">
                  {/* Horário */}
                  <div className="flex flex-col items-center min-w-[56px] rounded-md bg-bg-subtle px-2 py-2 text-text-primary">
                    <span className="text-h3 font-semibold tabular-nums leading-tight">
                      {start.toLocaleTimeString("pt-BR", {
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </span>
                    <span className="text-[10px] text-text-muted tabular-nums">
                      {Math.round((end.getTime() - start.getTime()) / 60_000)}{" "}
                      min
                    </span>
                  </div>

                  {/* Paciente + meta */}
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {apt.patientId && <Avatar name={patientName} size="xs" />}
                      <span className="text-body font-medium text-text-primary truncate">
                        {patientName}
                      </span>
                      <Badge
                        variant={info.variant}
                        leftIcon={
                          info.dot ? (
                            <StatusDot
                              status={info.dot}
                              pulse={apt.status === "CONFIRMED"}
                              size={1.5}
                            />
                          ) : undefined
                        }
                      >
                        {info.label}
                      </Badge>
                    </div>
                    {mod && (
                      <p className="mt-1 inline-flex items-center gap-1 text-caption text-text-muted">
                        <mod.Icon
                          className="h-3.5 w-3.5"
                          strokeWidth={1.75}
                          aria-hidden
                        />
                        {mod.label}
                      </p>
                    )}
                    {apt.notes && (
                      <p className="mt-1 text-caption text-text-secondary line-clamp-2">
                        {apt.notes}
                      </p>
                    )}
                  </div>
                </div>

                {/* Inline overlay: Cancel / No-show with optional reason */}
                {overlayAction?.appointmentId === apt.id && (
                  <div className="absolute inset-x-0 bottom-0 top-0 z-10 flex items-center justify-between gap-3 rounded-lg border border-danger-border bg-bg-surface px-4 py-3 [box-shadow:var(--shadow-sm)]">
                    <div className="min-w-0 flex-1">
                      <p className="text-caption font-medium text-danger">
                        {OVERLAY_CONFIG[overlayAction.type].title}
                      </p>
                      <input
                        type="text"
                        value={overlayReason}
                        onChange={(e) => setOverlayReason(e.target.value)}
                        placeholder={
                          OVERLAY_CONFIG[overlayAction.type].placeholder
                        }
                        maxLength={200}
                        autoFocus
                        onKeyDown={(e) => {
                          if (e.key === "Enter") confirmOverlay();
                          if (e.key === "Escape") abortOverlay();
                        }}
                        className="mt-1 w-full rounded-md border border-border-default bg-bg-surface px-2 py-1 text-caption text-text-primary placeholder:text-text-muted focus:border-danger focus:outline-none focus:[box-shadow:0_0_0_2px_rgb(239_68_68/0.2)]"
                      />
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <ActionButton
                        onClick={confirmOverlay}
                        disabled={pending && updatingId === apt.id}
                        tone="danger"
                      >
                        Confirmar
                      </ActionButton>
                      <ActionButton
                        onClick={abortOverlay}
                        disabled={false}
                        tone="ghost"
                      >
                        Voltar
                      </ActionButton>
                    </div>
                  </div>
                )}

                {/* Ações */}
                <div className="flex shrink-0 flex-col gap-1">
                  {/* Edit button — available for non-terminal statuses */}
                  {!isCompleted && !isCancelled && apt.status !== "NO_SHOW" && (
                    <ActionButton
                      onClick={() => setEditingAppt(apt)}
                      disabled={pending && updatingId === apt.id}
                      tone="ghost"
                      icon={<Pencil className="h-3 w-3" strokeWidth={2} />}
                    >
                      Editar
                    </ActionButton>
                  )}
                  {apt.status === "SCHEDULED" && (
                    <>
                      <ActionButton
                        onClick={() => updateStatus(apt.id, "CONFIRMED")}
                        disabled={pending && updatingId === apt.id}
                        tone="primary"
                      >
                        Confirmar
                      </ActionButton>
                      <ActionButton
                        onClick={() => startOverlay("CANCEL", apt.id)}
                        disabled={pending && updatingId === apt.id}
                        tone="ghost"
                      >
                        Cancelar
                      </ActionButton>
                    </>
                  )}
                  {apt.status === "CONFIRMED" && (
                    <>
                      <ActionButton
                        onClick={() => updateStatus(apt.id, "CHECKED_IN")}
                        disabled={pending && updatingId === apt.id}
                        tone="info"
                      >
                        Check-in
                      </ActionButton>
                      <ActionButton
                        onClick={() => startOverlay("NO_SHOW", apt.id)}
                        disabled={pending && updatingId === apt.id}
                        tone="danger"
                      >
                        No-show
                      </ActionButton>
                      <ActionButton
                        onClick={() => startOverlay("CANCEL", apt.id)}
                        disabled={pending && updatingId === apt.id}
                        tone="ghost"
                      >
                        Cancelar
                      </ActionButton>
                    </>
                  )}
                  {(apt.status === "CHECKED_IN" ||
                    apt.status === "CONFIRMED" ||
                    apt.status === "SCHEDULED") && (
                    <>
                      {apt.patientId ? (
                        <ActionButton
                          onClick={() => setPayingAppt(apt)}
                          disabled={pending && updatingId === apt.id}
                          tone="success"
                          icon={
                            <CircleCheck
                              className="h-3.5 w-3.5"
                              strokeWidth={2}
                            />
                          }
                        >
                          Concluir + recibo
                        </ActionButton>
                      ) : (
                        <ActionButton
                          onClick={() => updateStatus(apt.id, "COMPLETED")}
                          disabled={pending && updatingId === apt.id}
                          tone="success"
                        >
                          Marcar realizada
                        </ActionButton>
                      )}
                    </>
                  )}
                </div>
              </div>
            </li>
          );
        })}

        {payingAppt && (
          <CompleteWithPaymentModal
            appointment={payingAppt}
            onClose={() => setPayingAppt(null)}
          />
        )}

        {editingAppt && (
          <EditAppointmentModal
            appointment={editingAppt}
            onClose={() => {
              setEditingAppt(null);
              router.refresh();
            }}
          />
        )}
      </ul>
    </div>
  );
}

type ActionTone = "primary" | "ghost" | "info" | "success" | "danger";

function ActionButton({
  children,
  onClick,
  disabled,
  tone,
  icon,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  tone: ActionTone;
  icon?: React.ReactNode;
}) {
  const toneClass: Record<ActionTone, string> = {
    primary:
      "bg-brand-primary text-white hover:bg-brand-primary-hover [box-shadow:var(--shadow-sm)]",
    ghost:
      "border border-border-default bg-bg-surface text-text-primary hover:bg-bg-surface-hover",
    info: "bg-info text-white hover:opacity-90 [box-shadow:var(--shadow-sm)]",
    success:
      "bg-success text-white hover:opacity-90 [box-shadow:var(--shadow-sm)]",
    danger:
      "border border-danger-border bg-danger-bg text-danger hover:bg-danger hover:text-white",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={
        "inline-flex h-7 items-center justify-center gap-1 rounded-md px-3 text-tiny font-medium transition-all duration-fast disabled:cursor-not-allowed disabled:opacity-50 active:scale-[0.98] " +
        toneClass[tone]
      }
    >
      {icon}
      {children}
    </button>
  );
}
