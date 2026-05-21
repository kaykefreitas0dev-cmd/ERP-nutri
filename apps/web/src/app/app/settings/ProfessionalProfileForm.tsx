"use client";

import { useState, useTransition } from "react";
import { Loader2, ExternalLink } from "lucide-react";
import { upsertProfessionalProfileAction, UF_VALUES } from "./actions";

interface Props {
  initial: {
    displayName: string;
    crn: string;
    crnUf: string;
    bio: string;
    specialtiesRaw: string;
    slug: string | null;
  };
}

export function ProfessionalProfileForm({ initial }: Props) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [slug, setSlug] = useState(initial.slug);

  const [displayName, setDisplayName] = useState(initial.displayName);
  const [crn, setCrn] = useState(initial.crn);
  const [crnUf, setCrnUf] = useState(initial.crnUf);
  const [bio, setBio] = useState(initial.bio);
  const [specialtiesRaw, setSpecialtiesRaw] = useState(initial.specialtiesRaw);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaved(false);
    setError(null);

    startTransition(async () => {
      const r = await upsertProfessionalProfileAction({
        displayName,
        crn,
        crnUf,
        bio,
        specialtiesRaw,
      });
      if (!r.ok) {
        setError(r.message ?? "Erro ao salvar");
        return;
      }
      setSaved(true);
      if (r.slug && !slug) setSlug(r.slug);
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* Display name */}
      <div>
        <label
          htmlFor="pp-displayName"
          className="block text-tiny font-medium text-text-secondary"
        >
          Nome profissional *
        </label>
        <input
          id="pp-displayName"
          type="text"
          required
          maxLength={120}
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          placeholder="Dr. Maria Silva"
          className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        />
        <p className="mt-0.5 text-tiny text-text-muted">
          Aparece nos recibos, documentos e página pública de agendamento.
        </p>
      </div>

      {/* CRN + CRN-UF */}
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label
            htmlFor="pp-crn"
            className="block text-tiny font-medium text-text-secondary"
          >
            CRN (número)
          </label>
          <input
            id="pp-crn"
            type="text"
            maxLength={20}
            value={crn}
            onChange={(e) => setCrn(e.target.value)}
            placeholder="12345"
            className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          />
        </div>
        <div>
          <label
            htmlFor="pp-crnUf"
            className="block text-tiny font-medium text-text-secondary"
          >
            CRN-UF
          </label>
          <select
            id="pp-crnUf"
            value={crnUf}
            onChange={(e) => setCrnUf(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          >
            <option value="">Selecione</option>
            {UF_VALUES.map((uf) => (
              <option key={uf} value={uf}>
                {uf}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Specialties */}
      <div>
        <label
          htmlFor="pp-specialties"
          className="block text-tiny font-medium text-text-secondary"
        >
          Especialidades
        </label>
        <input
          id="pp-specialties"
          type="text"
          maxLength={500}
          value={specialtiesRaw}
          onChange={(e) => setSpecialtiesRaw(e.target.value)}
          placeholder="Nutrição clínica, Emagrecimento, Esportiva"
          className="mt-1 block w-full rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        />
        <p className="mt-0.5 text-tiny text-text-muted">
          Separe por vírgula. Ex: "Nutrição clínica, Emagrecimento"
        </p>
      </div>

      {/* Bio */}
      <div>
        <label
          htmlFor="pp-bio"
          className="block text-tiny font-medium text-text-secondary"
        >
          Bio
        </label>
        <textarea
          id="pp-bio"
          maxLength={800}
          rows={3}
          value={bio}
          onChange={(e) => setBio(e.target.value)}
          placeholder="Breve apresentação para a página de agendamento…"
          className="mt-1 block w-full resize-y rounded-md border border-border-default bg-bg-surface px-3 py-2 text-body focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
        />
      </div>

      {/* Booking page slug */}
      {slug && (
        <div className="rounded-md border border-border-subtle bg-bg-subtle p-3">
          <p className="text-tiny font-medium text-text-secondary">
            Link de agendamento público
          </p>
          <a
            href={`/c/${slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-0.5 inline-flex items-center gap-1 text-tiny text-brand-primary hover:text-brand-primary-hover"
          >
            /c/{slug}
            <ExternalLink className="h-3 w-3" strokeWidth={1.75} />
          </a>
          <p className="mt-1 text-tiny text-text-muted">
            Para alterar o link (slug), entre em contato com o suporte.
          </p>
        </div>
      )}

      {/* Feedback */}
      {error && (
        <p role="alert" className="text-body text-danger">
          {error}
        </p>
      )}
      {saved && (
        <p role="status" className="text-body text-success">
          Perfil atualizado com sucesso!
        </p>
      )}

      <div className="flex justify-end">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex items-center gap-2 rounded-md bg-brand-primary px-5 py-2 text-body font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {pending && (
            <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
          )}
          {pending ? "Salvando…" : "Salvar perfil"}
        </button>
      </div>
    </form>
  );
}
