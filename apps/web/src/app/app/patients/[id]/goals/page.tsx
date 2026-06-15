import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Target } from "lucide-react";
import { SectionHeader } from "@repo/ui/section-header";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { GoalForm } from "./GoalForm";
import { GoalCard } from "./GoalCard";
import type { GoalView } from "./goal-utils";

export const dynamic = "force-dynamic";
export const metadata = { title: "Metas do paciente" };

interface Props {
  params: Promise<{ id: string }>;
}

interface GoalRow {
  id: string;
  title: string;
  description: string | null;
  type: string;
  direction: string;
  startValue: { toString(): string } | null;
  targetValue: { toString(): string } | null;
  currentValue: { toString(): string } | null;
  unit: string | null;
  dueDate: Date | null;
  status: string;
  createdAt: Date;
}

const num = (v: { toString(): string } | null): number | null =>
  v != null ? Number(v.toString()) : null;

export default async function PatientGoalsPage({ params }: Props) {
  const { id } = await params;

  let data: {
    patient: { id: string; fullName: string };
    goals: GoalView[];
  } | null = null;

  try {
    data = await withTenantAction(async ({ tx }) => {
      const patient = await tx.patient.findFirst({
        where: { id },
        select: { id: true, fullName: true },
      });
      if (!patient) return null;

      const rows = await tx.patientGoal.findMany({
        where: { patientId: id },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 100,
        select: {
          id: true,
          title: true,
          description: true,
          type: true,
          direction: true,
          startValue: true,
          targetValue: true,
          currentValue: true,
          unit: true,
          dueDate: true,
          status: true,
          createdAt: true,
        },
      });

      const goals: GoalView[] = rows.map((r: GoalRow) => ({
        id: r.id,
        title: r.title,
        description: r.description,
        type: r.type,
        direction: r.direction,
        startValue: num(r.startValue),
        targetValue: num(r.targetValue),
        currentValue: num(r.currentValue),
        unit: r.unit,
        dueDate: r.dueDate ? r.dueDate.toISOString().slice(0, 10) : null,
        status: r.status,
        createdAt: r.createdAt.toISOString(),
      }));

      return { patient, goals };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  if (!data) notFound();

  const active = data.goals.filter((g) => g.status === "ACTIVE");
  const others = data.goals.filter((g) => g.status !== "ACTIVE");

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        <Link
          href={`/app/patients/${id}`}
          className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          {data.patient.fullName}
        </Link>
        <SectionHeader
          as="h1"
          label="Acompanhamento"
          className="mt-3"
          title={
            <span className="inline-flex items-center gap-2">
              <Target
                className="h-6 w-6 text-text-secondary"
                strokeWidth={1.75}
              />
              Metas
            </span>
          }
          description={
            <span className="tabular-nums">
              {active.length} ativa{active.length === 1 ? "" : "s"}
              {others.length > 0
                ? ` · ${others.length} concluída(s)/arquivada(s)`
                : ""}
            </span>
          }
        />

        <div className="mt-6 grid grid-cols-1 gap-6 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            {data.goals.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border-default bg-bg-surface p-12 text-center">
                <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-bg-subtle text-text-muted">
                  <Target className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <p className="mt-3 text-h3 font-semibold text-text-primary">
                  Nenhuma meta ainda
                </p>
                <p className="mt-1 text-caption text-text-secondary">
                  Defina a primeira meta para{" "}
                  {data.patient.fullName.split(" ")[0]} usando o formulário ao
                  lado.
                </p>
              </div>
            ) : (
              <>
                {active.length > 0 && (
                  <section>
                    <h2 className="mb-2.5 text-tiny font-semibold uppercase tracking-wider text-text-muted">
                      Em andamento
                    </h2>
                    <ul className="space-y-3">
                      {active.map((g) => (
                        <GoalCard key={g.id} goal={g} patientId={id} />
                      ))}
                    </ul>
                  </section>
                )}
                {others.length > 0 && (
                  <section>
                    <h2 className="mb-2.5 text-tiny font-semibold uppercase tracking-wider text-text-muted">
                      Concluídas e arquivadas
                    </h2>
                    <ul className="space-y-3">
                      {others.map((g) => (
                        <GoalCard key={g.id} goal={g} patientId={id} />
                      ))}
                    </ul>
                  </section>
                )}
              </>
            )}
          </div>

          <div>
            <GoalForm patientId={id} />
          </div>
        </div>
      </div>
    </main>
  );
}
