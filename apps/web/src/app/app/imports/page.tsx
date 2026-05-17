import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { ImportWizard } from "./ImportWizard";

export const dynamic = "force-dynamic";
export const metadata = { title: "Importar dados" };

export default async function ImportsPage() {
  let imports: Array<{
    id: string;
    source: string;
    status: string;
    originalFileName: string;
    totalRows: number;
    processedRows: number;
    errorRows: number;
    createdAt: Date;
  }> = [];

  try {
    imports = await withTenantAction(async ({ tx }) => {
      return tx.dataImport.findMany({
        orderBy: { createdAt: "desc" },
        take: 20,
        select: {
          id: true,
          source: true,
          status: true,
          originalFileName: true,
          totalRows: true,
          processedRows: true,
          errorRows: true,
          createdAt: true,
        },
      });
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <Link
            href="/app"
            className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Dashboard
          </Link>
          <h1 className="mt-3 text-h1 font-semibold tracking-tight text-text-primary">
            Importar pacientes
          </h1>
          <p className="mt-1 text-caption text-text-secondary">
            Migre seus pacientes de outros sistemas (Dietbox, Webdiet) ou via
            CSV genérico.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-border-subtle bg-bg-surface p-6 [box-shadow:var(--shadow-xs)]">
              <ImportWizard />
            </div>
          </div>

          <aside>
            <h2 className="text-h3 font-semibold text-text-primary">
              Importações recentes
            </h2>
            {imports.length === 0 ? (
              <p className="mt-3 rounded-md border border-dashed border-border-default p-3 text-caption text-text-muted">
                Nenhuma importação ainda.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {imports.map((imp) => (
                  <li
                    key={imp.id}
                    className="rounded-md border border-border-subtle bg-bg-surface p-3 text-tiny [box-shadow:var(--shadow-xs)]"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="truncate font-medium text-text-primary">
                        {imp.originalFileName}
                      </span>
                      <span
                        className={
                          "shrink-0 rounded-full px-2 py-0.5 text-tiny font-medium ring-1 ring-inset " +
                          (imp.status === "COMPLETED"
                            ? "bg-success-bg text-success ring-success-border"
                            : imp.status === "FAILED"
                              ? "bg-danger-bg text-danger ring-danger-border"
                              : "bg-warning-bg text-warning ring-warning-border")
                        }
                      >
                        {imp.status}
                      </span>
                    </div>
                    <div className="mt-1 text-text-muted">
                      {imp.source} • {imp.processedRows}/{imp.totalRows} ok •{" "}
                      {imp.errorRows} erros
                    </div>
                    <div className="text-text-subtle tabular-nums">
                      {new Date(imp.createdAt).toLocaleString("pt-BR")}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
}
