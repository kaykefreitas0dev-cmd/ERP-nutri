import Link from "next/link";
import { redirect } from "next/navigation";
import {
  Settings,
  Building2,
  Palette,
  TriangleAlert,
  ChevronLeft,
} from "lucide-react";
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
      // CORREÇÃO: serializado (pg adapter dentro de tx não suporta paralelo).
      const org = await tx.organization.findUnique({
        where: { id: organizationId },
        select: { id: true, name: true, slug: true, plan: true },
      });
      const branding = await tx.organizationBranding.findUnique({
        where: { organizationId },
        select: {
          logoUrl: true,
          primaryColor: true,
          emailFromName: true,
        },
      });
      const membership = await tx.membership.findFirst({
        where: { userId, organizationId },
        select: { role: true },
      });
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
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/app"
          className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Dashboard
        </Link>
        <header className="mt-3">
          <h1 className="flex items-center gap-2 text-h1 font-semibold tracking-tight text-text-primary">
            <Settings
              className="h-6 w-6 text-text-secondary"
              strokeWidth={1.75}
            />
            Configurações
          </h1>
          <p className="mt-1 text-caption text-text-secondary">
            Dados básicos da sua organização e branding.
          </p>
        </header>

        {!canEdit && (
          <div className="mt-4 flex items-start gap-2 rounded-md border border-warning-border bg-warning-bg p-3 text-caption text-warning">
            <TriangleAlert
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={1.75}
            />
            <span>
              Sua role ({data.role}) é read-only. Apenas{" "}
              <code className="rounded bg-warning-bg/50 px-1 font-mono text-tiny">
                org_owner
              </code>{" "}
              ou{" "}
              <code className="rounded bg-warning-bg/50 px-1 font-mono text-tiny">
                clinic_admin
              </code>{" "}
              podem editar.
            </span>
          </div>
        )}

        {/* Org básico */}
        <section className="mt-6 rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
          <h2 className="flex items-center gap-2 text-h3 font-semibold text-text-primary">
            <Building2
              className="h-4 w-4 text-text-secondary"
              strokeWidth={1.75}
            />
            Identificação
          </h2>
          <dl className="mt-4 grid grid-cols-2 gap-4 text-body">
            <div>
              <dt className="text-tiny font-medium uppercase tracking-wider text-text-muted">
                Nome
              </dt>
              <dd className="mt-1 font-medium text-text-primary">
                {data.org.name}
              </dd>
            </div>
            <div>
              <dt className="text-tiny font-medium uppercase tracking-wider text-text-muted">
                Slug (URL)
              </dt>
              <dd className="mt-1">
                <code className="rounded bg-bg-subtle px-1.5 py-0.5 font-mono text-tiny text-text-primary">
                  {data.org.slug}
                </code>
              </dd>
            </div>
            <div>
              <dt className="text-tiny font-medium uppercase tracking-wider text-text-muted">
                Plano
              </dt>
              <dd className="mt-1 text-text-primary">{data.org.plan}</dd>
            </div>
            <div>
              <dt className="text-tiny font-medium uppercase tracking-wider text-text-muted">
                ID
              </dt>
              <dd className="mt-1 font-mono text-tiny text-text-muted">
                {data.org.id}
              </dd>
            </div>
          </dl>
          <p className="mt-4 text-tiny text-text-muted">
            Mudança de nome/slug requer suporte (impacta URLs públicas e
            referências externas).
          </p>
        </section>

        {/* Branding */}
        <section className="mt-6 rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
          <h2 className="flex items-center gap-2 text-h3 font-semibold text-text-primary">
            <Palette
              className="h-4 w-4 text-text-secondary"
              strokeWidth={1.75}
            />
            Branding
          </h2>
          <p className="mt-1 text-caption text-text-secondary">
            Logo + cores aparecem nos PDFs (atestados, recibos) e emails de
            convite.
          </p>
          <div className="mt-4">
            <OrgSettingsForm
              orgId={data.org.id}
              initial={{
                logoUrl: data.branding?.logoUrl ?? "",
                primaryColor: data.branding?.primaryColor ?? "#16A34A",
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
