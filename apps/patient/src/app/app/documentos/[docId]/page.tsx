import Link from "next/link";
import { notFound } from "next/navigation";
import { FileText, Hospital, Calendar, Download } from "lucide-react";
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
        className="text-sm text-teal-700 hover:underline"
      >
        ← Documentos
      </Link>

      <header className="mt-2">
        <h1 className="text-2xl font-bold text-slate-900">{doc.title}</h1>
        <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-slate-600">
          <FileText className="h-4 w-4" strokeWidth={1.75} />
          {TYPE_LABELS[doc.documentType] ?? doc.documentType} • {doc.issuerName}
          {doc.issuerCrn &&
            ` (CRN-${doc.issuerCrnUf ?? "—"}: ${doc.issuerCrn})`}
        </p>
        <p className="flex items-center gap-1 text-xs text-slate-500">
          <Hospital className="h-3 w-3" strokeWidth={1.75} />
          {doc.patient.organization.name}
        </p>
      </header>

      {doc.validUntil && (
        <div className="mt-3 flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-800">
          <Calendar className="h-4 w-4" strokeWidth={1.75} />
          Válido até {new Date(doc.validUntil).toLocaleDateString("pt-BR")}
        </div>
      )}

      <div className="mt-6 rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-slate-800">
          {renderMarkdown(doc.bodyMarkdown)}
        </div>

        {doc.cidCodes.length > 0 && (
          <div className="mt-6 border-t border-slate-100 pt-4">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              CID-10
            </h3>
            <ul className="mt-2 space-y-1 text-xs">
              {doc.cidCodes.map((c) => (
                <li key={c.id}>
                  <strong className="text-teal-700">{c.cid.code}</strong>{" "}
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
          className="rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium hover:bg-slate-50"
        >
          <Download className="inline h-4 w-4" strokeWidth={1.75} /> Baixar PDF
        </a>
      </div>

      <p className="mt-3 text-xs text-slate-500">
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
