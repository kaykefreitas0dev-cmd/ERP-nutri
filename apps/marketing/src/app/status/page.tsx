// /status — Status page pública
// v11.2 Diff B.7 + B.8 — fetcha /api/public/status do web (ou backend)
// Oculta nomes dos providers (Lock 0051)

import { unstable_cache } from "next/cache";

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
  "http://localhost:3000/api/public/status";

const STATUS_LABELS: Record<string, { pt: string; emoji: string }> = {
  operational: { pt: "Operacional", emoji: "🟢" },
  degraded: { pt: "Degradado", emoji: "🟡" },
  partial_outage: { pt: "Falha parcial", emoji: "🟠" },
  major_outage: { pt: "Falha total", emoji: "🔴" },
  unknown: { pt: "Desconhecido", emoji: "⚪" },
};

const fetchStatus = unstable_cache(
  async (): Promise<StatusResponse> => {
    try {
      const res = await fetch(STATUS_API_URL, {
        next: { revalidate: 60 },
      });
      if (!res.ok) {
        return { status: "unknown", services: [], last_check: null, error: "API unavailable" };
      }
      return (await res.json()) as StatusResponse;
    } catch (err) {
      return {
        status: "unknown",
        services: [],
        last_check: null,
        error: err instanceof Error ? err.message : "Unknown",
      };
    }
  },
  ["status-page"],
  { revalidate: 60 },
);

export const dynamic = "force-dynamic";
export const revalidate = 60;

export default async function StatusPage() {
  const data = await fetchStatus();
  const overall = STATUS_LABELS[data.status] ?? STATUS_LABELS.unknown!;

  return (
    <main className="mx-auto max-w-3xl px-6 py-12">
      <h1 className="mb-2 text-3xl font-bold">Status NutriCore</h1>
      <p className="mb-8 text-sm text-gray-600">
        Estado dos serviços da plataforma. Última verificação:{" "}
        {data.last_check ? new Date(data.last_check).toLocaleString("pt-BR") : "—"}
      </p>

      <section className="mb-8 rounded-lg border bg-white p-6 shadow-sm">
        <div className="flex items-center gap-3">
          <span className="text-3xl" aria-hidden>
            {overall.emoji}
          </span>
          <div>
            <h2 className="text-xl font-semibold">{overall.pt}</h2>
            <p className="text-sm text-gray-600">Status geral</p>
          </div>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Serviços</h2>
        {data.services.length === 0 ? (
          <p className="rounded-md bg-amber-50 p-4 text-sm text-amber-800">
            Nenhum dado de status disponível ainda. O worker de monitoring está
            sendo configurado (S2a).
          </p>
        ) : (
          <ul className="space-y-2">
            {data.services.map((service) => {
              const label = STATUS_LABELS[service.status] ?? STATUS_LABELS.unknown!;
              return (
                <li
                  key={service.label}
                  className="flex items-center justify-between rounded-md border bg-white p-4"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-xl" aria-hidden>
                      {label.emoji}
                    </span>
                    <span className="font-medium">{service.label}</span>
                  </div>
                  <div className="text-right text-sm text-gray-600">
                    <div>{label.pt}</div>
                    {service.latency_ms != null && (
                      <div className="text-xs text-gray-400">
                        {service.latency_ms}ms
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>

      <footer className="mt-12 text-center text-xs text-gray-400">
        Atualizado a cada 5 minutos via Cloudflare Workers Cron.
        <br />
        SLO MVP: 99,0% (janela manutenção: dom 02h-04h BRT).
      </footer>
    </main>
  );
}
