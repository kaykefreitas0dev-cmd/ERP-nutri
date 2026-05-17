import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
  DRAFT: "bg-amber-100 text-amber-800",
  ISSUED: "bg-green-100 text-green-800",
  REVOKED: "bg-red-100 text-red-800",
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
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-4xl">
        <Link
          href={`/app/patients/${id}/documents`}
          className="text-sm text-teal-700 hover:underline"
        >
          ← Documentos de {patient.fullName}
        </Link>

        <header className="mt-2 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-slate-900 truncate">
                {doc.title}
              </h1>
              <span
                className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                  STATUS_STYLE[doc.status] ?? "bg-slate-200 text-slate-600"
                }`}
              >
                {doc.status}
              </span>
            </div>
            <p className="mt-1 text-sm text-slate-600">
              📄 {TYPE_LABELS[doc.documentType] ?? doc.documentType} • Emissor:{" "}
              {doc.issuerName}
              {doc.issuerCrn &&
                ` (CRN-${doc.issuerCrnUf ?? "—"}: ${doc.issuerCrn})`}
            </p>
          </div>

          <DocumentActions documentId={doc.id} status={doc.status} />
        </header>

        {/* Banner status */}
        {doc.status === "REVOKED" && (
          <div className="mt-4 rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-800">
            <strong>Documento revogado</strong>{" "}
            {doc.revokedAt &&
              `em ${new Date(doc.revokedAt).toLocaleDateString("pt-BR")}`}
            {doc.revokedReason && (
              <p className="mt-1">
                <strong>Motivo:</strong> {doc.revokedReason}
              </p>
            )}
          </div>
        )}

        {doc.status === "DRAFT" && (
          <div className="mt-4 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-800">
            <strong>Rascunho</strong> — não vale legalmente. Clique em{" "}
            <em>Assinar e emitir</em> para gerar o PDF assinado.
          </div>
        )}

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          {/* Coluna 1: metadados + assinatura */}
          <aside className="space-y-4">
            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Paciente (snapshot)
              </h2>
              <p className="mt-2 text-sm font-medium">
                {doc.patientNameSnapshot}
              </p>
              {doc.patientCpfSnapshot && (
                <p className="text-xs text-slate-600">
                  CPF: {doc.patientCpfSnapshot}
                </p>
              )}
            </section>

            {doc.cidCodes.length > 0 && (
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  CID-10
                </h2>
                <ul className="mt-2 space-y-1 text-xs">
                  {doc.cidCodes.map((c) => (
                    <li key={c.id}>
                      <strong className="text-teal-700">{c.cid.code}</strong>{" "}
                      {c.cid.description}
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {doc.validUntil && (
              <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                  Validade
                </h2>
                <p className="mt-2 text-sm">
                  {new Date(doc.validUntil).toLocaleDateString("pt-BR")}
                </p>
              </section>
            )}

            {doc.signature && (
              <section className="rounded-lg border border-green-200 bg-green-50 p-4 shadow-sm">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-green-800">
                  Assinatura digital (Mock)
                </h2>
                <p className="mt-1 text-xs text-green-700">
                  Assinado em{" "}
                  {new Date(doc.signature.signedAt).toLocaleString("pt-BR")}
                </p>
                <p className="mt-1 text-xs text-green-700">
                  Algoritmo: {doc.signature.algorithm}
                </p>
                <p className="mt-2 break-all font-mono text-[10px] text-green-700">
                  {doc.signature.signatureValue.slice(0, 32)}...
                </p>
                {doc.pdfHash && (
                  <>
                    <h3 className="mt-3 text-xs font-semibold uppercase tracking-wider text-green-800">
                      Hash do PDF (SHA-256)
                    </h3>
                    <p className="mt-1 break-all font-mono text-[10px] text-green-700">
                      {doc.pdfHash}
                    </p>
                  </>
                )}
              </section>
            )}

            <section className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm">
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
                Histórico
              </h2>
              <ul className="mt-2 space-y-1 text-xs text-slate-600">
                <li>
                  Criado em {new Date(doc.createdAt).toLocaleString("pt-BR")}
                </li>
                {doc.issuedAt && (
                  <li>
                    Emitido em {new Date(doc.issuedAt).toLocaleString("pt-BR")}
                  </li>
                )}
                {doc.revokedAt && (
                  <li className="text-red-600">
                    Revogado em{" "}
                    {new Date(doc.revokedAt).toLocaleString("pt-BR")}
                  </li>
                )}
              </ul>
            </section>
          </aside>

          {/* Coluna 2-3: corpo do documento */}
          <article className="lg:col-span-2 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Corpo do documento
            </h2>
            <div className="mt-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
              {renderMarkdown(doc.bodyMarkdown)}
            </div>
          </article>
        </div>
      </div>
    </main>
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
