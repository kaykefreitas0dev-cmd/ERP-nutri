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
      <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
        Seus documentos
      </p>
      <h1 className="mt-0.5 text-h1 font-semibold tracking-tight text-text-primary">
        Documentos
      </h1>
      <p className="mt-1 text-caption text-text-secondary">
        Atestados, receitas e encaminhamentos emitidos pela(o) sua(seu)
        nutricionista.
      </p>

      <div className="mt-6">
        {docs.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-8 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
              <FileText className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <p className="mt-3 text-h3 font-semibold text-text-primary">
              Nenhum documento ainda
            </p>
            <p className="mt-1 text-caption text-text-secondary">
              Quando sua(seu) nutri emitir um atestado, receita ou
              encaminhamento, aparecerá aqui.
            </p>
          </div>
        ) : (
          <ul className="space-y-2.5">
            {docs.map((d) => (
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
                      <p className="truncate text-body font-semibold text-text-primary">
                        {d.title}
                      </p>
                      <p className="mt-1 text-caption text-text-secondary">
                        {TYPE_LABELS[d.documentType] ?? d.documentType}
                        {" · "}
                        {d.issuerName}
                        {d.issuerCrn && ` (CRN ${d.issuerCrn})`}
                      </p>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-tiny text-text-muted">
                        <span className="inline-flex items-center gap-1">
                          <Hospital className="h-3 w-3" strokeWidth={1.75} />
                          {d.patient.organization.name}
                        </span>
                        {d.issuedAt && (
                          <span className="tabular-nums">
                            · Emitido{" "}
                            {new Date(d.issuedAt).toLocaleDateString("pt-BR")}
                            {d.validUntil &&
                              ` · Válido até ${new Date(d.validUntil).toLocaleDateString("pt-BR")}`}
                          </span>
                        )}
                      </p>
                    </div>
                  </div>
                  <Link
                    href={`/app/documentos/${d.id}`}
                    className="shrink-0 rounded-md bg-brand-primary px-3 py-1.5 text-tiny font-medium text-white [box-shadow:var(--shadow-sm)] transition-all duration-fast hover:bg-brand-primary-hover active:scale-[0.98]"
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
