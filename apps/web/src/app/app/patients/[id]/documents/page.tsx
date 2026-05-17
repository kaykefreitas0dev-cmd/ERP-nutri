import Link from "next/link";
import { notFound, redirect } from "next/navigation";
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
  DRAFT: "bg-amber-100 text-amber-800",
  ISSUED: "bg-green-100 text-green-800",
  REVOKED: "bg-red-100 text-red-800",
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
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/app/patients/${id}`}
          className="text-sm text-teal-700 hover:underline"
        >
          ← {data.patient.fullName}
        </Link>

        <header className="mt-2 flex items-start justify-between">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">
              Documentos clínicos
            </h1>
            <p className="mt-1 text-sm text-slate-600">
              {data.docs.length} documento(s) — atestados, receitas,
              encaminhamentos
            </p>
          </div>
          <Link
            href={`/app/patients/${id}/documents/new`}
            className="rounded-md bg-teal-700 px-4 py-2 text-sm font-medium text-white hover:bg-teal-800"
          >
            + Novo documento
          </Link>
        </header>

        <div className="mt-6">
          {data.docs.length === 0 ? (
            <div className="rounded-lg border border-dashed border-slate-300 bg-white p-12 text-center">
              <p className="text-slate-600">
                Nenhum documento clínico emitido ainda.
              </p>
              <p className="mt-2 text-xs text-slate-500">
                Crie atestados, receitas de suplemento e encaminhamentos com
                CID-10 e assinatura.
              </p>
            </div>
          ) : (
            <ul className="space-y-2">
              {data.docs.map((d) => (
                <li
                  key={d.id}
                  className="rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <Link
                          href={`/app/patients/${id}/documents/${d.id}`}
                          className="text-base font-semibold text-teal-700 hover:underline truncate"
                        >
                          {d.title}
                        </Link>
                        <span
                          className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${
                            STATUS_STYLE[d.status] ??
                            "bg-slate-200 text-slate-600"
                          }`}
                        >
                          {d.status}
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-600">
                        📄 {TYPE_LABELS[d.documentType] ?? d.documentType} •
                        Emissor: {d.issuerName}
                        {d.issuerCrn && ` (CRN ${d.issuerCrn})`}
                      </p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {d.issuedAt ? (
                          <>
                            Emitido em{" "}
                            {new Date(d.issuedAt).toLocaleDateString("pt-BR", {
                              day: "2-digit",
                              month: "2-digit",
                              year: "numeric",
                            })}
                          </>
                        ) : (
                          <>
                            Criado em{" "}
                            {new Date(d.createdAt).toLocaleDateString("pt-BR")}{" "}
                            (rascunho)
                          </>
                        )}
                        {d.revokedAt && (
                          <span className="ml-2 text-red-600">
                            • Revogado em{" "}
                            {new Date(d.revokedAt).toLocaleDateString("pt-BR")}
                          </span>
                        )}
                      </p>
                    </div>
                    <a
                      href={`/api/v1/documents/${d.id}/pdf`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium hover:bg-slate-50"
                    >
                      📥 PDF
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
