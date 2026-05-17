import Link from "next/link";
import { redirect } from "next/navigation";
import { Settings, Building2, Palette, TriangleAlert } from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { OrgSettingsForm } from "./OrgSettingsForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Configurações da organização" };

export default async function SettingsPage() {
  let data: {
    org: { id: string; name: string; slug: string; plan: string };
    branding: {
      logoUrl: string | null;
      primaryColor: string | null;
      emailFromName: string | null;
    } | null;
    role: string;
  } | null = null;

  try {
    data = await withTenantAction(async ({ tx, organizationId, userId }) => {
      const [org, branding, membership] = await Promise.all([
        tx.organization.findUnique({
          where: { id: organizationId },
          select: { id: true, name: true, slug: true, plan: true },
        }),
        tx.organizationBranding.findUnique({
          where: { organizationId },
          select: {
            logoUrl: true,
            primaryColor: true,
            emailFromName: true,
          },
        }),
        tx.membership.findFirst({
          where: { userId, organizationId },
          select: { role: true },
        }),
      ]);
      if (!org) return null;
      return { org, branding, role: membership?.role ?? "member" };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG") {
      redirect("/onboarding");
    }
    throw err;
  }

  if (!data) return null;

  const canEdit = data.role === "org_owner" || data.role === "clinic_admin";

  return (
    <main className="bg-transparent p-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/app" className="text-sm text-teal-700 hover:underline">
          ← Dashboard
        </Link>
        <header className="mt-2">
          <h1 className="flex items-center gap-2 text-2xl font-bold text-slate-900">
            <Settings className="h-6 w-6" strokeWidth={1.75} />
            Configurações
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Dados básicos da sua organização e branding.
          </p>
        </header>

        {!canEdit && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-warning-border bg-warning-bg p-3 text-sm text-warning">
            <TriangleAlert
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={1.75}
            />
            <span>
              Sua role ({data.role}) é read-only. Apenas <code>org_owner</code>{" "}
              ou <code>clinic_admin</code> podem editar.
            </span>
          </div>
        )}

        {/* Org básico (read-only por enquanto) */}
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Building2 className="h-4 w-4" strokeWidth={1.75} />
            Identificação
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-sm">
            <div>
              <dt className="text-xs text-slate-500">Nome</dt>
              <dd className="font-medium">{data.org.name}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Slug (URL)</dt>
              <dd>
                <code className="rounded bg-slate-100 px-1.5 py-0.5 text-xs">
                  {data.org.slug}
                </code>
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Plano</dt>
              <dd>{data.org.plan}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">ID</dt>
              <dd className="font-mono text-[10px] text-slate-600">
                {data.org.id}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-xs text-slate-500">
            Mudança de nome/slug requer suporte (impacta URLs públicas e
            referências externas).
          </p>
        </section>

        {/* Branding */}
        <section className="mt-6 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="flex items-center gap-2 text-base font-semibold text-slate-900">
            <Palette className="h-4 w-4" strokeWidth={1.75} />
            Branding
          </h2>
          <p className="mt-1 text-xs text-slate-600">
            Logo + cores aparecem nos PDFs (atestados, recibos) e emails de
            convite.
          </p>
          <div className="mt-4">
            <OrgSettingsForm
              orgId={data.org.id}
              initial={{
                logoUrl: data.branding?.logoUrl ?? "",
                primaryColor: data.branding?.primaryColor ?? "#0F766E",
                emailFromName: data.branding?.emailFromName ?? data.org.name,
              }}
              disabled={!canEdit}
            />
          </div>
        </section>
      </div>
    </main>
  );
}
