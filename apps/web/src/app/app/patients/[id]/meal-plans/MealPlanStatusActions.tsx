"use client";

import { useState, useTransition } from "react";
import { CheckCircle, Archive, PlayCircle, X, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { updateMealPlanStatusAction } from "./actions";

type MealPlanStatus =
  | "DRAFT"
  | "ACTIVE"
  | "COMPLETED"
  | "REPLACED"
  | "ARCHIVED";

interface Props {
  planId: string;
  patientId: string;
  status: MealPlanStatus;
}

interface ActionConfig {
  label: string;
  targetStatus: MealPlanStatus;
  confirmLabel: string;
  icon: typeof PlayCircle;
  className: string;
}

/** Actions available per status. */
const STATUS_ACTIONS: Partial<Record<MealPlanStatus, ActionConfig[]>> = {
  DRAFT: [
    {
      label: "Ativar",
      targetStatus: "ACTIVE",
      confirmLabel: "Ativar plano?",
      icon: PlayCircle,
      className:
        "text-success hover:bg-success-bg hover:text-success focus-visible:ring-success",
    },
  ],
  ACTIVE: [
    {
      label: "Concluir",
      targetStatus: "COMPLETED",
      confirmLabel: "Marcar como concluído?",
      icon: CheckCircle,
      className:
        "text-brand-primary hover:bg-brand-primary-bg hover:text-brand-primary focus-visible:ring-brand-primary",
    },
    {
      label: "Arquivar",
      targetStatus: "ARCHIVED",
      confirmLabel: "Arquivar plano?",
      icon: Archive,
      className:
        "text-text-muted hover:bg-bg-subtle hover:text-text-secondary focus-visible:ring-brand-primary",
    },
  ],
};

/**
 * MealPlanStatusActions — inline action buttons for transitioning meal plan status.
 * Buttons are hidden at rest (group-hover), revealed on hover.
 * Each button shows a one-step inline confirm before executing.
 */
export function MealPlanStatusActions({ planId, patientId, status }: Props) {
  const router = useRouter();
  const [confirmingTarget, setConfirmingTarget] =
    useState<MealPlanStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const actions = STATUS_ACTIONS[status];
  if (!actions || actions.length === 0) return null;

  function handleActionClick(targetStatus: MealPlanStatus) {
    setError(null);
    setConfirmingTarget(targetStatus);
  }

  function handleCancel() {
    setConfirmingTarget(null);
    setError(null);
  }

  function handleConfirm(targetStatus: MealPlanStatus) {
    startTransition(async () => {
      const result = await updateMealPlanStatusAction({
        mealPlanId: planId,
        status: targetStatus,
      });
      if (result.ok) {
        setConfirmingTarget(null);
        router.refresh();
      } else {
        setError(result.message ?? "Erro ao atualizar status");
      }
    });
  }

  // Confirming state: show confirm/cancel inline
  if (confirmingTarget !== null) {
    const actionCfg = actions.find((a) => a.targetStatus === confirmingTarget)!;
    return (
      <div className="mt-2 flex flex-col gap-1.5">
        <p className="text-tiny text-text-secondary">
          {actionCfg.confirmLabel}
        </p>
        {error && <p className="text-tiny text-danger">{error}</p>}
        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => handleConfirm(confirmingTarget)}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded px-2.5 py-1 text-tiny font-medium bg-brand-primary text-white transition-opacity hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? (
              <>
                <Loader2 className="h-3 w-3 animate-spin" strokeWidth={2} />
                Salvando…
              </>
            ) : (
              "Confirmar"
            )}
          </button>
          <button
            type="button"
            onClick={handleCancel}
            disabled={isPending}
            className="inline-flex items-center gap-1 rounded px-2 py-1 text-tiny text-text-secondary transition-colors hover:text-text-primary disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" strokeWidth={2} />
            Cancelar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="mt-2 flex items-center gap-1 opacity-0 transition-opacity group-hover:opacity-100 focus-within:opacity-100">
      {actions.map((action) => {
        const Icon = action.icon;
        return (
          <button
            key={action.targetStatus}
            type="button"
            onClick={() => handleActionClick(action.targetStatus)}
            title={action.label}
            aria-label={action.label}
            className={`inline-flex items-center gap-1 rounded px-2 py-1 text-tiny font-medium transition-colors focus-visible:outline-none focus-visible:ring-1 ${action.className}`}
          >
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
            {action.label}
          </button>
        );
      })}
    </div>
  );
}
