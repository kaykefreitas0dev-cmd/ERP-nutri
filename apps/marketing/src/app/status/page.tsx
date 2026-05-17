import { Container } from "@repo/ui/container";
import { Card, CardContent } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";

interface ServiceStatus {
  label: string;
  status: "operational" | "degraded" | "partial_outage" | "major_outage";
  observed_at: string;
  latency_ms: number | null;
}

interface StatusResponse {
  status: "operational" | "degraded" | "partial_outage" | "major_outage" | "unknown";
  services: ServiceStatus[];
  last_check: string | null;
  error?: string;
}

const STATUS_API_URL =
  process.env.NEXT_PUBLIC_STATUS_API_URL ??
  process.env.STATUS_API_URL ??
  "https://erp-nutri-web.vercel.app/api/public/status";

const STATUS_LABELS: Record<
  ServiceStatus["status"] | "unknown",
  { pt: string; emoji: string; variant: "success" | "warning" | "danger" | "secondary" }
> = {
  operational: { pt: "Operacional", emoji: "🟢", variant: "success" },
  degraded: { pt: "Degradado", emoji: "🟡", variant: "warning" },
  partial_outage: { pt: "Falha parcial", emoji: "🟠", variant: "warning" },
  major_outage: { pt: "Falha total", emoji: "🔴", variant: "danger" },
  unknown: { pt: "Desconhecido", emoji: "⚪", variant: "secondary" },
};

async function fetchStatus(): Promise<StatusResponse> {
  try {
    const res = await fetch(STATUS_API_URL, { next: { revalidate: 60 } });
    if (!res.ok)
      return { status: "unknown", services: [], last_check: null, error: "API unavailable" };
    return (await res.json()) as StatusResponse;
  } catch (err) {
    return {
      status: "unknown",
      services: [],
      last_check: null,
      error: err instanceof Error ? err.message : "Unknown",
    };
  }
}

export const dynamic = "force-dynamic";
export const revalidate = 60;

export const metadata = {
  title: "Status — NutriCore",
  description: "Estado em tempo real dos serviços da plataforma NutriCore.",
};

export default async function StatusPage() {
  const data = await fetchStatus();
  const overall = STATUS_LABELS[data.status];

  return (
    <>
      <SiteHeader />
      <main className="bg-slate-50 py-12">
        <Container size="md">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">
              Status NutriCore
            </h1>
            <p className="mt-2 text-sm text-slate-600">
              Última verificação:{" "}
              {data.last_check
                ? new Date(data.last_check).toLocaleString("pt-BR", {
                    timeZone: "America/Sao_Paulo",
                  })
                : "—"}
            </p>
          </div>

          <Card className="mt-6">
            <CardContent className="flex items-center gap-4 p-6">
              <span className="text-4xl" aria-hidden>
                {overall.emoji}
              </span>
              <div>
                <h2 className="text-xl font-semibold text-slate-900">{overall.pt}</h2>
                <p className="text-sm text-slate-600">Status geral da plataforma</p>
              </div>
            </CardContent>
          </Card>

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">Serviços</h2>

            {data.services.length === 0 ? (
              <Card className="mt-4">
                <CardContent className="py-6 text-center text-sm text-amber-700">
                  ⚠️ Nenhum dado de status disponível ainda. O worker de
                  monitoramento está sendo configurado.
                </CardContent>
              </Card>
            ) : (
              <ul className="mt-4 space-y-2">
                {data.services.map((service) => {
                  const label = STATUS_LABELS[service.status];
                  return (
                    <li key={service.label}>
                      <Card>
                        <CardContent className="flex items-center justify-between p-4">
                          <div className="flex items-center gap-3">
                            <span className="text-xl" aria-hidden>
                              {label.emoji}
                            </span>
                            <span className="font-medium text-slate-900">
                              {service.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={label.variant}>{label.pt}</Badge>
                            {service.latency_ms != null && (
                              <span className="text-xs text-slate-400">
                                {service.latency_ms}ms
                              </span>
                            )}
                          </div>
                        </CardContent>
                      </Card>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          <footer className="mt-12 text-center text-xs text-slate-400">
            Atualizado a cada 5 minutos via Cloudflare Workers Cron.
            <br />
            SLO MVP: 99,0% (janela manutenção: dom 02h-04h BRT).
          </footer>
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
