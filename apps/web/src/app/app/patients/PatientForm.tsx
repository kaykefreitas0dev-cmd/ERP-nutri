"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { TriangleAlert } from "lucide-react";
import { createPatientAction, updatePatientAction } from "./actions";

interface PatientFormProps {
  mode: "create" | "edit";
  patient?: {
    id: string;
    fullName: string;
    preferredName: string | null;
    email: string | null;
    phone: string | null;
    birthDate: Date | string | null;
    biologicalSex: string | null;
    cpf: string | null;
    city: string | null;
    state: string | null;
    occupation: string | null;
    notes: string | null;
  };
}

function formatDate(d: Date | string | null): string {
  if (!d) return "";
  const date = typeof d === "string" ? new Date(d) : d;
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

export function PatientForm({ mode, patient }: PatientFormProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result =
        mode === "create"
          ? await createPatientAction(formData)
          : await updatePatientAction(formData);

      if (!result.ok) {
        setError(result.message ?? "Erro ao salvar");
        return;
      }

      router.push(`/app/patients/${result.patientId}`);
      router.refresh();
    });
  }

  return (
    <form action={handleSubmit} className="space-y-5">
      {patient && <input type="hidden" name="patientId" value={patient.id} />}

      {error && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <div>
        <label htmlFor="fullName" className="block text-sm font-medium">
          Nome completo *
        </label>
        <input
          id="fullName"
          name="fullName"
          type="text"
          required
          defaultValue={patient?.fullName ?? ""}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        />
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="preferredName" className="block text-sm font-medium">
            Como prefere ser chamado
          </label>
          <input
            id="preferredName"
            name="preferredName"
            type="text"
            defaultValue={patient?.preferredName ?? ""}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
        <div>
          <label htmlFor="cpf" className="block text-sm font-medium">
            CPF
          </label>
          <input
            id="cpf"
            name="cpf"
            type="text"
            defaultValue={patient?.cpf ?? ""}
            placeholder="000.000.000-00"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="email" className="block text-sm font-medium">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            defaultValue={patient?.email ?? ""}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
        <div>
          <label htmlFor="phone" className="block text-sm font-medium">
            WhatsApp / Telefone
          </label>
          <input
            id="phone"
            name="phone"
            type="tel"
            defaultValue={patient?.phone ?? ""}
            placeholder="(11) 99999-9999"
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div>
          <label htmlFor="birthDate" className="block text-sm font-medium">
            Data de nascimento
          </label>
          <input
            id="birthDate"
            name="birthDate"
            type="date"
            defaultValue={formatDate(patient?.birthDate ?? null)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
        <div>
          <label htmlFor="biologicalSex" className="block text-sm font-medium">
            Sexo biológico
          </label>
          <select
            id="biologicalSex"
            name="biologicalSex"
            defaultValue={patient?.biologicalSex ?? ""}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="">Não informado</option>
            <option value="female">Feminino</option>
            <option value="male">Masculino</option>
            <option value="intersex">Intersexo</option>
            <option value="undisclosed">Prefere não dizer</option>
          </select>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="sm:col-span-2">
          <label htmlFor="city" className="block text-sm font-medium">
            Cidade
          </label>
          <input
            id="city"
            name="city"
            type="text"
            defaultValue={patient?.city ?? ""}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
        <div>
          <label htmlFor="state" className="block text-sm font-medium">
            UF
          </label>
          <input
            id="state"
            name="state"
            type="text"
            maxLength={2}
            defaultValue={patient?.state ?? ""}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm uppercase focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
      </div>

      <div>
        <label htmlFor="occupation" className="block text-sm font-medium">
          Profissão
        </label>
        <input
          id="occupation"
          name="occupation"
          type="text"
          defaultValue={patient?.occupation ?? ""}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        />
      </div>

      <div>
        <label htmlFor="notes" className="block text-sm font-medium">
          Notas administrativas
        </label>
        <textarea
          id="notes"
          name="notes"
          rows={3}
          defaultValue={patient?.notes ?? ""}
          placeholder="Preferências de agendamento, observações não-clínicas..."
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        />
        <p className="mt-1 flex items-start gap-1.5 text-xs text-slate-500">
          <TriangleAlert className="mt-0.5 h-3 w-3 shrink-0" strokeWidth={2} />
          <span>
            Anotações clínicas (anamnese, evolução) ficam em
            &ldquo;Prontuário&rdquo; — esses são criptografados.
          </span>
        </p>
      </div>

      <div className="flex justify-end gap-3 pt-4">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-md bg-brand-primary px-6 text-sm font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {pending
            ? "Salvando…"
            : mode === "create"
              ? "Criar paciente"
              : "Salvar alterações"}
        </button>
      </div>
    </form>
  );
}
