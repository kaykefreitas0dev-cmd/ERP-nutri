import Link from "next/link";
import {
  MessageSquare,
  TrendingUp,
  TrendingDown,
  Minus,
  ExternalLink,
} from "lucide-react";
import { prisma } from "@nutricore/db";
import { StatusDot } from "@repo/ui/status-dot";

export const dynamic = "force-dynamic";
export const metadata = { title: "NPS · Admin" };

interface NpsResponse {
  id: string;
  organizationId: string;
  userId: string;
  score: number;
  comment: string | null;
  context: string | null;
  userAgent: string | null;
  createdAt: Date;
}

interface OrgInfo {
  id: string;
  name: string;
  slug: string;
}

interface UserInfo {
  id: string;
  email: string | null;
  fullName: string | null;
}

function classifyScore(s: number): "promoter" | "passive" | "detractor" {
  if (s >= 9) return "promoter";
  if (s >= 7) return "passive";
  return "detractor";
}

function calculateNps(responses: NpsResponse[]): number | null {
  if (responses.length === 0) return null;
  const promoters = responses.filter(
    (r) => classifyScore(r.score) === "promoter",
  ).length;
  const detractors = responses.filter(
    (r) => classifyScore(r.score) === "detractor",
  ).length;
  return Math.round(((promoters - detractors) / responses.length) * 100);
}

/**
 * Particiona respostas em janelas de 30 dias (last30 vs prev30).
 * Função separada pra satisfazer react-hooks/purity (Date.now é impuro).
 */
function partitionByWindow(
  responses: NpsResponse[],
  nowMs: number,
): { last30: NpsResponse[]; prev30: NpsResponse[] } {
  const last30: NpsResponse[] = [];
  const prev30: NpsResponse[] = [];
  for (const r of responses) {
    const age = nowMs - r.createdAt.getTime();
    if (age < 30 * 86_400_000) last30.push(r);
    else if (age < 60 * 86_400_000) prev30.push(r);
  }
  return { last30, prev30 };
}

export default async function NpsDashboardPage() {
  // Super admin acessa todas as respostas (sem RLS via prisma direto).
  const responses = await prisma.npsFeedback.findMany({
    orderBy: { createdAt: "desc" },
    take: 500,
  });

  // Load orgs + users referenced
  const orgIds = Array.from(new Set(responses.map((r) => r.organizationId)));
  const userIds = Array.from(new Set(responses.map((r) => r.userId)));

  const [orgs, users] = await Promise.all([
    prisma.organization.findMany({
      where: { id: { in: orgIds } },
      select: { id: true, name: true, slug: true },
    }),
    prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, fullName: true },
    }),
  ]);

  const orgMap = new Map<string, OrgInfo>(orgs.map((o) => [o.id, o]));
  const userMap = new Map<string, UserInfo>(users.map((u) => [u.id, u]));

  // Aggregates
  const total = responses.length;
  const promoters = responses.filter(
    (r) => classifyScore(r.score) === "promoter",
  );
  const passives = responses.filter(
    (r) => classifyScore(r.score) === "passive",
  );
  const detractors = responses.filter(
    (r) => classifyScore(r.score) === "detractor",
  );
  const npsScore = calculateNps(responses);

  // Average score (separate from NPS)
  const avgScore =
    total > 0
      ? (responses.reduce((s, r) => s + r.score, 0) / total).toFixed(1)
      : "—";

  // Last 30 days vs previous 30 days (trend)
  // eslint-disable-next-line react-hooks/purity -- Server Component, Date.now() é OK
  const { last30, prev30 } = partitionByWindow(responses, Date.now());
  const npsLast30 = calculateNps(last30);
  const npsPrev30 = calculateNps(prev30);
  const trend =
    npsLast30 != null && npsPrev30 != null ? npsLast30 - npsPrev30 : null;

  return (
    <div className="mx-auto max-w-6xl">
      <header className="mb-6">
        <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
          Beta feedback
        </p>
        <h1 className="mt-0.5 flex items-center gap-2 text-h1 font-semibold tracking-tight text-text-primary">
          <MessageSquare
            className="h-6 w-6 text-text-secondary"
            strokeWidth={1.75}
          />
          NPS dashboard
        </h1>
        <p className="mt-1 text-caption text-text-secondary tabular-nums">
          {total} respostas registradas · janela última {Math.min(total, 500)}
        </p>
      </header>

      {/* NPS hero card */}
      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div
          className={
            "rounded-lg border bg-bg-surface p-5 [box-shadow:var(--shadow-xs)] " +
            (npsScore == null
              ? "border-border-subtle"
              : npsScore >= 50
                ? "border-success-border"
                : npsScore >= 0
                  ? "border-warning-border"
                  : "border-danger-border")
          }
        >
          <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
            NPS atual
          </p>
          <div className="mt-1 flex items-baseline gap-2">
            <span
              className={
                "text-display font-semibold tabular-nums " +
                (npsScore == null
                  ? "text-text-muted"
                  : npsScore >= 50
                    ? "text-success"
                    : npsScore >= 0
                      ? "text-warning"
                      : "text-danger")
              }
            >
              {npsScore == null
                ? "—"
                : npsScore > 0
                  ? `+${npsScore}`
                  : npsScore}
            </span>
            {trend != null && trend !== 0 && (
              <span
                className={
                  "inline-flex items-center gap-0.5 text-caption font-medium tabular-nums " +
                  (trend > 0 ? "text-success" : "text-danger")
                }
              >
                {trend > 0 ? (
                  <TrendingUp className="h-4 w-4" strokeWidth={2} />
                ) : (
                  <TrendingDown className="h-4 w-4" strokeWidth={2} />
                )}
                {trend > 0 ? "+" : ""}
                {trend} vs 30d ant.
              </span>
            )}
            {trend === 0 && (
              <span className="inline-flex items-center gap-0.5 text-caption font-medium tabular-nums text-text-muted">
                <Minus className="h-4 w-4" strokeWidth={2} />
                estável
              </span>
            )}
          </div>
          <p className="mt-2 text-tiny text-text-muted">
            Score = (% promoters − % detractors)
          </p>
        </div>

        <div className="rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
          <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
            Nota média
          </p>
          <p className="mt-1 text-display font-semibold tabular-nums text-text-primary">
            {avgScore}
            <span className="text-h2 font-medium text-text-muted"> / 10</span>
          </p>
          <p className="mt-2 text-tiny text-text-muted tabular-nums">
            {total} respostas no total
          </p>
        </div>

        <div className="rounded-lg border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-xs)]">
          <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
            Distribuição
          </p>
          <div className="mt-2 space-y-1.5 text-caption">
            <BreakdownRow
              label="Promoters"
              count={promoters.length}
              total={total}
              dotStatus="active"
              tone="text-success"
            />
            <BreakdownRow
              label="Passives"
              count={passives.length}
              total={total}
              dotStatus="warning"
              tone="text-warning"
            />
            <BreakdownRow
              label="Detractors"
              count={detractors.length}
              total={total}
              dotStatus="danger"
              tone="text-danger"
            />
          </div>
        </div>
      </section>

      {/* Responses table */}
      <section className="mt-8 rounded-lg border border-border-subtle bg-bg-surface [box-shadow:var(--shadow-xs)]">
        <header className="border-b border-border-subtle px-5 py-3">
          <h2 className="text-h3 font-semibold text-text-primary">
            Respostas recentes ({total})
          </h2>
        </header>

        {total === 0 ? (
          <div className="px-5 py-10 text-center">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
              <MessageSquare className="h-5 w-5" strokeWidth={1.75} />
            </div>
            <p className="mt-3 text-h3 font-semibold text-text-primary">
              Sem respostas ainda
            </p>
            <p className="mt-1 text-caption text-text-secondary">
              Quando nutris no beta enviarem feedback pelo widget, aparecerá
              aqui.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="border-b border-border-subtle bg-bg-subtle/50">
                <tr>
                  <th className="px-5 py-2.5 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Quando
                  </th>
                  <th className="px-5 py-2.5 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Score
                  </th>
                  <th className="px-5 py-2.5 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Org / Usuário
                  </th>
                  <th className="px-5 py-2.5 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Comentário
                  </th>
                  <th className="px-5 py-2.5 text-left text-tiny font-semibold uppercase tracking-wider text-text-muted">
                    Contexto
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border-subtle">
                {responses.map((r) => {
                  const klass = classifyScore(r.score);
                  const org = orgMap.get(r.organizationId);
                  const user = userMap.get(r.userId);
                  return (
                    <tr key={r.id} className="hover:bg-bg-subtle/40">
                      <td className="px-5 py-3 align-top text-caption text-text-muted tabular-nums">
                        {r.createdAt.toLocaleString("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        })}
                      </td>
                      <td className="px-5 py-3 align-top">
                        <span
                          className={
                            "inline-flex h-7 w-7 items-center justify-center rounded-md text-body font-semibold tabular-nums ring-1 ring-inset " +
                            (klass === "promoter"
                              ? "bg-success-bg text-success ring-success-border"
                              : klass === "passive"
                                ? "bg-warning-bg text-warning ring-warning-border"
                                : "bg-danger-bg text-danger ring-danger-border")
                          }
                        >
                          {r.score}
                        </span>
                      </td>
                      <td className="px-5 py-3 align-top text-body">
                        {org ? (
                          <Link
                            href={`/app/orgs/${org.id}`}
                            className="inline-flex items-center gap-1 font-medium text-text-primary hover:text-brand-primary"
                          >
                            {org.name}
                            <ExternalLink
                              className="h-3 w-3 text-text-subtle"
                              strokeWidth={2}
                            />
                          </Link>
                        ) : (
                          <span className="text-text-muted">—</span>
                        )}
                        <p className="text-tiny text-text-muted">
                          {user?.fullName ?? user?.email ?? "—"}
                        </p>
                      </td>
                      <td className="max-w-md px-5 py-3 align-top text-caption text-text-secondary">
                        {r.comment ? (
                          <span className="italic">
                            &ldquo;{r.comment}&rdquo;
                          </span>
                        ) : (
                          <span className="text-text-subtle">
                            sem comentário
                          </span>
                        )}
                      </td>
                      <td className="px-5 py-3 align-top">
                        {r.context ? (
                          <code className="rounded bg-bg-subtle px-1.5 py-0.5 font-mono text-tiny text-text-secondary">
                            {r.context}
                          </code>
                        ) : (
                          <span className="text-tiny text-text-subtle">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function BreakdownRow({
  label,
  count,
  total,
  dotStatus,
  tone,
}: {
  label: string;
  count: number;
  total: number;
  dotStatus: "active" | "warning" | "danger";
  tone: string;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2">
      <StatusDot status={dotStatus} size={2} />
      <span className="flex-1 text-text-secondary">{label}</span>
      <span className={"font-medium tabular-nums " + tone}>
        {count} <span className="text-text-muted">({pct}%)</span>
      </span>
    </div>
  );
}
