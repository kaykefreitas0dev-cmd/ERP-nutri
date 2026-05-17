import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
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

  function calcAge(birthDate: Date | null): string {
    if (!birthDate) return "—";
    const today = new Date();
    const bd = new Date(birthDate);
    let age = today.getFullYear() - bd.getFullYear();
    const m = today.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
    return `${age} anos`;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href="/app/patients"
          className="text-sm text-teal-700 hover:underline"
        >
          ← Pacientes
        </Link>

        <header className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              {patient.fullName}
            </h1>
            {patient.preferredName && (
              <p className="text-sm text-slate-600">
                Prefere:{" "}
                <span className="font-medium">{patient.preferredName}</span>
              </p>
            )}
            <p className="mt-1 text-sm text-slate-500">
              {calcAge(patient.birthDate)} • {patient.biologicalSex ?? "—"} •
              Cliente desde {formatDate(patient.createdAt)}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href={`/app/patients/${patient.id}/meal-plans`}
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50"
            >
              🍽️ Planos
            </Link>
            <Link
              href={`/app/patients/${patient.id}/checkins`}
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50"
            >
              ✅ Check-ins
            </Link>
            <Link
              href={`/app/patients/${patient.id}/documents`}
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-3 text-sm font-medium hover:bg-slate-50"
            >
              📄 Documentos
            </Link>
            <Link
              href={`/app/patients/${patient.id}/edit`}
              className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50"
            >
              ✏️ Editar
            </Link>
          </div>
        </header>

        <div className="mt-6 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Coluna 1: dados pessoais */}
          <div className="space-y-4">
            {/* Acesso ao app paciente */}
            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">
                Acesso ao app
              </h2>
              <div className="mt-3">
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
              </div>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">Contato</h2>
              <dl className="mt-3 space-y-2 text-sm">
                <div>
                  <dt className="text-xs text-slate-500">Email</dt>
                  <dd>{patient.email ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Telefone</dt>
                  <dd>{patient.phone ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">CPF</dt>
                  <dd>{patient.cpf ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Cidade</dt>
                  <dd>
                    {patient.city
                      ? `${patient.city}${patient.state ? `/${patient.state}` : ""}`
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-500">Profissão</dt>
                  <dd>{patient.occupation ?? "—"}</dd>
                </div>
              </dl>
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">
                Alergias ({patient.allergies.length})
              </h2>
              {patient.allergies.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Sem alergias registradas.
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {patient.allergies.map((a) => (
                    <li key={a.id} className="flex items-center gap-2">
                      <span
                        className={`inline-block h-2 w-2 rounded-full ${
                          a.severity === "ANAPHYLAXIS" || a.severity === "HIGH"
                            ? "bg-red-500"
                            : a.severity === "MODERATE"
                              ? "bg-amber-500"
                              : "bg-slate-300"
                        }`}
                        aria-hidden
                      />
                      <span>{a.allergen.name}</span>
                      <span className="text-xs text-slate-500">
                        ({a.severity})
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-sm font-semibold text-slate-900">
                Condições clínicas ({patient.clinicalConditions.length})
              </h2>
              {patient.clinicalConditions.length === 0 ? (
                <p className="mt-2 text-xs text-slate-500">
                  Nenhuma registrada.
                </p>
              ) : (
                <ul className="mt-2 space-y-1 text-sm">
                  {patient.clinicalConditions.map((c) => (
                    <li key={c.id}>{c.conditionName}</li>
                  ))}
                </ul>
              )}
            </div>

            {patient.notes && (
              <div className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-sm font-semibold text-slate-900">
                  Notas administrativas
                </h2>
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700">
                  {patient.notes}
                </p>
              </div>
            )}

            {/* Privacidade / LGPD */}
            <div className="rounded-lg border border-slate-200 bg-slate-50 p-4">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Privacidade (LGPD)
              </h2>
              <p className="mt-2 text-xs text-slate-600">
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
            </div>
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
