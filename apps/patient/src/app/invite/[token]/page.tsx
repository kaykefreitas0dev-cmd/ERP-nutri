import Link from "next/link";
import { createHash } from "node:crypto";
import { prisma } from "@nutricore/db";
import { AcceptInviteForm } from "./AcceptInviteForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Convite — NutriCore" };

interface Props {
  params: Promise<{ token: string }>;
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
        emoji="🔍"
        title="Convite não encontrado"
        message="Este link pode estar incorreto ou ter expirado. Peça à sua(seu) nutricionista para gerar um novo convite."
      />
    );
  }

  if (invite.revokedAt) {
    return (
      <ErrorScreen
        emoji="🚫"
        title="Convite revogado"
        message="Este convite foi revogado. Peça à sua(seu) nutricionista para gerar um novo."
      />
    );
  }

  if (invite.acceptedAt) {
    return (
      <ErrorScreen
        emoji="✅"
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
        emoji="⏰"
        title="Convite expirado"
        message="Este convite expirou. Peça à sua(seu) nutricionista para gerar um novo."
      />
    );
  }

  return (
    <main className="flex min-h-screen flex-col">
      <header className="bg-teal-700 px-5 py-4 text-white shadow-sm">
        <div className="mx-auto max-w-md">
          <h1 className="text-xl font-bold">NutriCore</h1>
        </div>
      </header>

      <section className="flex-1 px-5 py-10">
        <div className="mx-auto max-w-md">
          <div className="rounded-lg border border-teal-200 bg-teal-50 p-5">
            <h2 className="text-xl font-bold text-teal-900">
              Olá, {invite.patient.fullName.split(" ")[0]}! 👋
            </h2>
            <p className="mt-2 text-sm text-teal-800">
              Você foi convidado(a) por{" "}
              <strong>{invite.patient.organization.name}</strong> para
              acompanhar seu plano alimentar na NutriCore.
            </p>
          </div>

          <div className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
            <h3 className="text-sm font-semibold text-slate-900">
              Como funciona
            </h3>
            <ol className="mt-3 space-y-2 text-sm text-slate-700">
              <li>
                <strong>1.</strong> Confirme o email para criar seu acesso
              </li>
              <li>
                <strong>2.</strong> Você receberá um link mágico no email
              </li>
              <li>
                <strong>3.</strong> Clique no link e pronto — sem senha!
              </li>
            </ol>

            <div className="mt-5">
              <AcceptInviteForm token={token} defaultEmail={invite.email} />
            </div>
          </div>

          <p className="mt-4 text-center text-xs text-slate-500">
            Convite válido até{" "}
            {new Date(invite.expiresAt).toLocaleDateString("pt-BR")}
          </p>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-3 text-center text-xs text-slate-500">
        NutriCore · acompanhamento nutricional digital
      </footer>
    </main>
  );
}

function ErrorScreen({
  emoji,
  title,
  message,
  ctaHref,
  ctaLabel,
}: {
  emoji: string;
  title: string;
  message: string;
  ctaHref?: string;
  ctaLabel?: string;
}) {
  return (
    <main className="flex min-h-screen items-center justify-center p-5">
      <div className="mx-auto max-w-md rounded-lg border border-slate-200 bg-white p-8 text-center shadow-sm">
        <p className="text-5xl">{emoji}</p>
        <h1 className="mt-3 text-xl font-bold text-slate-900">{title}</h1>
        <p className="mt-2 text-sm text-slate-600">{message}</p>
        {ctaHref && ctaLabel && (
          <Link
            href={ctaHref}
            className="mt-5 inline-flex h-11 items-center justify-center rounded-md bg-teal-700 px-6 text-sm font-medium text-white hover:bg-teal-800"
          >
            {ctaLabel}
          </Link>
        )}
      </div>
    </main>
  );
}
