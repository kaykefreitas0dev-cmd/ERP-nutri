import Link from "next/link";
import { redirect } from "next/navigation";
import {
  ChevronLeft,
  DatabaseBackup,
  TriangleAlert,
  ShieldCheck,
} from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { ExportOrgButton } from "./ExportOrgButton";

export const dynamic = "force-dynamic";
export const metadata = { title: "Portabilidade de dados" };

export default async function PortabilidadePage() {
  let role = "member";
  let orgName = "";
  try {
    const data = await withTenantAction(
      async ({ tx, organizationId, role: memberRole }) => {
        const org = await tx.organization.findUnique({
          where: { id: organizationId },
          select: { name: true },
        });
        return { role: memberRole, orgName: org?.name ?? "" };
      },
    );
    role = data.role;
    orgName = data.orgName;
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG") {
      redirect("/onboarding");
    }
    throw err;
  }

  const isOwner = role === "org_owner";

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/app/settings"
          className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Configurações
        </Link>

        <header className="mt-3">
          <h1 className="flex items-center gap-2 text-h1 font-semibold tracking-tight text-text-primary">
            <DatabaseBackup
              className="h-6 w-6 text-text-secondary"
              strokeWidth={1.75}
            />
            Portabilidade de dados
          </h1>
          <p className="mt-1 text-caption text-text-secondary">
            Exporte todos os dados de <strong>{orgName}</strong> em um único
            arquivo (.zip) — direito de portabilidade (LGPD, Art. 18).
          </p>
        </header>

        {!isOwner ? (
          <div className="mt-6 flex items-start gap-2 rounded-md border border-warning-border bg-warning-bg p-4 text-caption text-warning">
            <TriangleAlert
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={1.75}
            />
            <span>
              Apenas o proprietário da organização (
              <code className="rounded bg-warning-bg/50 px-1 font-mono text-tiny">
                org_owner
              </code>
              ) pode exportar todos os dados da clínica. Sua role atual é{" "}
              <code className="rounded bg-warning-bg/50 px-1 font-mono text-tiny">
                {role}
              </code>
              .
            </span>
          </div>
        ) : (
          <section className="mt-6 rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
            <h2 className="flex items-center gap-2 text-h3 font-semibold text-text-primary">
              <ShieldCheck
                className="h-4 w-4 text-text-secondary"
                strokeWidth={1.75}
              />
              Exportação completa
            </h2>
            <p className="mt-2 text-caption text-text-secondary">
              O arquivo inclui: dados da organização e branding, equipe,
              pacientes (dados pessoais, anamnese, antropometria, índice de
              planos e documentos, pagamentos), agendamentos e o log de
              auditoria recente. Anotações clínicas criptografadas não são
              incluídas; planos completos e PDFs podem ser baixados em cada
              paciente.
            </p>
            <ExportOrgButton />
          </section>
        )}
      </div>
    </main>
  );
}
