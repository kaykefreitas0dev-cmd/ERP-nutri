import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Plus, FileText, Download } from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documentos clínicos" };

interface Props {
  params: Promise<{ id: string }>;
}

const TYPE_LABELS: Record<string, string> = {
  PLANO_ALIMENTAR: "Plano alimentar",
  ATESTADO: "Atestado",
  RECEITA_SUPLEMENTO: "Receita de suplemento",
  ENCAMINHAMENTO: "Encaminhamento",
  RECIBO: "Recibo",
};

const STATUS_STYLE: Record<string, string> = {
  DRAFT: "bg-warning-bg text-warning ring-warning-border",
  ISSUED: "bg-success-bg text-success ring-success-border",
  REVOKED: "bg-danger-bg text-danger ring-danger-border",
};

export default async function PatientDocumentsPage({ params }: Props) {
  const { id } = await params;

  let data: {
    patient: { id: string; fullName: string };
    docs: Array<{
      id: string;
      title: string;
      documentType: string;
      status: string;
      issuedAt: Date | null;
      revokedAt: Date | null;
      createdAt: Date;
      issuerName: string;
      issuerCrn: string | null;
    }>;
  } | null = null;

  try {
    data = await withTenantAction(async ({ tx }) => {
      const patient = await tx.patient.findFirst({
        where: { id },
        select: { id: true, fullName: true },
      });
      if (!patient) return null;
      const docs = await tx.clinicalDocument.findMany({
        where: { patientId: id },
        orderBy: { createdAt: "desc" },
        take: 100,
        select: {
          id: true,
          title: true,
          documentType: true,
          status: true,
          issuedAt: true,
          revokedAt: true,
          createdAt: true,
          issuerName: true,
          issuerCrn: true,
        },
      });
      return { patient, docs };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  if (!data) notFound();

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/app/patients/${id}`}
          className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          {data.patient.fullName}
        </Link>

        <header className="mt-3 flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
              Prontuário
            </p>
            <h1 className="mt-0.5 text-h1 font-semibold tracking-tight text-text-primary">
              Documentos clínicos
            </h1>
            <p className="mt-1 text-caption text-text-secondary tabular-nums">
              {data.docs.length} documento{data.docs.length === 1 ? "" : "s"} ·
              atestados, receitas e encaminhamentos
            </p>
          </div>
          <Link
            href={`/app/patients/${id}/documents/new`}
            className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-brand-primary px-4 text-body font-medium text-white [box-shadow:var(--shadow-sm)] transition-all duration-fast hover:bg-brand-primary-hover hover:[box-shadow:var(--shadow-md)] active:scale-[0.98]"
          >
            <Plus className="h-4 w-4" strokeWidth={2} />
            Novo documento
          </Link>
        </header>

        <div className="mt-6">
          {data.docs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-12 text-center">
              <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-brand-primary-bg text-brand-primary">
                <FileText className="h-5 w-5" strokeWidth={1.75} />
              </div>
              <h2 className="mt-3 text-h3 font-semibold text-text-primary">
                Nenhum documento ainda
              </h2>
              <p className="mt-1 text-caption text-text-secondary">
                Crie atestados, receitas de suplemento e encaminhamentos com
                CID-10 e assinatura digital.
              </p>
            </div>
          ) : (
            <ul className="space-y-2.5">
              {data.docs.map((d) => (
                <li
                  key={d.id}
                  className="rounded-lg border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)] transition-all duration-fast hover:[box-shadow:var(--shadow-sm)]"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 flex-1 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand-primary-bg text-brand-primary">
                        <FileText className="h-5 w-5" strokeWidth={1.75} />
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Link
                            href={`/app/patients/${id}/documents/${d.id}`}
                            className="truncate text-body font-semibold text-text-primary transition-colors hover:text-brand-primary"
                          >
                            {d.title}
                          </Link>
                          <span
                            className={
                              "shrink-0 rounded-full px-2 py-0.5 text-tiny font-medium ring-1 ring-inset " +
                              (STATUS_STYLE[d.status] ??
                                "bg-bg-subtle text-text-secondary ring-border-subtle")
                            }
                          >
                            {d.status}
                          </span>
                        </div>
                        <p className="mt-1 text-caption text-text-secondary">
                          {TYPE_LABELS[d.documentType] ?? d.documentType}
                          {" · Emissor: "}
                          {d.issuerName}
                          {d.issuerCrn && ` (CRN ${d.issuerCrn})`}
                        </p>
                        <p className="mt-0.5 text-tiny text-text-muted tabular-nums">
                          {d.issuedAt ? (
                            <>
                              Emitido em{" "}
                              {new Date(d.issuedAt).toLocaleDateString(
                                "pt-BR",
                                {
                                  day: "2-digit",
                                  month: "2-digit",
                                  year: "numeric",
                                },
                              )}
                            </>
                          ) : (
                            <>
                              Criado em{" "}
                              {new Date(d.createdAt).toLocaleDateString(
                                "pt-BR",
                              )}{" "}
                              (rascunho)
                            </>
                          )}
                          {d.revokedAt && (
                            <span className="ml-2 text-danger">
                              · Revogado em{" "}
                              {new Date(d.revokedAt).toLocaleDateString(
                                "pt-BR",
                              )}
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <a
                      href={`/api/v1/documents/${d.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex h-8 shrink-0 items-center gap-1 rounded-md border border-border-default bg-bg-surface px-3 text-tiny font-medium text-text-primary transition-colors hover:bg-bg-surface-hover"
                    >
                      <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                      PDF
                    </a>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </main>
  );
}
