"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck, TriangleAlert, MapPin, Video, Phone } from "lucide-react";
import { scheduleAppointmentAction } from "./actions";

interface Props {
  patients: Array<{ id: string; fullName: string }>;
  defaultDate: Date;
}

const inputBase =
  "mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body text-text-primary placeholder:text-text-muted " +
  "focus:border-brand-primary focus:outline-none focus:ring-2 focus:ring-brand-primary/20 " +
  "transition-colors duration-fast";

export function NewAppointmentForm({ patients, defaultDate }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<boolean>(false);
  const [patientMode, setPatientMode] = useState<"existing" | "external">(
    "existing",
  );

  // Default: next full hour
  const next = new Date(defaultDate);
  next.setMinutes(0, 0, 0);
  next.setHours(next.getHours() + 1);
  const defaultDateTime = next.toISOString().slice(0, 16);

  async function handleSubmit(formData: FormData) {
    setError(null);
    setSuccess(false);
    startTransition(async () => {
      const result = await scheduleAppointmentAction(formData);
      if (!result.ok) {
        setError(result.message ?? "Erro");
        return;
      }
      setSuccess(true);
      router.refresh();
    });
  }

  return (
    <div className="rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
      <h2 className="text-h3 font-semibold text-text-primary">Nova consulta</h2>

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-md border border-danger-border bg-danger-bg p-3 text-caption text-danger"
        >
          <TriangleAlert
            className="mt-0.5 h-3.5 w-3.5 shrink-0"
            strokeWidth={1.75}
          />
          {error}
        </div>
      )}
      {success && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-success-border bg-success-bg p-3 text-caption text-success">
          <CircleCheck className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
          Consulta agendada com sucesso
        </div>
      )}

      <form action={handleSubmit} className="mt-4 space-y-4">
        {/* Date + time */}
        <div>
          <label
            htmlFor="startsAt"
            className="block text-tiny font-medium text-text-secondary"
          >
            Data e hora *
          </label>
          <input
            id="startsAt"
            name="startsAt"
            type="datetime-local"
            required
            defaultValue={defaultDateTime}
            className={inputBase}
          />
        </div>

        {/* Duration */}
        <div>
          <label
            htmlFor="durationMinutes"
            className="block text-tiny font-medium text-text-secondary"
          >
            Duração *
          </label>
          <select
            id="durationMinutes"
            name="durationMinutes"
            defaultValue="60"
            className={inputBase}
          >
            <option value="30">30 minutos</option>
            <option value="45">45 minutos</option>
            <option value="60">60 minutos (padrão)</option>
            <option value="90">90 minutos</option>
            <option value="120">120 minutos</option>
          </select>
        </div>

        {/* Patient mode toggle */}
        <div>
          <span className="block text-tiny font-medium text-text-secondary">
            Paciente *
          </span>
          <div className="mt-1.5 inline-flex rounded-md border border-border-default bg-bg-subtle p-0.5">
            <button
              type="button"
              onClick={() => setPatientMode("existing")}
              className={
                "rounded px-2.5 py-1 text-tiny font-medium transition-all duration-fast " +
                (patientMode === "existing"
                  ? "bg-bg-surface text-text-primary [box-shadow:var(--shadow-xs)]"
                  : "text-text-muted hover:text-text-secondary")
              }
            >
              Cadastrado
            </button>
            <button
              type="button"
              onClick={() => setPatientMode("external")}
              className={
                "rounded px-2.5 py-1 text-tiny font-medium transition-all duration-fast " +
                (patientMode === "external"
                  ? "bg-bg-surface text-text-primary [box-shadow:var(--shadow-xs)]"
                  : "text-text-muted hover:text-text-secondary")
              }
            >
              Avulso
            </button>
          </div>

          {patientMode === "existing" ? (
            <select
              key="patientId"
              name="patientId"
              required={patientMode === "existing"}
              defaultValue=""
              className={inputBase}
            >
              <option value="" disabled>
                Selecione um paciente…
              </option>
              {patients.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.fullName}
                </option>
              ))}
            </select>
          ) : (
            <div className="mt-1.5 space-y-2">
              <input
                key="externalName"
                name="externalPatientName"
                type="text"
                required={patientMode === "external"}
                placeholder="Nome completo"
                className={inputBase}
              />
              <input
                name="externalPatientEmail"
                type="email"
                placeholder="Email (opcional)"
                className={inputBase}
              />
              <input
                name="externalPatientPhone"
                type="tel"
                placeholder="Telefone (opcional)"
                className={inputBase}
              />
            </div>
          )}
        </div>

        {/* Modality */}
        <div>
          <label
            htmlFor="modality"
            className="block text-tiny font-medium text-text-secondary"
          >
            Modalidade
          </label>
          <div className="mt-1.5 grid grid-cols-3 gap-1.5">
            {(
              [
                { value: "in_person", label: "Presencial", Icon: MapPin },
                { value: "video", label: "Vídeo", Icon: Video },
                { value: "phone", label: "Telefone", Icon: Phone },
              ] as const
            ).map(({ value, label, Icon }) => (
              <label
                key={value}
                className="relative flex cursor-pointer flex-col items-center gap-1 rounded-md border border-border-default bg-bg-surface p-2 text-center transition-colors has-[:checked]:border-brand-primary has-[:checked]:bg-brand-primary-bg"
              >
                <input
                  type="radio"
                  name="modality"
                  value={value}
                  defaultChecked={value === "in_person"}
                  className="sr-only"
                />
                <Icon
                  className="h-3.5 w-3.5 text-text-muted"
                  strokeWidth={1.75}
                />
                <span className="text-[10px] font-medium leading-tight text-text-secondary">
                  {label}
                </span>
              </label>
            ))}
          </div>
        </div>

        {/* Notes */}
        <div>
          <label
            htmlFor="notes"
            className="block text-tiny font-medium text-text-secondary"
          >
            Notas
          </label>
          <textarea
            id="notes"
            name="notes"
            rows={2}
            placeholder="Observações sobre a consulta…"
            className={inputBase + " resize-none"}
          />
        </div>

        <button
          type="submit"
          disabled={pending}
          className="w-full rounded-md bg-brand-primary px-4 py-2.5 text-body font-medium text-white [box-shadow:var(--shadow-sm)] transition-all duration-fast [transition-timing-function:var(--ease-out-expo)] hover:bg-brand-primary-hover hover:[box-shadow:var(--shadow-md)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Agendando…" : "Agendar consulta"}
        </button>
      </form>
    </div>
  );
}
