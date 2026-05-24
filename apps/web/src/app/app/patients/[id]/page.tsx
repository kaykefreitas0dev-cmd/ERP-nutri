import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import {
  ChevronLeft,
  Utensils,
  CircleCheck,
  FileText,
  Pencil,
  Lock,
  Archive,
  Calendar,
  MapPin,
  Video,
  Phone,
  ChevronRight,
  Activity,
  Flame,
  Wallet,
} from "lucide-react";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { Avatar } from "@repo/ui/avatar";
import { Badge } from "@repo/ui/badge";
import { StatusDot } from "@repo/ui/status-dot";
import { ClinicalNotesSection } from "./ClinicalNotesSection";
import { InvitePatientButton } from "./invites/InvitePatientButton";
import { AnonymizeButton } from "./anonymize/AnonymizeButton";
import { ExportDataButton } from "./export/ExportButton";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function PatientDetailPage({ params }: Props) {
  const { id } = await params;

  let patient: {
    id: string;
    fullName: string;
    preferredName: string | null;
    email: string | null;
    phone: string | null;
    cpf: string | null;
    birthDate: Date | null;
    biologicalSex: string | null;
    city: string | null;
    state: string | null;
    occupation: string | null;
    notes: string | null;
    status: string;
    userId: string | null;
    createdAt: Date;
    updatedAt: Date;
    allergies: Array<{
      id: string;
      severity: string;
      allergen: { name: string; slug: string };
    }>;
    clinicalConditions: Array<{
      id: string;
      conditionName: string;
      severity: string | null;
    }>;
    invites: Array<{
      id: string;
      email: string;
      expiresAt: Date;
      acceptedAt: Date | null;
      revokedAt: Date | null;
    }>;
    upcomingAppointments: Array<{
      id: string;
      startsAt: Date;
      endsAt: Date;
      status: string;
      modality: string;
      timezone: string;
    }>;
    lastAnthropometry: {
      measuredAt: Date;
      weightKg: { toString: () => string } | null;
      heightCm: { toString: () => string } | null;
      bodyMassIndex: { toString: () => string } | null;
      bodyFatPctCalc: { toString: () => string } | null;
      basalMetabolismMifflin: { toString: () => string } | null;
    } | null;
    checkinStreak: {
      currentStreak: number;
      longestStreak: number;
      totalCheckins: number;
      lastCheckinDate: Date | null;
    } | null;
    paymentSummary: {
      totalCents: number;
      count: number;
      recentPayments: Array<{
        id: string;
        paymentDate: Date;
        amountCents: number;
        status: string;
        externalPaymentMethod: string | null;
        description: string | null;
      }>;
    } | null;
  } | null = null;

  try {
    patient = await withTenantAction(async ({ tx, organizationId, userId }) => {
      const p = await tx.patient.findFirst({
        where: { id },
        include: {
          allergies: {
            include: { allergen: { select: { name: true, slug: true } } },
          },
          clinicalConditions: { orderBy: { createdAt: "desc" } },
          invites: {
            orderBy: { createdAt: "desc" },
            take: 5,
            select: {
              id: true,
              email: true,
              expiresAt: true,
              acceptedAt: true,
              revokedAt: true,
            },
          },
        },
      });

      if (!p) return null;

      // Audit log: leitura de PHI
      await tx.$executeRaw`
        SELECT audit.append_log(
          ${organizationId}::uuid,
          ${userId}::uuid,
          'nutritionist'::text,
          NULL::inet, NULL::text,
          'patient.read'::text,
          'Patient'::text,
          ${p.id}::text,
          ${p.id}::uuid,
          ARRAY['fullName','email','phone','cpf']::text[],
          '{}'::jsonb
        )
      `;

      // Próximas consultas deste paciente (janela: agora + 90d), ou passadas recentes se vazio
      const now = new Date();
      const in90d = new Date(now.getTime() + 90 * 24 * 3_600_000);
      const upcoming = await tx.appointment.findMany({
        where: {
          patientId: p.id,
          startsAt: { gte: now, lte: in90d },
          status: { notIn: ["CANCELLED", "NO_SHOW"] },
        },
        orderBy: { startsAt: "asc" },
        take: 3,
        select: {
          id: true,
          startsAt: true,
          endsAt: true,
          status: true,
          modality: true,
          timezone: true,
        },
      });

      // Se sem futuras, mostrar as 3 mais recentes (qualquer status)
      const past =
        upcoming.length === 0
          ? await tx.appointment.findMany({
              where: { patientId: p.id, startsAt: { lt: now } },
              orderBy: { startsAt: "desc" },
              take: 3,
              select: {
                id: true,
                startsAt: true,
                endsAt: true,
                status: true,
                modality: true,
                timezone: true,
              },
            })
          : [];

      // Última medição de antropometria + streak de check-ins + pagamentos (paralelo)
      const [lastAnthropometry, checkinStreak, paymentSummary] =
        await Promise.all([
          tx.anthropometry.findFirst({
            where: { patientId: p.id },
            orderBy: { measuredAt: "desc" },
            select: {
              measuredAt: true,
              weightKg: true,
              heightCm: true,
              bodyMassIndex: true,
              bodyFatPctCalc: true,
              basalMetabolismMifflin: true,
            },
          }),
          p.userId
            ? tx.userHealthStreak.findUnique({
                where: { userId: p.userId },
                select: {
                  currentStreak: true,
                  longestStreak: true,
                  totalCheckins: true,
                  lastCheckinDate: true,
                },
              })
            : Promise.resolve(null),
          // Payment summary: aggregate + last 5 payments
          (async () => {
            const [agg, recent] = await Promise.all([
              tx.patientPayment.aggregate({
                where: { patientId: p.id },
                _count: true,
                _sum: { amountCents: true },
              }),
              tx.patientPayment.findMany({
                where: { patientId: p.id },
                orderBy: { paymentDate: "desc" },
                take: 5,
                select: {
                  id: true,
                  paymentDate: true,
                  amountCents: true,
                  status: true,
                  externalPaymentMethod: true,
                  description: true,
                },
              }),
            ]);
            if ((agg._count as number) === 0) return null;
            return {
              totalCents: (agg._sum.amountCents as number | null) ?? 0,
              count: agg._count as number,
              recentPayments: recent as Array<{
                id: string;
                paymentDate: Date;
                amountCents: number;
                status: string;
                externalPaymentMethod: string | null;
                description: string | null;
              }>,
            };
          })(),
        ]);

      return {
        ...p,
        upcomingAppointments: [...upcoming, ...past],
        lastAnthropometry: lastAnthropometry ?? null,
        checkinStreak: checkinStreak ?? null,
        paymentSummary: paymentSummary ?? null,
      };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG") {
      redirect("/onboarding");
    }
    throw err;
  }

  if (!patient) notFound();

  function formatDate(d: Date | null): string {
    if (!d) return "—";
    return new Date(d).toLocaleDateString("pt-BR");
  }

  function calcAge(birthDate: Date | null): string | null {
    if (!birthDate) return null;
    const today = new Date();
    const bd = new Date(birthDate);
    let age = today.getFullYear() - bd.getFullYear();
    const m = today.getMonth() - bd.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
    return `${age} anos`;
  }

  const age = calcAge(patient.birthDate);
  const isAnonymized = patient.status === "ANONYMIZED";
  const isArchived = patient.status === "ARCHIVED";

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-5xl">
        {/* Back link */}
        <Link
          href="/app/patients"
          className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Pacientes
        </Link>

        {/* Header — avatar + nome + status + ações */}
        <header className="mt-3 flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-start gap-4">
            <Avatar name={patient.fullName} size="xl" />
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-h1 font-semibold tracking-tight text-text-primary">
                  {patient.fullName}
                </h1>
                {isAnonymized && (
                  <Badge
                    variant="warning"
                    leftIcon={<Lock className="h-3 w-3" strokeWidth={2} />}
                  >
                    Anonimizado
                  </Badge>
                )}
                {isArchived && (
                  <Badge
                    variant="neutral"
                    leftIcon={<Archive className="h-3 w-3" strokeWidth={2} />}
                  >
                    Arquivado
                  </Badge>
                )}
                {!isAnonymized && !isArchived && (
                  <Badge
                    variant="success"
                    leftIcon={<StatusDot status="active" pulse size={1.5} />}
                  >
                    Ativo
                  </Badge>
                )}
              </div>
              {patient.preferredName && (
                <p className="mt-0.5 text-caption text-text-secondary">
                  Prefere ser chamado de{" "}
                  <span className="font-medium text-text-primary">
                    {patient.preferredName}
                  </span>
                </p>
              )}
              <p className="mt-1 text-caption text-text-muted">
                {[
                  age,
                  patient.biologicalSex,
                  `Cliente desde ${formatDate(patient.createdAt)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Link
              href={`/app/patients/${patient.id}/anthropometry`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-3 text-body font-medium text-text-primary transition-colors hover:bg-bg-surface-hover hover:border-border-strong"
            >
              <Activity className="h-4 w-4" strokeWidth={1.75} />
              Antropometria
            </Link>
            <Link
              href={`/app/patients/${patient.id}/meal-plans`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-3 text-body font-medium text-text-primary transition-colors hover:bg-bg-surface-hover hover:border-border-strong"
            >
              <Utensils className="h-4 w-4" strokeWidth={1.75} />
              Planos
            </Link>
            <Link
              href={`/app/patients/${patient.id}/checkins`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-3 text-body font-medium text-text-primary transition-colors hover:bg-bg-surface-hover hover:border-border-strong"
            >
              <CircleCheck className="h-4 w-4" strokeWidth={1.75} />
              Check-ins
            </Link>
            <Link
              href={`/app/patients/${patient.id}/documents`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-3 text-body font-medium text-text-primary transition-colors hover:bg-bg-surface-hover hover:border-border-strong"
            >
              <FileText className="h-4 w-4" strokeWidth={1.75} />
              Documentos
            </Link>
            <Link
              href={`/app/patients/${patient.id}/edit`}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-3 text-body font-medium text-text-primary transition-colors hover:bg-bg-surface-hover hover:border-border-strong"
            >
              <Pencil className="h-4 w-4" strokeWidth={1.75} />
              Editar
            </Link>
          </div>
        </header>

        {/* Grid principal */}
        <div className="mt-8 grid grid-cols-1 gap-6 md:grid-cols-3">
          {/* Coluna 1: dados pessoais */}
          <div className="space-y-4">
            {/* Acesso ao app paciente */}
            <Section title="Acesso ao app">
              <InvitePatientButton
                patientId={patient.id}
                patientName={patient.fullName}
                defaultEmail={patient.email}
                hasLinkedAccount={Boolean(patient.userId)}
                hasActiveInvite={(() => {
                  const now = new Date();
                  return patient.invites.some(
                    (inv) =>
                      !inv.acceptedAt &&
                      !inv.revokedAt &&
                      new Date(inv.expiresAt) > now,
                  );
                })()}
                activeInviteId={(() => {
                  const now = new Date();
                  const inv = patient.invites.find(
                    (i) =>
                      !i.acceptedAt &&
                      !i.revokedAt &&
                      new Date(i.expiresAt) > now,
                  );
                  return inv?.id ?? null;
                })()}
                activeInviteEmail={(() => {
                  const now = new Date();
                  const inv = patient.invites.find(
                    (i) =>
                      !i.acceptedAt &&
                      !i.revokedAt &&
                      new Date(i.expiresAt) > now,
                  );
                  return inv?.email ?? null;
                })()}
                activeInviteExpiresAt={(() => {
                  const now = new Date();
                  const inv = patient.invites.find(
                    (i) =>
                      !i.acceptedAt &&
                      !i.revokedAt &&
                      new Date(i.expiresAt) > now,
                  );
                  return inv?.expiresAt ?? null;
                })()}
              />

              {/* Streak widget — visible only when patient has app access */}
              {patient.checkinStreak && (
                <div className="mt-3 flex items-center justify-between rounded-md border border-border-subtle bg-bg-subtle px-3 py-2">
                  <div className="flex items-center gap-1.5 text-tiny text-text-secondary">
                    <Flame
                      className="h-3.5 w-3.5 shrink-0"
                      strokeWidth={1.75}
                      style={{ color: "var(--color-warning)" }}
                    />
                    <span className="font-semibold tabular-nums text-text-primary">
                      {patient.checkinStreak.currentStreak}d
                    </span>
                    seguidos
                  </div>
                  <div className="text-tiny text-text-muted tabular-nums">
                    {patient.checkinStreak.totalCheckins} check-ins · recorde{" "}
                    {patient.checkinStreak.longestStreak}d
                  </div>
                </div>
              )}
            </Section>

            <Section title="Contato">
              <dl className="space-y-2.5 text-body">
                <DataRow label="Email" value={patient.email} />
                <DataRow label="Telefone" value={patient.phone} />
                <DataRow label="CPF" value={patient.cpf} />
                <DataRow
                  label="Cidade"
                  value={
                    patient.city
                      ? `${patient.city}${patient.state ? `/${patient.state}` : ""}`
                      : null
                  }
                />
                <DataRow label="Profissão" value={patient.occupation} />
              </dl>
            </Section>

            <Section title="Alergias" counter={patient.allergies.length}>
              {patient.allergies.length === 0 ? (
                <p className="text-caption text-text-muted">
                  Sem alergias registradas.
                </p>
              ) : (
                <ul className="space-y-2 text-body">
                  {patient.allergies.map((a) => {
                    const severe =
                      a.severity === "ANAPHYLAXIS" || a.severity === "HIGH";
                    const moderate = a.severity === "MODERATE";
                    return (
                      <li key={a.id} className="flex items-center gap-2">
                        <StatusDot
                          status={
                            severe
                              ? "danger"
                              : moderate
                                ? "warning"
                                : "inactive"
                          }
                          size={2}
                        />
                        <span>{a.allergen.name}</span>
                        <span className="text-tiny text-text-muted">
                          ({a.severity})
                        </span>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Section>

            <Section
              title="Condições clínicas"
              counter={patient.clinicalConditions.length}
            >
              {patient.clinicalConditions.length === 0 ? (
                <p className="text-caption text-text-muted">
                  Nenhuma registrada.
                </p>
              ) : (
                <ul className="space-y-1 text-body">
                  {patient.clinicalConditions.map((c) => (
                    <li key={c.id}>{c.conditionName}</li>
                  ))}
                </ul>
              )}
            </Section>

            {/* Última medição de antropometria */}
            <Section title="Última medição">
              {!patient.lastAnthropometry ? (
                <div className="space-y-2">
                  <p className="text-caption text-text-muted">
                    Nenhuma medição registrada.
                  </p>
                  <Link
                    href={`/app/patients/${patient.id}/anthropometry`}
                    className="inline-flex items-center gap-1 text-tiny text-brand-primary hover:text-brand-primary-hover"
                  >
                    <Activity className="h-3 w-3" strokeWidth={1.75} />
                    Registrar medição
                    <ChevronRight className="h-3 w-3" strokeWidth={2} />
                  </Link>
                </div>
              ) : (
                <div className="space-y-2">
                  <p className="text-tiny text-text-muted tabular-nums">
                    {new Date(
                      patient.lastAnthropometry.measuredAt,
                    ).toLocaleDateString("pt-BR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                  <dl className="space-y-1.5">
                    {patient.lastAnthropometry.weightKg && (
                      <AnthroRow
                        label="Peso"
                        value={`${parseFloat(patient.lastAnthropometry.weightKg.toString()).toFixed(1)} kg`}
                      />
                    )}
                    {patient.lastAnthropometry.heightCm && (
                      <AnthroRow
                        label="Altura"
                        value={`${parseFloat(patient.lastAnthropometry.heightCm.toString()).toFixed(0)} cm`}
                      />
                    )}
                    {patient.lastAnthropometry.bodyMassIndex && (
                      <AnthroRow
                        label="IMC"
                        value={
                          <BmiDisplay
                            bmi={parseFloat(
                              patient.lastAnthropometry.bodyMassIndex.toString(),
                            )}
                          />
                        }
                      />
                    )}
                    {patient.lastAnthropometry.bodyFatPctCalc && (
                      <AnthroRow
                        label="%GC"
                        value={`${parseFloat(patient.lastAnthropometry.bodyFatPctCalc.toString()).toFixed(1)}%`}
                      />
                    )}
                    {patient.lastAnthropometry.basalMetabolismMifflin && (
                      <AnthroRow
                        label="GEB"
                        value={`${Math.round(parseFloat(patient.lastAnthropometry.basalMetabolismMifflin.toString()))} kcal`}
                      />
                    )}
                  </dl>
                  <Link
                    href={`/app/patients/${patient.id}/anthropometry`}
                    className="mt-1 inline-flex items-center gap-1 text-tiny text-brand-primary hover:text-brand-primary-hover"
                  >
                    <Activity className="h-3 w-3" strokeWidth={1.75} />
                    Ver histórico
                    <ChevronRight className="h-3 w-3" strokeWidth={2} />
                  </Link>
                </div>
              )}
            </Section>

            {/* Consultas */}
            <Section title="Consultas">
              {patient.upcomingAppointments.length === 0 ? (
                <p className="text-caption text-text-muted">
                  Nenhuma consulta registrada.
                </p>
              ) : (
                <ul className="space-y-2">
                  {patient.upcomingAppointments.map((appt) => {
                    const isPast = new Date(appt.startsAt) < new Date();
                    const statusConfig: Record<
                      string,
                      { label: string; cls: string }
                    > = {
                      SCHEDULED: {
                        label: "Agendado",
                        cls: "bg-info-bg text-info ring-info-border",
                      },
                      CONFIRMED: {
                        label: "Confirmado",
                        cls: "bg-brand-primary-bg text-brand-primary ring-brand-primary/20",
                      },
                      CHECKED_IN: {
                        label: "Check-in",
                        cls: "bg-info-bg text-info ring-info-border",
                      },
                      COMPLETED: {
                        label: "Realizada",
                        cls: "bg-success-bg text-success ring-success-border",
                      },
                      CANCELLED: {
                        label: "Cancelada",
                        cls: "bg-bg-subtle text-text-muted ring-border-subtle",
                      },
                      NO_SHOW: {
                        label: "No-show",
                        cls: "bg-danger-bg text-danger ring-danger-border",
                      },
                    };
                    const sc = statusConfig[appt.status] ?? {
                      label: appt.status,
                      cls: "bg-bg-subtle text-text-muted ring-border-subtle",
                    };
                    const ModalityIcon =
                      appt.modality === "video"
                        ? Video
                        : appt.modality === "phone"
                          ? Phone
                          : MapPin;

                    return (
                      <li
                        key={appt.id}
                        className={[
                          "rounded-md border p-2.5",
                          isPast && appt.status !== "SCHEDULED"
                            ? "border-border-subtle bg-bg-subtle opacity-75"
                            : "border-border-subtle bg-bg-surface",
                        ].join(" ")}
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="text-tiny font-semibold tabular-nums text-text-primary">
                              {new Date(appt.startsAt).toLocaleDateString(
                                "pt-BR",
                                {
                                  weekday: "short",
                                  day: "2-digit",
                                  month: "short",
                                  timeZone: appt.timezone,
                                },
                              )}{" "}
                              ·{" "}
                              {new Date(appt.startsAt).toLocaleTimeString(
                                "pt-BR",
                                {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                  timeZone: appt.timezone,
                                },
                              )}
                            </p>
                            <p className="mt-0.5 inline-flex items-center gap-1 text-tiny text-text-muted">
                              <ModalityIcon
                                className="h-3 w-3"
                                strokeWidth={1.75}
                              />
                              {appt.modality === "video"
                                ? "Videoconferência"
                                : appt.modality === "phone"
                                  ? "Telefone"
                                  : "Presencial"}
                            </p>
                          </div>
                          <span
                            className={[
                              "shrink-0 rounded-full px-1.5 py-0.5 text-tiny font-medium ring-1 ring-inset",
                              sc.cls,
                            ].join(" ")}
                          >
                            {sc.label}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
              <Link
                href={`/app/agenda?patientId=${patient.id}`}
                className="mt-3 inline-flex items-center gap-1 text-tiny text-brand-primary transition-colors hover:text-brand-primary-hover"
              >
                <Calendar className="h-3 w-3" strokeWidth={1.75} />
                Agendar consulta
                <ChevronRight className="h-3 w-3" strokeWidth={2} />
              </Link>
            </Section>

            {patient.notes && (
              <Section title="Notas administrativas">
                <p className="whitespace-pre-wrap text-body text-text-primary">
                  {patient.notes}
                </p>
              </Section>
            )}

            {/* Pagamentos do paciente */}
            {patient.paymentSummary && (
              <Section
                title="Pagamentos"
                counter={patient.paymentSummary.count}
              >
                {/* Aggregate total */}
                <div className="mb-3 flex items-baseline gap-2">
                  <Wallet
                    className="h-4 w-4 shrink-0 text-text-muted"
                    strokeWidth={1.75}
                  />
                  <span className="text-h3 font-semibold tabular-nums text-text-primary">
                    R${" "}
                    {(patient.paymentSummary.totalCents / 100).toLocaleString(
                      "pt-BR",
                      { minimumFractionDigits: 2, maximumFractionDigits: 2 },
                    )}
                  </span>
                  <span className="text-tiny text-text-muted">total pago</span>
                </div>

                {/* Recent payments list */}
                <ul className="space-y-1.5">
                  {patient.paymentSummary.recentPayments.map((pmt) => {
                    const methodLabels: Record<string, string> = {
                      PIX: "PIX",
                      CARD_EXTERNAL: "Cartão",
                      CASH: "Dinheiro",
                      BANK_TRANSFER: "Transferência",
                      OTHER: "Outro",
                    };
                    const statusLabel =
                      pmt.status === "EXTERNAL_RECORDED"
                        ? "Registrado"
                        : pmt.status === "PAID"
                          ? "Pago"
                          : pmt.status === "REFUNDED"
                            ? "Estornado"
                            : pmt.status === "CANCELLED"
                              ? "Cancelado"
                              : pmt.status;

                    const isCancelled =
                      pmt.status === "CANCELLED" || pmt.status === "REFUNDED";

                    return (
                      <li
                        key={pmt.id}
                        className="flex items-center justify-between gap-2 rounded-md bg-bg-subtle px-2.5 py-1.5 text-tiny"
                      >
                        <div className="flex min-w-0 flex-col">
                          <span className="tabular-nums text-text-muted">
                            {new Date(pmt.paymentDate).toLocaleDateString(
                              "pt-BR",
                            )}
                          </span>
                          {pmt.description && (
                            <span className="truncate text-text-secondary">
                              {pmt.description}
                            </span>
                          )}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {pmt.externalPaymentMethod && (
                            <span className="text-text-muted">
                              {methodLabels[pmt.externalPaymentMethod] ??
                                pmt.externalPaymentMethod}
                            </span>
                          )}
                          <span
                            className={[
                              "font-semibold tabular-nums",
                              isCancelled
                                ? "text-text-muted line-through"
                                : "text-text-primary",
                            ].join(" ")}
                          >
                            R${" "}
                            {(pmt.amountCents / 100).toLocaleString("pt-BR", {
                              minimumFractionDigits: 2,
                            })}
                          </span>
                          <span
                            className={[
                              "rounded-full px-1.5 py-0.5 text-tiny font-medium ring-1 ring-inset",
                              isCancelled
                                ? "bg-danger-bg text-danger ring-danger-border"
                                : "bg-success-bg text-success ring-success-border",
                            ].join(" ")}
                          >
                            {statusLabel}
                          </span>
                        </div>
                      </li>
                    );
                  })}
                </ul>

                {patient.paymentSummary.count > 5 && (
                  <p className="mt-2 text-tiny text-text-muted">
                    Mostrando os 5 pagamentos mais recentes de{" "}
                    {patient.paymentSummary.count} no total.
                  </p>
                )}

                <Link
                  href="/app/financeiro"
                  className="mt-3 inline-flex items-center gap-1 text-tiny text-brand-primary transition-colors hover:text-brand-primary-hover"
                >
                  <Wallet className="h-3 w-3" strokeWidth={1.75} />
                  Ver financeiro completo
                  <ChevronRight className="h-3 w-3" strokeWidth={2} />
                </Link>
              </Section>
            )}

            {/* Privacidade / LGPD */}
            <section className="rounded-lg border border-border-subtle bg-bg-subtle p-4">
              <h2 className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
                Privacidade (LGPD)
              </h2>
              <p className="mt-2 text-tiny text-text-secondary">
                Exporte (Art. 18 II — portabilidade), arquive ou anonimize (Art.
                18 V — esquecimento, irreversível).
              </p>
              <div className="mt-3 space-y-2">
                <ExportDataButton patientId={patient.id} />
                <AnonymizeButton
                  patientId={patient.id}
                  patientName={patient.fullName}
                  status={patient.status}
                />
              </div>
            </section>
          </div>

          {/* Coluna 2-3: Prontuário (Clinical Notes) */}
          <div className="md:col-span-2">
            <ClinicalNotesSection patientId={patient.id} />
          </div>
        </div>
      </div>
    </main>
  );
}

function Section({
  title,
  counter,
  children,
}: {
  title: string;
  counter?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-lg border border-border-subtle bg-bg-surface p-4 [box-shadow:var(--shadow-xs)]">
      <h2 className="flex items-center gap-2 text-h3 font-semibold text-text-primary">
        {title}
        {counter != null && (
          <span className="text-caption font-normal text-text-muted tabular-nums">
            ({counter})
          </span>
        )}
      </h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function DataRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="grid grid-cols-[110px_1fr] items-baseline gap-2">
      <dt className="text-tiny font-medium uppercase tracking-wider text-text-muted">
        {label}
      </dt>
      <dd className="text-body text-text-primary">
        {value || <span className="text-text-subtle">—</span>}
      </dd>
    </div>
  );
}

function AnthroRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <dt className="text-tiny font-medium text-text-muted">{label}</dt>
      <dd className="text-tiny font-semibold tabular-nums text-text-primary">
        {value}
      </dd>
    </div>
  );
}

function BmiDisplay({ bmi }: { bmi: number }) {
  const { label, cls } =
    bmi < 18.5
      ? { label: "Abaixo do peso", cls: "text-warning" }
      : bmi < 25
        ? { label: "Eutrófico", cls: "text-success" }
        : bmi < 30
          ? { label: "Sobrepeso", cls: "text-warning" }
          : bmi < 35
            ? { label: "Obesidade G1", cls: "text-danger" }
            : bmi < 40
              ? { label: "Obesidade G2", cls: "text-danger" }
              : { label: "Obesidade G3", cls: "text-danger" };

  return (
    <span>
      {bmi.toFixed(1)}{" "}
      <span className={`text-[10px] font-medium ${cls}`}>{label}</span>
    </span>
  );
}
