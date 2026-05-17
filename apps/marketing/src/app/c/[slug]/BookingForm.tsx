"use client";

import { useState, useEffect, useTransition } from "react";
import { CircleCheck } from "lucide-react";
import { Card, CardContent } from "@repo/ui/card";
import { submitPublicBookingAction, getAvailableSlotsAction } from "./actions";

interface Service {
  id: string;
  name: string;
  description: string | null;
  durationMinutes: number;
  priceCents: number | null;
}

interface Props {
  bookingPageId: string;
  services: Service[];
  availabilityRules: Array<{
    dayOfWeek: number;
    startTime: string;
    endTime: string;
  }>;
  timezone: string;
  minNoticeHours: number;
  maxAdvanceDays: number;
}

function formatPrice(cents: number | null): string {
  if (cents == null) return "A combinar";
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(cents / 100);
}

export function BookingForm({
  bookingPageId,
  services,
  maxAdvanceDays,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<"service" | "datetime" | "details" | "done">(
    "service",
  );
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>("");
  const [selectedSlot, setSelectedSlot] = useState<string>("");
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Lazy init: capturado uma vez no mount (Date.now() é impure mas só roda 1x)
  const [dateBounds] = useState(() => {
    const now = Date.now();
    return {
      today: new Date(now).toISOString().slice(0, 10),
      maxDate: new Date(now + maxAdvanceDays * 24 * 3600_000)
        .toISOString()
        .slice(0, 10),
    };
  });
  const today = dateBounds.today;
  const maxDate = dateBounds.maxDate;

  // Buscar slots quando data selecionada (com flag de cancelamento para evitar race)
  useEffect(() => {
    if (!selectedDate || !selectedService) return;
    let cancelled = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoadingSlots(true);
    setAvailableSlots([]);
    getAvailableSlotsAction({
      bookingPageId,
      date: selectedDate,
      durationMinutes: selectedService.durationMinutes,
    })
      .then((r) => {
        if (cancelled) return;
        if (r.ok && r.slots) setAvailableSlots(r.slots);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });
    return () => {
      cancelled = true;
    };
  }, [selectedDate, selectedService, bookingPageId]);

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("bookingPageId", bookingPageId);
    formData.set("serviceOfferingId", selectedService!.id);
    formData.set("startsAt", selectedSlot);

    startTransition(async () => {
      const result = await submitPublicBookingAction(formData);
      if (!result.ok) {
        setError(result.message ?? "Erro");
        return;
      }
      setStep("done");
    });
  }

  if (step === "done") {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-bg text-success">
            <CircleCheck className="h-9 w-9" strokeWidth={1.75} />
          </div>
          <h2 className="mt-4 text-xl font-bold text-text-primary">
            Agendamento confirmado!
          </h2>
          <p className="mt-2 text-text-secondary">
            Você receberá um email com os detalhes em alguns minutos.
          </p>
          <p className="mt-4 text-sm text-text-muted">
            Em caso de dúvida ou para cancelar, entre em contato diretamente com
            o profissional.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="p-6">
        <h2 className="text-lg font-semibold text-text-primary">
          Agende sua consulta
        </h2>

        {/* Progress steps */}
        <div className="mt-4 flex items-center gap-2 text-xs">
          {(["service", "datetime", "details"] as const).map((s, i) => (
            <div key={s} className="flex items-center gap-2">
              <span
                className={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-medium ${
                  step === s
                    ? "bg-brand-primary text-white"
                    : isBeforeStep(s, step)
                      ? "bg-brand-100 text-brand-primary-hover"
                      : "bg-bg-muted text-text-muted"
                }`}
              >
                {i + 1}
              </span>
              <span className="capitalize">
                {s === "service"
                  ? "Serviço"
                  : s === "datetime"
                    ? "Horário"
                    : "Dados"}
              </span>
              {i < 2 && <span className="text-text-subtle">→</span>}
            </div>
          ))}
        </div>

        {error && (
          <div
            role="alert"
            className="mt-4 rounded-md bg-red-50 p-3 text-sm text-red-800"
          >
            {error}
          </div>
        )}

        <div className="mt-6">
          {step === "service" && (
            <div className="space-y-3">
              <p className="text-sm text-text-secondary">
                Escolha o tipo de consulta:
              </p>
              {services.length === 0 ? (
                <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                  Sem serviços configurados pelo profissional ainda.
                </p>
              ) : (
                services.map((s) => (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => {
                      setSelectedService(s);
                      setStep("datetime");
                    }}
                    className="block w-full rounded-md border border-border-subtle p-4 text-left transition-colors hover:border-brand-primary hover:bg-brand-primary-bg"
                  >
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="font-medium text-text-primary">
                          {s.name}
                        </div>
                        {s.description && (
                          <p className="mt-1 text-sm text-text-secondary">
                            {s.description}
                          </p>
                        )}
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-medium text-brand-primary">
                          {formatPrice(s.priceCents)}
                        </div>
                        <div className="text-xs text-text-muted">
                          {s.durationMinutes}min
                        </div>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
          )}

          {step === "datetime" && selectedService && (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep("service")}
                  className="text-sm text-brand-primary hover:underline"
                >
                  ← Trocar serviço
                </button>
                <span className="text-xs text-text-muted">
                  {selectedService.name} ({selectedService.durationMinutes}min)
                </span>
              </div>

              <div>
                <label
                  htmlFor="bookingDate"
                  className="block text-sm font-medium"
                >
                  Data *
                </label>
                <input
                  id="bookingDate"
                  type="date"
                  required
                  min={today}
                  max={maxDate}
                  value={selectedDate}
                  onChange={(e) => {
                    setSelectedDate(e.target.value);
                    setSelectedSlot("");
                  }}
                  className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-sm"
                />
              </div>

              {selectedDate && (
                <div>
                  <span className="block text-sm font-medium">
                    Horário disponível *
                  </span>
                  {loadingSlots ? (
                    <p className="mt-2 text-sm text-text-muted">
                      Buscando horários…
                    </p>
                  ) : availableSlots.length === 0 ? (
                    <p className="mt-2 rounded-md bg-amber-50 p-3 text-sm text-amber-800">
                      Nenhum horário disponível nesse dia. Tente outra data.
                    </p>
                  ) : (
                    <div className="mt-2 grid grid-cols-3 gap-2 sm:grid-cols-4">
                      {availableSlots.map((slot) => {
                        const t = new Date(slot);
                        const label = t.toLocaleTimeString("pt-BR", {
                          hour: "2-digit",
                          minute: "2-digit",
                        });
                        return (
                          <button
                            key={slot}
                            type="button"
                            onClick={() => {
                              setSelectedSlot(slot);
                              setStep("details");
                            }}
                            className={`rounded-md border px-3 py-2 text-sm transition-colors ${
                              selectedSlot === slot
                                ? "border-brand-primary bg-brand-primary text-white"
                                : "border-border-default bg-white hover:border-brand-primary"
                            }`}
                          >
                            {label}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {step === "details" && selectedService && selectedSlot && (
            <form action={handleSubmit} className="space-y-4">
              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setStep("datetime")}
                  className="text-sm text-brand-primary hover:underline"
                >
                  ← Mudar horário
                </button>
                <span className="text-xs text-text-muted">
                  {selectedService.name} •{" "}
                  {new Date(selectedSlot).toLocaleString("pt-BR")}
                </span>
              </div>

              <div>
                <label
                  htmlFor="patientName"
                  className="block text-sm font-medium"
                >
                  Seu nome *
                </label>
                <input
                  id="patientName"
                  name="patientName"
                  type="text"
                  required
                  autoComplete="name"
                  className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="patientEmail"
                  className="block text-sm font-medium"
                >
                  Email *
                </label>
                <input
                  id="patientEmail"
                  name="patientEmail"
                  type="email"
                  required
                  autoComplete="email"
                  className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="patientPhone"
                  className="block text-sm font-medium"
                >
                  WhatsApp / Telefone
                </label>
                <input
                  id="patientPhone"
                  name="patientPhone"
                  type="tel"
                  autoComplete="tel"
                  className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label htmlFor="notes" className="block text-sm font-medium">
                  Observações (opcional)
                </label>
                <textarea
                  id="notes"
                  name="notes"
                  rows={3}
                  placeholder="Conte um pouco do seu objetivo..."
                  className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-sm"
                />
              </div>

              <button
                type="submit"
                disabled={pending}
                className="w-full rounded-md bg-brand-primary px-4 py-2.5 text-sm font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
              >
                {pending ? "Confirmando…" : "Confirmar agendamento"}
              </button>

              <p className="text-xs text-text-muted">
                Ao confirmar você concorda com nossa{" "}
                <a href="/privacidade" className="text-brand-primary underline">
                  política de privacidade
                </a>
                .
              </p>
            </form>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

function isBeforeStep(target: string, current: string): boolean {
  const order = ["service", "datetime", "details", "done"];
  return order.indexOf(target) < order.indexOf(current);
}
