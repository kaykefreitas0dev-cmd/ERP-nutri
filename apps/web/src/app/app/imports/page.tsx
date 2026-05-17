import Link from "next/link";
import { redirect } from "next/navigation";
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
    if (err instanceof ActionTenantError && err.code === "NO_ORG") redirect("/onboarding");
    throw err;
  }

  return (
    <main className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-5xl">
        <header className="mb-6">
          <Link href="/app" className="text-sm text-teal-700 hover:underline">
            ← Dashboard
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">Importar pacientes</h1>
          <p className="mt-1 text-sm text-slate-600">
            Migre seus pacientes de outros sistemas (Dietbox, Webdiet) ou via CSV genérico.
          </p>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2">
            <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
              <ImportWizard />
            </div>
          </div>

          <aside>
            <h2 className="text-sm font-semibold text-slate-900">Importações recentes</h2>
            {imports.length === 0 ? (
              <p className="mt-3 rounded-md border border-dashed border-slate-300 p-3 text-xs text-slate-500">
                Nenhuma importação ainda.
              </p>
            ) : (
              <ul className="mt-3 space-y-2">
                {imports.map((imp) => (
                  <li
                    key={imp.id}
                    className="rounded-md border border-slate-200 bg-white p-3 text-xs"
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-slate-900">
                        {imp.originalFileName}
                      </span>
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs ${
                          imp.status === "COMPLETED"
                            ? "bg-green-100 text-green-800"
                            : imp.status === "FAILED"
                              ? "bg-red-100 text-red-800"
                              : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {imp.status}
                      </span>
                    </div>
                    <div className="mt-1 text-slate-500">
                      {imp.source} • {imp.processedRows}/{imp.totalRows} ok •{" "}
                      {imp.errorRows} erros
                    </div>
                    <div className="text-slate-400">
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
