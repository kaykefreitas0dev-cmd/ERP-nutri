import Link from "next/link";
import { createHash } from "node:crypto";
import {
  Search,
  Ban,
  CircleCheck,
  Clock,
  Sparkles,
  type LucideIcon,
} from "lucide-react";
import { prisma } from "@nutricore/db";
import { AcceptInviteForm } from "./AcceptInviteForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Convite — NutriCore" };

interface Props {
  params: Promise<{ token: string }>;
}

function NutriCoreMark({ className = "" }: { className?: string }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width="28"
      height="28"
      fill="none"
      aria-hidden="true"
      className={className}
    >
      <path
        d="M16 3C11 8 7 11.5 7 16.5a9 9 0 0 0 18 0c0-5-4-8.5-9-13.5z"
        fill="currentColor"
        fillOpacity="0.18"
      />
      <path
        d="M16 3C11 8 7 11.5 7 16.5a9 9 0 0 0 18 0c0-5-4-8.5-9-13.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M12 21V11l8 8V8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function InviteLandingPage({ params }: Props) {
  const { token } = await params;

  // Lookup do invite por hash do token (sem expor token plain ao DB)
  const tokenHash = createHash("sha256").update(token).digest("hex");

  const invite = await prisma.patientInvite.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      email: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
      patient: {
        select: {
          id: true,
          fullName: true,
          organization: { select: { name: true } },
        },
      },
    },
  });

  if (!invite) {
    return (
      <ErrorScreen
        Icon={Search}
        title="Convite não encontrado"
        message="Este link pode estar incorreto ou ter expirado. Peça à sua(seu) nutricionista para gerar um novo convite."
      />
    );
  }

  if (invite.revokedAt) {
    return (
      <ErrorScreen
        Icon={Ban}
        title="Convite revogado"
        message="Este convite foi revogado. Peça à sua(seu) nutricionista para gerar um novo."
      />
    );
  }

  if (invite.acceptedAt) {
    return (
      <ErrorScreen
        Icon={CircleCheck}
        tone="success"
        title="Convite já aceito"
        message="Você já criou seu acesso. Faça login para entrar."
        ctaHref="/login"
        ctaLabel="Ir para o login"
      />
    );
  }

  if (new Date(invite.expiresAt) < new Date()) {
    return (
      <ErrorScreen
        Icon={Clock}
        title="Convite expirado"
        message="Este convite expirou. Peça à sua(seu) nutricionista para gerar um novo."
      />
    );
  }

  const firstName = invite.patient.fullName.split(" ")[0];

  return (
    <main className="relative flex min-h-screen flex-col bg-bg-page">
      {/* Gradient blob bg */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[400px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-160px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-brand-primary-bg opacity-70 blur-[80px]" />
      </div>

      <header className="px-5 py-5">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <div className="flex items-center gap-2 text-h3 font-semibold text-brand-primary">
            <NutriCoreMark />
            NutriCore
          </div>
        </div>
      </header>

      <section className="flex-1 px-5 pb-10">
        <div className="mx-auto max-w-md">
          {/* Card de boas-vindas */}
          <div className="rounded-xl border border-brand-200 bg-brand-primary-bg p-5">
            <div className="flex items-center gap-2 text-brand-primary">
              <Sparkles className="h-4 w-4" strokeWidth={1.75} />
              <p className="text-tiny font-semibold uppercase tracking-wider">
                Convite recebido
              </p>
            </div>
            <h1 className="mt-2 text-h1 font-semibold tracking-tight text-brand-800">
              Olá, {firstName}!
            </h1>
            <p className="mt-2 text-caption text-brand-primary-hover">
              Você foi convidada(o) por{" "}
              <strong>{invite.patient.organization.name}</strong> para
              acompanhar seu plano alimentar na NutriCore.
            </p>
          </div>

          {/* Card como funciona + form */}
          <div className="mt-6 rounded-xl border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-md)]">
            <h3 className="text-h3 font-semibold text-text-primary">
              Como funciona
            </h3>
            <ol className="mt-3 space-y-2 text-body text-text-secondary">
              <Step number={1}>Confirme o email para criar seu acesso</Step>
              <Step number={2}>Você receberá um link mágico no email</Step>
              <Step number={3}>Clique no link e pronto — sem senha!</Step>
            </ol>

            <div className="mt-5 border-t border-border-subtle pt-5">
              <AcceptInviteForm token={token} defaultEmail={invite.email} />
            </div>
          </div>

          <p className="mt-4 text-center text-tiny text-text-muted tabular-nums">
            Convite válido até{" "}
            {new Date(invite.expiresAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </section>

      <footer className="border-t border-border-subtle bg-bg-surface px-5 py-3 text-center text-tiny text-text-muted">
        NutriCore · acompanhamento nutricional digital
      </footer>
    </main>
  );
}

function Step({
  number,
  children,
}: {
  number: number;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-2">
      <span className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-primary text-tiny font-semibold text-white tabular-nums">
        {number}
      </span>
      <span>{children}</span>
    </li>
  );
}

function ErrorScreen({
  Icon,
  title,
  message,
  ctaHref,
  ctaLabel,
  tone = "neutral",
}: {
  Icon: LucideIcon;
  title: string;
  message: string;
  ctaHref?: string;
  ctaLabel?: string;
  tone?: "neutral" | "success";
}) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg-page p-5">
      <div className="mx-auto max-w-md rounded-xl border border-border-subtle bg-bg-surface p-8 text-center [box-shadow:var(--shadow-md)]">
        <div
          className={
            "mx-auto flex h-14 w-14 items-center justify-center rounded-full " +
            (tone === "success"
              ? "bg-success-bg text-success"
              : "bg-bg-subtle text-text-muted")
          }
        >
          <Icon className="h-7 w-7" strokeWidth={1.75} />
        </div>
        <h1 className="mt-4 text-h1 font-semibold tracking-tight text-text-primary">
          {title}
        </h1>
        <p className="mt-2 text-caption text-text-secondary">{message}</p>
        {ctaHref && ctaLabel && (
          <Link
            href={ctaHref}
            className="mt-6 inline-flex h-10 items-center justify-center rounded-md bg-brand-primary px-6 text-body font-medium text-white [box-shadow:var(--shadow-sm)] transition-all duration-fast hover:bg-brand-primary-hover hover:[box-shadow:var(--shadow-md)] active:scale-[0.98]"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </main>
  );
}
