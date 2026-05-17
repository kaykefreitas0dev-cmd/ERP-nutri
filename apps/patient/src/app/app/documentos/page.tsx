import Link from "next/link";
import { FileText, Hospital } from "lucide-react";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";
export const metadata = { title: "Documentos — NutriCore" };

const TYPE_LABELS: Record<string, string> = {
  PLANO_ALIMENTAR: "Plano alimentar",
  ATESTADO: "Atestado",
  RECEITA_SUPLEMENTO: "Receita de suplemento",
  ENCAMINHAMENTO: "Encaminhamento",
  RECIBO: "Recibo",
};

export default async function MyDocumentsPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const docs = await prisma.clinicalDocument.findMany({
    where: {
      patient: { userId: user!.id },
      status: "ISSUED",
    },
    orderBy: { issuedAt: "desc" },
    take: 100,
    select: {
      id: true,
      title: true,
      documentType: true,
      issuedAt: true,
      validUntil: true,
      issuerName: true,
      issuerCrn: true,
      patient: {
        select: { organization: { select: { name: true } } },
      },
    },
  });

  return (
    <div className="mx-auto max-w-3xl px-5 py-6">
      <h1 className="text-2xl font-bold text-slate-900">Documentos</h1>
      <p className="mt-1 text-sm text-slate-600">
        Atestados, receitas e encaminhamentos emitidos pelo(a) seu(sua)
        nutricionista
      </p>

      <div className="mt-6">
        {docs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-slate-300 bg-white p-8 text-center text-slate-600">
            Nenhum documento emitido ainda.
          </div>
        ) : (
          <ul className="space-y-2">
            {docs.map((d) => (
              <li
                key={d.id}
                className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-slate-900 truncate">
                      {d.title}
                    </p>
                    <p className="mt-1 inline-flex items-center gap-1 text-xs text-slate-600">
                      <FileText className="h-3 w-3" strokeWidth={1.75} />
                      {TYPE_LABELS[d.documentType] ?? d.documentType} •{" "}
                      {d.issuerName}
                      {d.issuerCrn && ` (CRN ${d.issuerCrn})`}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-slate-500">
                      <Hospital className="h-3 w-3" strokeWidth={1.75} />
                      {d.patient.organization.name}
                    </p>
                    {d.issuedAt && (
                      <p className="text-xs text-slate-500">
                        Emitido em{" "}
                        {new Date(d.issuedAt).toLocaleDateString("pt-BR")}
                        {d.validUntil &&
                          ` · Válido até ${new Date(d.validUntil).toLocaleDateString("pt-BR")}`}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/app/documentos/${d.id}`}
                    className="shrink-0 rounded-md bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-primary-hover"
                  >
                    Abrir
                  </Link>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
