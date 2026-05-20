"use client";

import { useRef, useState, useTransition, useEffect } from "react";
import { X, Loader2 } from "lucide-react";
import { updateAppointmentAction } from "./actions";

interface Appointment {
  id: string;
  startsAt: Date | string;
  endsAt: Date | string;
  modality: string;
  notes: string | null;
}

interface Props {
  appointment: Appointment;
  onClose: () => void;
}

/** Formats a Date/string to `YYYY-MM-DDThh:mm` (value for datetime-local input) */
function toLocalDatetimeValue(d: Date | string): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  const pad = (n: number) => String(n).padStart(2, "0");
  return (
    `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}` +
    `T${pad(dt.getHours())}:${pad(dt.getMinutes())}`
  );
}

export function EditAppointmentModal({ appointment, onClose }: Props) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  // Close on Escape key
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [isPending, onClose]);

  const durationMinutes = Math.round(
    (new Date(appointment.endsAt).getTime() -
      new Date(appointment.startsAt).getTime()) /
      60_000,
  );

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    // Convert local datetime to ISO string (browser value is in local time)
    const rawDatetime = fd.get("startsAt") as string;
    const isoDatetime = new Date(rawDatetime).toISOString();
    fd.set("startsAt", isoDatetime);
    fd.set("appointmentId", appointment.id);

    startTransition(async () => {
      const result = await updateAppointmentAction(fd);
      if (!result.ok) {
        setError(result.message ?? "Erro ao salvar");
      } else {
        onClose();
      }
    });
  }

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30 backdrop-blur-[2px]"
        onClick={onClose}
        aria-hidden
      />

      {/* Modal */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-appt-title"
        className="fixed left-1/2 top-1/2 z-50 w-full max-w-md -translate-x-1/2 -translate-y-1/2 rounded-xl border border-border-subtle bg-bg-surface p-6 [box-shadow:var(--shadow-lg)]"
      >
        <div className="mb-5 flex items-center justify-between">
          <h2
            id="edit-appt-title"
            className="text-h2 font-semibold text-text-primary"
          >
            Editar consulta
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-primary"
          >
            <X className="h-4 w-4" strokeWidth={2} />
          </button>
        </div>

        <form ref={formRef} onSubmit={handleSubmit} className="space-y-4">
          {/* Date/time */}
          <div>
            <label
              htmlFor="edit-startsAt"
              className="mb-1 block text-caption font-medium text-text-primary"
            >
              Data e horário
            </label>
            <input
              id="edit-startsAt"
              name="startsAt"
              type="datetime-local"
              required
              defaultValue={toLocalDatetimeValue(appointment.startsAt)}
              className="h-9 w-full rounded-md border border-border-default bg-bg-surface px-3 text-body text-text-primary transition-[border-color,box-shadow] duration-fast focus:border-brand-primary focus:outline-none focus:[box-shadow:var(--shadow-focus-ring)]"
            />
          </div>

          {/* Duration */}
          <div>
            <label
              htmlFor="edit-duration"
              className="mb-1 block text-caption font-medium text-text-primary"
            >
              Duração (minutos)
            </label>
            <select
              id="edit-duration"
              name="durationMinutes"
              defaultValue={String(durationMinutes)}
              className="h-9 w-full rounded-md border border-border-default bg-bg-surface px-3 text-body text-text-primary transition-colors hover:border-border-strong focus:border-brand-primary focus:outline-none focus:[box-shadow:var(--shadow-focus-ring)]"
            >
              {[15, 20, 30, 45, 50, 60, 90, 120].map((m) => (
                <option key={m} value={m}>
                  {m} min
                </option>
              ))}
            </select>
          </div>

          {/* Modality */}
          <fieldset>
            <legend className="mb-2 block text-caption font-medium text-text-primary">
              Modalidade
            </legend>
            <div className="flex gap-2">
              {(
                [
                  { value: "in_person", label: "Presencial" },
                  { value: "video", label: "Vídeo" },
                  { value: "phone", label: "Telefone" },
                ] as const
              ).map((opt) => (
                <label
                  key={opt.value}
                  className="flex flex-1 cursor-pointer items-center justify-center gap-1.5 rounded-md border border-border-default bg-bg-surface py-2 text-caption font-medium text-text-secondary transition-all has-[:checked]:border-brand-primary has-[:checked]:bg-brand-primary-bg has-[:checked]:text-brand-primary"
                >
                  <input
                    type="radio"
                    name="modality"
                    value={opt.value}
                    defaultChecked={appointment.modality === opt.value}
                    className="sr-only"
                  />
                  {opt.label}
                </label>
              ))}
            </div>
          </fieldset>

          {/* Notes */}
          <div>
            <label
              htmlFor="edit-notes"
              className="mb-1 block text-caption font-medium text-text-primary"
            >
              Observações{" "}
              <span className="font-normal text-text-muted">(opcional)</span>
            </label>
            <textarea
              id="edit-notes"
              name="notes"
              rows={3}
              defaultValue={appointment.notes ?? ""}
              placeholder="Orientações, anamnese rápida…"
              className="w-full resize-none rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body text-text-primary placeholder:text-text-muted transition-[border-color,box-shadow] duration-fast focus:border-brand-primary focus:outline-none focus:[box-shadow:var(--shadow-focus-ring)]"
            />
          </div>

          {/* Error */}
          {error && (
            <p
              role="alert"
              className="rounded-md border border-danger-border bg-danger-bg px-3 py-2 text-caption text-danger"
            >
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex items-center justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={isPending}
              className="inline-flex h-9 items-center justify-center rounded-md border border-border-default bg-bg-surface px-4 text-body font-medium text-text-primary transition-all duration-fast hover:bg-bg-surface-hover disabled:opacity-50 active:scale-[0.98]"
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="inline-flex h-9 items-center justify-center gap-2 rounded-md bg-brand-primary px-4 text-body font-medium text-white [box-shadow:var(--shadow-sm)] transition-all duration-fast hover:bg-brand-primary-hover disabled:opacity-50 active:scale-[0.98]"
            >
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              Salvar alterações
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
