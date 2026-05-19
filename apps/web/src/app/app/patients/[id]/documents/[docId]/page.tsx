import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  FileText,
  TriangleAlert,
  ShieldCheck,
  Stethoscope,
  Clock,
  History,
  User,
} from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { DocumentActions } from "./DocumentActions";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documento clínico" };

interface Props {
  params: Promise<{ id: string; docId: string }>;
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

export default async function ViewDocumentPage({ params }: Props) {
  const { id, docId } = await params;

  let data: {
    patient: { id: string; fullName: string };
    doc: {
      id: string;
      title: string;
      documentType: string;
      bodyMarkdown: string;
      status: string;
      issuerName: string;
      issuerCrn: string | null;
      issuerCrnUf: string | null;
      patientNameSnapshot: string;
      patientCpfSnapshot: string | null;
      validUntil: Date | null;
      pdfHash: string | null;
      issuedAt: Date | null;
      revokedAt: Date | null;
      revokedReason: string | null;
      createdAt: Date;
      cidCodes: Array<{
        id: string;
        cid: { code: string; description: string };
      }>;
      signature: {
        signatureValue: string;
        signedAt: Date;
        algorithm: string;
      } | null;
    };
  } | null = null;

  try {
    data = await withTenantAction(async ({ tx }) => {
      const patient = await tx.patient.findFirst({
        where: { id },
        select: { id: true, fullName: true },
      });
      if (!patient) return null;
      const doc = await tx.clinicalDocument.findFirst({
        where: { id: docId, patientId: id },
        include: {
          cidCodes: {
            include: { cid: { select: { code: true, description: true } } },
          },
          signature: true,
        },
      });
      if (!doc) return null;
      return { patient, doc };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  if (!data) notFound();
  const { doc, patient } = data;

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/app/patients/${id}/documents`}
          className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Documentos de {patient.fullName}
        </Link>

        <header className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
              {TYPE_LABELS[doc.documentType] ?? doc.documentType}
            </p>
            <div className="mt-0.5 flex flex-wrap items-center gap-3">
              <h1 className="truncate text-h1 font-semibold tracking-tight text-text-primary">
                {doc.title}
              </h1>
              <span
                className={
                  "shrink-0 rounded-full px-2.5 py-1 text-tiny font-medium ring-1 ring-inset " +
                  (STATUS_STYLE[doc.status] ??
                    "bg-bg-subtle text-text-secondary ring-border-subtle")
                }
              >
                {doc.status}
              </span>
            </div>
            <p className="mt-1 inline-flex items-center gap-1.5 text-caption text-text-secondary">
              <Stethoscope className="h-3.5 w-3.5" strokeWidth={1.75} />
              {doc.issuerName}
              {doc.issuerCrn &&
                ` · CRN-${doc.issuerCrnUf ?? "—"} ${doc.issuerCrn}`}
            </p>
          </div>

          <DocumentActions documentId={doc.id} status={doc.status} />
        </header>

        {/* Banner status */}
        {doc.status === "REVOKED" && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-danger-border bg-danger-bg p-3 text-caption text-danger">
            <TriangleAlert
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={1.75}
            />
            <div>
              <p className="font-semibold">
                Documento revogado
                {doc.revokedAt &&
                  ` em ${new Date(doc.revokedAt).toLocaleDateString("pt-BR")}`}
              </p>
              {doc.revokedReason && (
                <p className="mt-1">
                  <span className="font-medium">Motivo:</span>{" "}
                  {doc.revokedReason}
                </p>
              )}
            </div>
          </div>
        )}

        {doc.status === "DRAFT" && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-warning-border bg-warning-bg p-3 text-caption text-warning">
            <TriangleAlert
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={1.75}
            />
            <div>
              <p className="font-semibold">Rascunho</p>
              <p className="mt-0.5">
                Não vale legalmente. Clique em{" "}
                <span className="font-medium">Assinar e emitir</span> para gerar
                o PDF assinado.
              </p>
            </div>
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Coluna 1: metadados + assinatura */}
          <aside className="space-y-4">
            <Section title="Paciente (snapshot)" Icon={User}>
              <p className="text-body font-medium text-text-primary">
                {doc.patientNameSnapshot}
              </p>
              {doc.patientCpfSnapshot && (
                <p className="mt-1 text-caption text-text-secondary tabular-nums">
                  CPF: {doc.patientCpfSnapshot}
                </p>
              )}
            </Section>

            {doc.cidCodes.length > 0 && (
              <Section title="CID-10" Icon={Stethoscope}>
                <ul className="space-y-1.5">
                  {doc.cidCodes.map((c) => (
                    <li key={c.id} className="text-caption">
                      <code className="rounded bg-bg-subtle px-1.5 py-0.5 font-mono text-tiny font-medium text-brand-primary">
                        {c.cid.code}
                      </code>{" "}
                      <span className="text-text-secondary">
                        {c.cid.description}
                      </span>
                    </li>
                  ))}
                </ul>
              </Section>
            )}

            {doc.validUntil && (
              <Section title="Validade" Icon={Clock}>
                <p className="text-body font-medium tabular-nums">
                  {new Date(doc.validUntil).toLocaleDateString("pt-BR")}
                </p>
              </Section>
            )}

            {doc.signature && (
              <section className="rounded-lg border border-success-border bg-success-bg p-4">
                <h2 className="flex items-center gap-1.5 text-tiny font-semibold uppercase tracking-wider text-success">
                  <ShieldCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Assinatura digital (Mock)
                </h2>
                <p className="mt-2 text-caption text-success">
                  Assinado em{" "}
                  <span className="tabular-nums">
                    {new Date(doc.signature.signedAt).toLocaleString("pt-BR")}
                  </span>
                </p>
                <p className="text-caption text-success">
                  Algoritmo:{" "}
                  <code className="font-mono text-tiny">
                    {doc.signature.algorithm}
                  </code>
                </p>
                <p className="mt-2 break-all font-mono text-[10px] text-success/80">
                  {doc.signature.signatureValue.slice(0, 32)}…
                </p>
                {doc.pdfHash && (
                  <>
                    <h3 className="mt-3 text-tiny font-semibold uppercase tracking-wider text-success">
                      Hash do PDF (SHA-256)
                    </h3>
                    <p className="mt-1 break-all font-mono text-[10px] text-success/80">
                      {doc.pdfHash}
                    </p>
                  </>
                )}
              </section>
            )}

            <Section title="Histórico" Icon={History}>
              <ul className="space-y-1 text-caption text-text-secondary">
                <li className="tabular-nums">
                  Criado{" "}
                  {new Date(doc.createdAt).toLocaleString("pt-BR", {
                    dateStyle: "short",
                    timeStyle: "short",
                  })}
                </li>
                {doc.issuedAt && (
                  <li className="tabular-nums">
                    Emitido{" "}
                    {new Date(doc.issuedAt).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </li>
                )}
                {doc.revokedAt && (
                  <li className="tabular-nums text-danger">
                    Revogado{" "}
                    {new Date(doc.revokedAt).toLocaleString("pt-BR", {
                      dateStyle: "short",
                      timeStyle: "short",
                    })}
                  </li>
                )}
              </ul>
            </Section>
          </aside>

          {/* Coluna 2-3: corpo do documento */}
          <article className="lg:col-span-2 rounded-lg border border-border-subtle bg-bg-surface p-6 [box-shadow:var(--shadow-xs)]">
            <h2 className="flex items-center gap-1.5 text-tiny font-semibold uppercase tracking-wider text-text-muted">
              <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
              Corpo do documento
            </h2>
            <div className="mt-4 whitespace-pre-wrap text-body leading-relaxed text-text-primary">
              {renderMarkdown(doc.bodyMarkdown)}
            </div>
          </article>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  Icon,
  children,
}: {
  title: string;
  Icon: typeof User;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
      <h2 className="flex items-center gap-1.5 text-tiny font-semibold uppercase tracking-wider text-text-muted">
        <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
        {title}
      </h2>
      <div className="mt-2">{children}</div>
    </section>
  );
}

// Renderização mínima de markdown: **bold** + parágrafos
function renderMarkdown(text: string): React.ReactNode {
  const paragraphs = text.split(/\n\s*\n/).filter(Boolean);
  return paragraphs.map((p, i) => (
    <p key={i} className="mb-3 last:mb-0">
      {renderBold(p)}
    </p>
  ));
}

function renderBold(text: string): React.ReactNode {
  const parts = text.split(/(\*\*[^*]+\*\*)/);
  return parts.map((part, i) =>
    part.startsWith("**") && part.endsWith("**") ? (
      <strong key={i}>{part.slice(2, -2)}</strong>
    ) : (
      <span key={i}>{part}</span>
    ),
  );
}
