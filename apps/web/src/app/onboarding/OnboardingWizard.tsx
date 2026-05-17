"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveStepAction, completeOnboardingAction } from "./actions";

interface Props {
  userId: string;
  userEmail: string;
  initialStep: number;
  totalSteps: number;
  initialData: Record<string, unknown>;
}

function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9\s-]/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 40);
}

export function OnboardingWizard({
  userEmail,
  initialStep,
  totalSteps,
  initialData,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState(initialStep);
  const [data, setData] = useState<Record<string, unknown>>(initialData);
  const [error, setError] = useState<string | null>(null);

  function updateField<T>(key: string, value: T) {
    setData((prev) => ({ ...prev, [key]: value }));
  }

  async function handleNext(stepData: Record<string, unknown>) {
    setError(null);
    startTransition(async () => {
      const result = await saveStepAction({ step, data: stepData });
      if (!result.ok) {
        setError(result.message ?? "Erro ao salvar progresso");
        return;
      }
      setData((prev) => ({ ...prev, ...stepData }));
      setStep((s) => Math.min(s + 1, totalSteps));
    });
  }

  async function handleComplete(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const result = await completeOnboardingAction(formData);
      if (!result.ok) {
        setError(result.message ?? "Erro ao finalizar");
        return;
      }
      router.push("/app");
      router.refresh();
    });
  }

  const progress = ((step - 1) / totalSteps) * 100;

  return (
    <div className="mx-auto max-w-2xl px-4">
      <header className="mb-8 text-center">
        <h1 className="text-2xl font-bold text-brand-primary">
          Bem-vindo ao NutriCore
        </h1>
        <p className="mt-2 text-sm text-slate-600">
          Vamos configurar sua conta em poucos passos
        </p>

        <div className="mx-auto mt-6 max-w-md">
          <div className="mb-2 flex items-center justify-between text-xs text-slate-500">
            <span>
              Etapa {step} de {totalSteps}
            </span>
            <span>{Math.round(progress)}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={progress}
            aria-valuemin={0}
            aria-valuemax={100}
            className="h-2 overflow-hidden rounded-full bg-slate-200"
          >
            <div
              className="h-full bg-brand-primary transition-all duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </header>

      {error && (
        <div
          role="alert"
          className="mb-4 rounded-md bg-red-50 p-4 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
        {step === 1 && (
          <Step1Welcome
            email={userEmail}
            initialName={(data.fullName as string) ?? ""}
            pending={pending}
            onNext={(fullName) => handleNext({ fullName })}
          />
        )}

        {step === 2 && (
          <Step2ProfessionalType
            initial={(data.professionalType as string) ?? ""}
            pending={pending}
            onBack={() => setStep(1)}
            onNext={(professionalType) => handleNext({ professionalType })}
          />
        )}

        {step === 3 && (
          <Step3CRN
            initial={(data.crn as string) ?? ""}
            pending={pending}
            onBack={() => setStep(2)}
            onNext={(crn) => handleNext({ crn })}
          />
        )}

        {step === 4 && (
          <Step4Organization
            initialName={(data.orgName as string) ?? ""}
            initialSlug={(data.orgSlug as string) ?? ""}
            pending={pending}
            onBack={() => setStep(3)}
            onNext={(orgName, orgSlug) => handleNext({ orgName, orgSlug })}
          />
        )}

        {step === 5 && (
          <Step5Confirm
            data={data}
            pending={pending}
            onBack={() => setStep(4)}
            onComplete={handleComplete}
          />
        )}
      </div>
    </div>
  );
}

// ============================================================
// Sub-steps
// ============================================================

function Step1Welcome({
  email,
  initialName,
  pending,
  onNext,
}: {
  email: string;
  initialName: string;
  pending: boolean;
  onNext: (fullName: string) => void;
}) {
  const [name, setName] = useState(initialName);

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">
        Olá! Vamos começar.
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Vamos personalizar sua conta para começar a atender pacientes.
      </p>

      <div className="mt-6">
        <label htmlFor="fullName" className="block text-sm font-medium">
          Seu nome completo *
        </label>
        <input
          id="fullName"
          type="text"
          required
          autoComplete="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          placeholder="Ana Silva"
        />
        <p className="mt-1 text-xs text-slate-500">
          Aparecerá no prontuário e receitas. Conta: {email}
        </p>
      </div>

      <div className="mt-6 flex justify-end">
        <button
          type="button"
          disabled={pending || name.length < 2}
          onClick={() => onNext(name)}
          className="inline-flex h-11 items-center justify-center rounded-md bg-brand-primary px-6 text-sm font-medium text-white hover:bg-brand-primary-hover disabled:cursor-not-allowed disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Continuar →"}
        </button>
      </div>
    </div>
  );
}

function Step2ProfessionalType({
  initial,
  pending,
  onBack,
  onNext,
}: {
  initial: string;
  pending: boolean;
  onBack: () => void;
  onNext: (type: string) => void;
}) {
  const [type, setType] = useState(initial || "nutricionista_autonomo");

  const options = [
    {
      value: "nutricionista_autonomo",
      label: "Nutricionista autônomo",
      desc: "Atendo individualmente, sem equipe",
    },
    {
      value: "clinica",
      label: "Clínica multi-profissional",
      desc: "Tenho equipe (outros nutris, assistentes)",
    },
    {
      value: "outro",
      label: "Outro",
      desc: "Pesquisador, professor, consultor, etc.",
    },
  ];

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">Como você atua?</h2>
      <p className="mt-2 text-sm text-slate-600">
        Vamos adaptar a experiência ao seu perfil.
      </p>

      <div className="mt-6 space-y-3">
        {options.map((opt) => (
          <label
            key={opt.value}
            className={`flex cursor-pointer items-start gap-3 rounded-md border p-4 transition-colors ${
              type === opt.value
                ? "border-brand-primary bg-brand-primary-bg"
                : "border-slate-300 hover:bg-slate-50"
            }`}
          >
            <input
              type="radio"
              name="professionalType"
              value={opt.value}
              checked={type === opt.value}
              onChange={(e) => setType(e.target.value)}
              className="mt-1 h-4 w-4 text-brand-primary focus:ring-brand-primary"
            />
            <div>
              <div className="text-sm font-medium text-slate-900">
                {opt.label}
              </div>
              <div className="text-xs text-slate-600">{opt.desc}</div>
            </div>
          </label>
        ))}
      </div>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-6 text-sm font-medium hover:bg-slate-50"
        >
          ← Voltar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onNext(type)}
          className="inline-flex h-11 items-center justify-center rounded-md bg-brand-primary px-6 text-sm font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Continuar →"}
        </button>
      </div>
    </div>
  );
}

function Step3CRN({
  initial,
  pending,
  onBack,
  onNext,
}: {
  initial: string;
  pending: boolean;
  onBack: () => void;
  onNext: (crn: string) => void;
}) {
  const [crn, setCrn] = useState(initial);

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">CRN (opcional)</h2>
      <p className="mt-2 text-sm text-slate-600">
        Aparecerá em receitas, atestados e encaminhamentos. Pode adicionar
        depois.
      </p>

      <div className="mt-6">
        <label htmlFor="crn" className="block text-sm font-medium">
          Número do CRN
        </label>
        <input
          id="crn"
          type="text"
          value={crn}
          onChange={(e) => setCrn(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
          placeholder="CRN-3/12345"
        />
      </div>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-6 text-sm font-medium hover:bg-slate-50"
        >
          ← Voltar
        </button>
        <button
          type="button"
          disabled={pending}
          onClick={() => onNext(crn)}
          className="inline-flex h-11 items-center justify-center rounded-md bg-brand-primary px-6 text-sm font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Continuar →"}
        </button>
      </div>
    </div>
  );
}

function Step4Organization({
  initialName,
  initialSlug,
  pending,
  onBack,
  onNext,
}: {
  initialName: string;
  initialSlug: string;
  pending: boolean;
  onBack: () => void;
  onNext: (name: string, slug: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [slug, setSlug] = useState(initialSlug);
  const [slugTouched, setSlugTouched] = useState(false);

  function handleNameChange(value: string) {
    setName(value);
    if (!slugTouched) {
      setSlug(slugify(value));
    }
  }

  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">
        Nome da sua clínica
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Para autônomo: pode ser seu nome profissional. Para clínica: o nome
        fantasia.
      </p>

      <div className="mt-6 space-y-4">
        <div>
          <label htmlFor="orgName" className="block text-sm font-medium">
            Nome *
          </label>
          <input
            id="orgName"
            type="text"
            required
            value={name}
            onChange={(e) => handleNameChange(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            placeholder="Nutrição Ana Silva"
          />
        </div>

        <div>
          <label htmlFor="orgSlug" className="block text-sm font-medium">
            Identificador único (slug) *
          </label>
          <input
            id="orgSlug"
            type="text"
            required
            value={slug}
            onChange={(e) => {
              setSlug(slugify(e.target.value));
              setSlugTouched(true);
            }}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-primary focus:outline-none focus:ring-1 focus:ring-brand-primary font-mono"
            placeholder="nutricao-ana-silva"
            pattern="[a-z0-9-]+"
          />
          <p className="mt-1 text-xs text-slate-500">
            Sua página pública será:{" "}
            <span className="font-mono">nutricore.app/c/{slug || "..."}</span>
          </p>
        </div>
      </div>

      <div className="mt-6 flex justify-between">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-6 text-sm font-medium hover:bg-slate-50"
        >
          ← Voltar
        </button>
        <button
          type="button"
          disabled={pending || name.length < 2 || slug.length < 3}
          onClick={() => onNext(name, slug)}
          className="inline-flex h-11 items-center justify-center rounded-md bg-brand-primary px-6 text-sm font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {pending ? "Salvando…" : "Continuar →"}
        </button>
      </div>
    </div>
  );
}

function Step5Confirm({
  data,
  pending,
  onBack,
  onComplete,
}: {
  data: Record<string, unknown>;
  pending: boolean;
  onBack: () => void;
  onComplete: (formData: FormData) => void;
}) {
  return (
    <div>
      <h2 className="text-xl font-semibold text-slate-900">
        Confirmar e finalizar
      </h2>
      <p className="mt-2 text-sm text-slate-600">
        Revise os dados antes de criar sua organização.
      </p>

      <div className="mt-6 rounded-md bg-slate-50 p-4 text-sm">
        <dl className="space-y-2">
          <div className="flex justify-between">
            <dt className="text-slate-600">Nome:</dt>
            <dd className="font-medium text-slate-900">
              {String(data.fullName ?? "—")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Tipo:</dt>
            <dd className="font-medium text-slate-900">
              {String(data.professionalType ?? "—")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">CRN:</dt>
            <dd className="font-medium text-slate-900">
              {String(data.crn || "Não informado")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Organização:</dt>
            <dd className="font-medium text-slate-900">
              {String(data.orgName ?? "—")}
            </dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-slate-600">Slug:</dt>
            <dd className="font-mono text-slate-900">
              {String(data.orgSlug ?? "—")}
            </dd>
          </div>
        </dl>
      </div>

      <form action={onComplete} className="mt-6">
        {/* Re-enviar campos como hidden para validação no server action */}
        <input
          type="hidden"
          name="fullName"
          value={String(data.fullName ?? "")}
        />
        <input
          type="hidden"
          name="professionalType"
          value={String(data.professionalType ?? "nutricionista_autonomo")}
        />
        <input type="hidden" name="crn" value={String(data.crn ?? "")} />
        <input
          type="hidden"
          name="orgName"
          value={String(data.orgName ?? "")}
        />
        <input
          type="hidden"
          name="orgSlug"
          value={String(data.orgSlug ?? "")}
        />

        <label className="flex items-start gap-2 text-sm text-slate-700">
          <input
            type="checkbox"
            name="acceptedTerms"
            required
            className="mt-1 h-4 w-4 text-brand-primary focus:ring-brand-primary"
          />
          <span>
            Li e concordo com os{" "}
            <a
              href="/termos"
              className="text-brand-primary underline"
              target="_blank"
            >
              Termos de uso
            </a>{" "}
            e{" "}
            <a
              href="/privacidade"
              className="text-brand-primary underline"
              target="_blank"
            >
              Política de privacidade (LGPD)
            </a>
            .
          </span>
        </label>

        <div className="mt-6 flex justify-between">
          <button
            type="button"
            onClick={onBack}
            className="inline-flex h-11 items-center justify-center rounded-md border border-slate-300 bg-white px-6 text-sm font-medium hover:bg-slate-50"
          >
            ← Voltar
          </button>
          <button
            type="submit"
            disabled={pending}
            className="inline-flex h-11 items-center justify-center rounded-md bg-brand-primary px-6 text-sm font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {pending ? "Criando organização…" : "Finalizar configuração"}
          </button>
        </div>
      </form>
    </div>
  );
}
