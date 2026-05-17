import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  Utensils,
  CircleCheck,
  FileText,
  Pencil,
  Lock,
  Archive,
} from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { Avatar } from "@repo/ui/avatar";
import { Badge } from "@repo/ui/badge";
import { StatusDot } from "@repo/ui/status-dot";
import { ClinicalNotesSection } from "./ClinicalNotesSection";
import { InvitePatientButton } from "./invites/InvitePatientButton";
import { AnonymizeButton } from "./anonymize/AnonymizeButton";
import { ExportDataButton } from "./export/ExportButton";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PatientDetailPage({ params }: Props) {
  const { id } = await params;

  let patient: {
    id: string;
    fullName: string;
    preferredName: string | null;
    email: string | null;
    phone: string | null;
    cpf: string | null;
    birthDate: Date | null;
    biologicalSex: string | null;
    city: string | null;
    state: string | null;
    occupation: string | null;
    notes: string | null;
    status: string;
    userId: string | null;
    createdAt: Date;
    updatedAt: Date;
    allergies: Array<{
      id: string;
      severity: string;
      allergen: { name: string; slug: string };
    }>;
    clinicalConditions: Array<{
      id: string;
      conditionName: string;
      severity: string | null;
    }>;
    invites: Array<{
      id: string;
      email: string;
      expiresAt: Date;
      acceptedAt: Date | null;
      revokedAt: Date | null;
    }>;
  } | null = null;

  try {
    patient = await withTenantAction(async ({ tx, organizationId, userId }) => {
      const p = await tx.patient.findFirst({
        where: { id },
        include: {
          allergies: {
            include: { allergen: { select: { name: true, slug: true } } },
          },
          clinicalConditions: { orderBy: { createdAt: "desc" } },
          invites: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              email: true,
              expiresAt: true,
              acceptedAt: true,
              revokedAt: true,
            },
          },
        },
      });

      if (p) {
        // Audit log: leitura de PHI
        await tx.$executeRaw`
          SELECT audit.append_log(
            ${organizationId}::uuid,
            ${userId}::uuid,
            'nutritionist'::text,
            NULL::inet, NULL::text,
            'patient.read'::text,
            'Patient'::text,
            ${p.id}::text,
            ${p.id}::uuid,
            ARRAY['fullName','email','phone','cpf']::text[],
            '{}'::jsonb
          )
        `;
      }

      return p;
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG") {
      redirect("/onboarding");
    }
    throw err;
  }

  if (!patient) notFound();

  function formatDate(d: Date | null): string {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR");
  }

  function calcAge(birthDate: Date | null): string | null {
    if (!birthDate) return null;
    const today = new Date();
    const bd = new Date(birthDate);
    let age = today.getFullYear() - bd.getFullYear();
    const m = today.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
    return `${age} anos`;
  }

  const age = calcAge(patient.birthDate);
  const isAnonymized = patient.status === "ANONYMIZED";
  const isArchived = patient.status === "ARCHIVED";

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        {/* Back link */}
        <Link
          href="/app/patients"
          className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Pacientes
        </Link>

        {/* Header — avatar + nome + status + ações */}
        <header className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <Avatar name={patient.fullName} size="xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-h1 font-semibold tracking-tight text-text-primary">
                  {patient.fullName}
                </h1>
                {isAnonymized && (
                  <Badge
                    variant="warning"
                    leftIcon={<Lock className="h-3 w-3" strokeWidth={2} />}
                  >
                    Anonimizado
                  </Badge>
                )}
                {isArchived && (
                  <Badge
                    variant="neutral"
                    leftIcon={<Archive className="h-3 w-3" strokeWidth={2} />}
                  >
                    Arquivado
                  </Badge>
                )}
                {!isAnonymized && !isArchived && (
                  <Badge
                    variant="success"
                    leftIcon={<StatusDot status="active" pulse size={1.5} />}
                  >
                    Ativo
                  </Badge>
                )}
              </div>
              {patient.preferredName && (
                <p className="mt-0.5 text-caption text-text-secondary">
                  Prefere ser chamado de{" "}
                  <span className="font-medium text-text-primary">
                    {patient.preferredName}
                  </span>
                </p>
              )}
              <p className="mt-1 text-caption text-text-muted">
                {[
                  age,
                  patient.biologicalSex,
                  `Cliente desde ${formatDate(patient.createdAt)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/app/patients/${patient.id}/meal-plans`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-3 text-body font-medium text-text-primary transition-colors hover:bg-bg-surface-hover hover:border-border-strong"
            >
              <Utensils className="h-4 w-4" strokeWidth={1.75} />
              Planos
            </Link>
            <Link
              href={`/app/patients/${patient.id}/checkins`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-3 text-body font-medium text-text-primary transition-colors hover:bg-bg-surface-hover hover:border-border-strong"
            >
              <CircleCheck className="h-4 w-4" strokeWidth={1.75} />
              Check-ins
            </Link>
            <Link
              href={`/app/patients/${patient.id}/documents`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-3 text-body font-medium text-text-primary transition-colors hover:bg-bg-surface-hover hover:border-border-strong"
            >
              <FileText className="h-4 w-4" strokeWidth={1.75} />
              Documentos
            </Link>
            <Link
              href={`/app/patients/${patient.id}/edit`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-3 text-body font-medium text-text-primary transition-colors hover:bg-bg-surface-hover hover:border-border-strong"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.75} />
              Editar
            </Link>
          </div>
        </header>

        {/* Grid principal */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Coluna 1: dados pessoais */}
          <div className="space-y-4">
            {/* Acesso ao app paciente */}
            <Section title="Acesso ao app">
              <InvitePatientButton
                patientId={patient.id}
                patientName={patient.fullName}
                defaultEmail={patient.email}
                hasLinkedAccount={Boolean(patient.userId)}
                hasActiveInvite={(() => {
                  const now = new Date();
                  return patient.invites.some(
                    (inv) =>
                      !inv.acceptedAt &&
                      !inv.revokedAt &&
                      new Date(inv.expiresAt) > now,
                  );
                })()}
                activeInviteId={(() => {
                  const now = new Date();
                  const inv = patient.invites.find(
                    (i) =>
                      !i.acceptedAt &&
                      !i.revokedAt &&
                      new Date(i.expiresAt) > now,
                  );
                  return inv?.id ?? null;
                })()}
                activeInviteEmail={(() => {
                  const now = new Date();
                  const inv = patient.invites.find(
                    (i) =>
                      !i.acceptedAt &&
                      !i.revokedAt &&
                      new Date(i.expiresAt) > now,
                  );
                  return inv?.email ?? null;
                })()}
                activeInviteExpiresAt={(() => {
                  const now = new Date();
                  const inv = patient.invites.find(
                    (i) =>
                      !i.acceptedAt &&
                      !i.revokedAt &&
                      new Date(i.expiresAt) > now,
                  );
                  return inv?.expiresAt ?? null;
                })()}
              />
            </Section>

            <Section title="Contato">
              <dl className="space-y-2.5 text-body">
                <DataRow label="Email" value={patient.email} />
                <DataRow label="Telefone" value={patient.phone} />
                <DataRow label="CPF" value={patient.cpf} />
                <DataRow
                  label="Cidade"
                  value={
                    patient.city
                      ? `${patient.city}${patient.state ? `/${patient.state}` : ""}`
                      : null
                  }
                />
                <DataRow label="Profissão" value={patient.occupation} />
              </dl>
            </Section>

            <Section title="Alergias" counter={patient.allergies.length}>
              {patient.allergies.length === 0 ? (
                <p className="text-caption text-text-muted">
                  Sem alergias registradas.
                </p>
              ) : (
                <ul className="space-y-2 text-body">
                  {patient.allergies.map((a) => {
                    const severe =
                      a.severity === "ANAPHYLAXIS" || a.severity === "HIGH";
                    const moderate = a.severity === "MODERATE";
                    return (
                      <li key={a.id} className="flex items-center gap-2">
                        <StatusDot
                          status={
                            severe
                              ? "danger"
                              : moderate
                                ? "warning"
                                : "inactive"
                          }
                          size={2}
                        />
                        <span>{a.allergen.name}</span>
                        <span className="text-tiny text-text-muted">
                          ({a.severity})
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section
              title="Condições clínicas"
              counter={patient.clinicalConditions.length}
            >
              {patient.clinicalConditions.length === 0 ? (
                <p className="text-caption text-text-muted">
                  Nenhuma registrada.
                </p>
              ) : (
                <ul className="space-y-1 text-body">
                  {patient.clinicalConditions.map((c) => (
                    <li key={c.id}>{c.conditionName}</li>
                  ))}
                </ul>
              )}
            </Section>

            {patient.notes && (
              <Section title="Notas administrativas">
                <p className="whitespace-pre-wrap text-body text-text-primary">
                  {patient.notes}
                </p>
              </Section>
            )}

            {/* Privacidade / LGPD */}
            <section className="rounded-lg border border-border-subtle bg-bg-subtle p-4">
              <h2 className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
                Privacidade (LGPD)
              </h2>
              <p className="mt-2 text-tiny text-text-secondary">
                Exporte (Art. 18 II — portabilidade), arquive ou anonimize (Art.
                18 V — esquecimento, irreversível).
              </p>
              <div className="mt-3 space-y-2">
                <ExportDataButton patientId={patient.id} />
                <AnonymizeButton
                  patientId={patient.id}
                  patientName={patient.fullName}
                  status={patient.status}
                />
              </div>
            </section>
          </div>

          {/* Coluna 2-3: Prontuário (Clinical Notes) */}
          <div className="md:col-span-2">
            <ClinicalNotesSection patientId={patient.id} />
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  counter,
  children,
}: {
  title: string;
  counter?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
      <h2 className="flex items-center gap-2 text-h3 font-semibold text-text-primary">
        {title}
        {counter != null && (
          <span className="text-caption font-normal text-text-muted tabular-nums">
            ({counter})
          </span>
        )}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
      <dt className="text-tiny font-medium uppercase tracking-wider text-text-muted">
        {label}
      </dt>
      <dd className="text-body text-text-primary">
        {value || <span className="text-text-subtle">—</span>}
      </dd>
    </div>
  );
}
