import Link from "next/link";
import { notFound } from "next/navigation";
import {
  FileText,
  Hospital,
  Calendar,
  Download,
  ChevronLeft,
} from "lucide-react";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documento" };

interface Props {
  params: Promise<{ docId: string }>;
}

const TYPE_LABELS: Record<string, string> = {
  PLANO_ALIMENTAR: "Plano alimentar",
  ATESTADO: "Atestado",
  RECEITA_SUPLEMENTO: "Receita de suplemento",
  ENCAMINHAMENTO: "Encaminhamento",
  RECIBO: "Recibo",
};

export default async function MyDocumentPage({ params }: Props) {
  const { docId } = await params;
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const doc = await prisma.clinicalDocument.findFirst({
    where: {
      id: docId,
      patient: { userId: user!.id }, // Lock 6
      status: "ISSUED",
    },
    include: {
      cidCodes: { include: { cid: true } },
      patient: { select: { organization: { select: { name: true } } } },
    },
  });

  if (!doc) notFound();

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <Link
        href="/app/documentos"
        className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Documentos
      </Link>

      <header className="mt-3">
        <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
          {TYPE_LABELS[doc.documentType] ?? doc.documentType}
        </p>
        <h1 className="mt-0.5 text-h1 font-semibold tracking-tight text-text-primary">
          {doc.title}
        </h1>
        <p className="mt-1 inline-flex items-center gap-1.5 text-caption text-text-secondary">
          <FileText className="h-4 w-4" strokeWidth={1.75} />
          {doc.issuerName}
          {doc.issuerCrn &&
            ` (CRN-${doc.issuerCrnUf ?? "—"}: ${doc.issuerCrn})`}
        </p>
        <p className="flex items-center gap-1 text-tiny text-text-muted">
          <Hospital className="h-3 w-3" strokeWidth={1.75} />
          {doc.patient.organization.name}
        </p>
      </header>

      {doc.validUntil && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-warning-border bg-warning-bg p-3 text-caption text-warning">
          <Calendar className="h-4 w-4 shrink-0" strokeWidth={1.75} />
          Válido até {new Date(doc.validUntil).toLocaleDateString("pt-BR")}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-border-subtle bg-bg-surface p-6 [box-shadow:var(--shadow-xs)]">
        <div className="whitespace-pre-wrap text-body leading-relaxed text-text-primary">
          {renderMarkdown(doc.bodyMarkdown)}
        </div>

        {doc.cidCodes.length > 0 && (
          <div className="mt-6 border-t border-border-subtle pt-4">
            <h3 className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
              CID-10
            </h3>
            <ul className="mt-2 space-y-1 text-tiny">
              {doc.cidCodes.map((c) => (
                <li key={c.id}>
                  <strong className="text-brand-primary">{c.cid.code}</strong>{" "}
                  {c.cid.description}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      <div className="mt-4 flex gap-2">
        <a
          href={`${process.env.NEXT_PUBLIC_NUTRI_APP_URL ?? ""}/api/v1/documents/${doc.id}/pdf`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-4 py-2 text-caption font-medium text-text-primary transition-colors hover:bg-bg-surface-hover"
        >
          <Download className="h-4 w-4" strokeWidth={1.75} />
          Baixar PDF
        </a>
      </div>

      <p className="mt-3 text-tiny text-text-muted">
        Emitido em{" "}
        {doc.issuedAt && new Date(doc.issuedAt).toLocaleString("pt-BR")}
      </p>
    </div>
  );
}

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
