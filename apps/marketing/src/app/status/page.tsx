import { Container } from "@repo/ui/container";
import { Card, CardContent } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { StatusDot } from "@repo/ui/status-dot";
import { TriangleAlert } from "lucide-react";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";

interface ServiceStatus {
  label: string;
  status: "operational" | "degraded" | "partial_outage" | "major_outage";
  observed_at: string;
  latency_ms: number | null;
}

interface StatusResponse {
  status:
    | "operational"
    | "degraded"
    | "partial_outage"
    | "major_outage"
    | "unknown";
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
  {
    pt: string;
    dot: "active" | "warning" | "danger" | "inactive";
    variant: "success" | "warning" | "danger" | "neutral";
    pulse?: boolean;
  }
> = {
  operational: {
    pt: "Operacional",
    dot: "active",
    variant: "success",
    pulse: true,
  },
  degraded: { pt: "Degradado", dot: "warning", variant: "warning" },
  partial_outage: {
    pt: "Falha parcial",
    dot: "warning",
    variant: "warning",
  },
  major_outage: { pt: "Falha total", dot: "danger", variant: "danger" },
  unknown: { pt: "Desconhecido", dot: "inactive", variant: "neutral" },
};

async function fetchStatus(): Promise<StatusResponse> {
  try {
    const res = await fetch(STATUS_API_URL, { next: { revalidate: 60 } });
    if (!res.ok)
      return {
        status: "unknown",
        services: [],
        last_check: null,
        error: "API unavailable",
      };
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
      <main className="bg-bg-page py-12">
        <Container size="md">
          <div>
            <h1 className="text-3xl font-bold tracking-tight text-text-primary">
              Status NutriCore
            </h1>
            <p className="mt-2 text-sm text-text-secondary">
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
              <StatusDot
                status={overall.dot}
                pulse={overall.pulse}
                size={3.5}
              />
              <div>
                <h2 className="text-xl font-semibold text-text-primary">
                  {overall.pt}
                </h2>
                <p className="text-sm text-text-secondary">
                  Status geral da plataforma
                </p>
              </div>
            </CardContent>
          </Card>

          <section className="mt-8">
            <h2 className="text-lg font-semibold text-text-primary">
              Serviços
            </h2>

            {data.services.length === 0 ? (
              <Card className="mt-4">
                <CardContent className="flex items-center justify-center gap-2 py-6 text-sm text-warning">
                  <TriangleAlert className="h-4 w-4" strokeWidth={1.75} />
                  Nenhum dado de status disponível ainda. O worker de
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
                            <StatusDot
                              status={label.dot}
                              pulse={label.pulse}
                              size={2.5}
                            />
                            <span className="font-medium text-text-primary">
                              {service.label}
                            </span>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge variant={label.variant}>{label.pt}</Badge>
                            {service.latency_ms != null && (
                              <span className="text-xs text-text-muted tabular-nums">
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

          <footer className="mt-12 text-center text-xs text-text-subtle">
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
