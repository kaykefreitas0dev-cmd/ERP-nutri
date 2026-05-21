"use client";

import { useState, useTransition, useRef } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Target, FileText, Loader2 } from "lucide-react";
import {
  updateMealPlanMetaAction,
  generateMealPlanPdfAction,
} from "../actions";

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  COMPLETED: "Concluído",
  REPLACED: "Substituído",
  ARCHIVED: "Arquivado",
};

interface Props {
  planId: string;
  patientId: string;
  initialName: string;
  initialTargetKcal: number | null;
  status: string;
  hasItems: boolean;
}

/**
 * Client component that renders the plan header with inline editing for:
 * - Plan name (h1 → text input, Enter/blur commits, Escape cancels)
 * - Target kcal (badge → number input, same pattern)
 *
 * Status badge is display-only (mutations via MealPlanStatusActions on the list page).
 */
export function PlanHeaderEditable({
  planId,
  patientId,
  initialName,
  initialTargetKcal,
  status,
  hasItems,
}: Props) {
  const router = useRouter();
  const [, startTransition] = useTransition();

  // PDF generation state
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [pdfDocId, setPdfDocId] = useState<string | null>(null);
  const [pdfError, setPdfError] = useState<string | null>(null);

  // Plan name editing
  const [editingName, setEditingName] = useState(false);
  const [nameValue, setNameValue] = useState(initialName);
  const [localName, setLocalName] = useState(initialName);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Target kcal editing
  const [editingKcal, setEditingKcal] = useState(false);
  const [kcalValue, setKcalValue] = useState(
    initialTargetKcal?.toString() ?? "",
  );
  const [localTargetKcal, setLocalTargetKcal] = useState(initialTargetKcal);
  const kcalInputRef = useRef<HTMLInputElement>(null);

  function startNameEdit() {
    setNameValue(localName);
    setEditingName(true);
    setTimeout(() => {
      nameInputRef.current?.select();
    }, 20);
  }

  function commitNameEdit() {
    const next = nameValue.trim();
    setEditingName(false);
    if (!next || next === localName || next.length < 2 || next.length > 120)
      return;
    setLocalName(next); // optimistic
    startTransition(async () => {
      const result = await updateMealPlanMetaAction({ planId, name: next });
      if (!result.ok) {
        setLocalName(localName); // revert
      } else {
        router.refresh();
      }
    });
  }

  function cancelNameEdit() {
    setNameValue(localName);
    setEditingName(false);
  }

  function startKcalEdit() {
    setKcalValue(localTargetKcal?.toString() ?? "");
    setEditingKcal(true);
    setTimeout(() => {
      kcalInputRef.current?.select();
    }, 20);
  }

  function commitKcalEdit() {
    setEditingKcal(false);
    const raw = kcalValue.trim();
    const next = raw === "" ? null : parseInt(raw, 10);
    if (next !== null && (isNaN(next) || next < 600 || next > 6000)) return;
    if (next === localTargetKcal) return;
    setLocalTargetKcal(next); // optimistic
    startTransition(async () => {
      const result = await updateMealPlanMetaAction({
        planId,
        targetKcal: next,
      });
      if (!result.ok) {
        setLocalTargetKcal(localTargetKcal); // revert
      } else {
        router.refresh();
      }
    });
  }

  function cancelKcalEdit() {
    setKcalValue(localTargetKcal?.toString() ?? "");
    setEditingKcal(false);
  }

  async function handleGeneratePdf() {
    setPdfError(null);
    setGeneratingPdf(true);
    const result = await generateMealPlanPdfAction({
      mealPlanId: planId,
      patientId,
    });
    setGeneratingPdf(false);
    if (result.ok && result.documentId) {
      setPdfDocId(result.documentId);
    } else {
      setPdfError(result.message ?? "Erro ao gerar PDF");
    }
  }

  return (
    <div>
      <p className="text-tiny font-semibold uppercase tracking-wider text-text-muted">
        Plano alimentar
      </p>

      {/* Plan name */}
      <div className="group/planname mt-0.5 flex items-center gap-1">
        {editingName ? (
          <input
            ref={nameInputRef}
            type="text"
            maxLength={120}
            value={nameValue}
            onChange={(e) => setNameValue(e.target.value)}
            onBlur={commitNameEdit}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                commitNameEdit();
              }
              if (e.key === "Escape") {
                e.preventDefault();
                cancelNameEdit();
              }
            }}
            className="rounded border border-brand-primary bg-bg-surface px-2 py-0.5 text-h1 font-semibold tracking-tight text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
            aria-label="Nome do plano"
          />
        ) : (
          <button
            type="button"
            onClick={startNameEdit}
            title="Clique para renomear o plano"
            className="flex items-center gap-1.5 rounded px-0.5 text-h1 font-semibold tracking-tight text-text-primary transition-colors hover:bg-bg-subtle"
          >
            {localName}
            <Pencil
              className="h-4 w-4 text-text-muted opacity-0 transition-opacity group-hover/planname:opacity-100"
              strokeWidth={1.75}
            />
          </button>
        )}
      </div>

      {/* Status + target kcal */}
      <div className="mt-1.5 flex flex-wrap items-center gap-2">
        <span
          className={
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-tiny font-medium ring-1 ring-inset " +
            (status === "ACTIVE"
              ? "bg-success-bg text-success ring-success-border"
              : status === "DRAFT"
                ? "bg-warning-bg text-warning ring-warning-border"
                : "bg-bg-subtle text-text-secondary ring-border-subtle")
          }
        >
          {STATUS_LABEL[status] ?? status}
        </span>

        {/* Target kcal inline editor */}
        <div className="group/targetkcal flex items-center gap-1">
          {editingKcal ? (
            <span className="inline-flex items-center gap-1">
              <Target className="h-3 w-3 text-text-muted" strokeWidth={1.75} />
              <input
                ref={kcalInputRef}
                type="number"
                min={600}
                max={6000}
                step={50}
                value={kcalValue}
                onChange={(e) => setKcalValue(e.target.value)}
                onBlur={commitKcalEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    commitKcalEdit();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    cancelKcalEdit();
                  }
                }}
                placeholder="meta kcal"
                className="w-20 rounded border border-brand-primary bg-bg-surface px-1.5 py-0.5 text-caption tabular-nums text-text-primary focus:outline-none focus:ring-1 focus:ring-brand-primary"
                aria-label="Meta calórica por dia"
              />
              <span className="text-caption text-text-muted">kcal/dia</span>
            </span>
          ) : localTargetKcal ? (
            <button
              type="button"
              onClick={startKcalEdit}
              title="Clique para editar a meta calórica"
              className="inline-flex items-center gap-1 rounded px-0.5 text-caption text-text-muted tabular-nums transition-colors hover:bg-bg-subtle hover:text-text-secondary"
            >
              <Target className="h-3 w-3" strokeWidth={1.75} />
              {localTargetKcal} kcal/dia
              <Pencil
                className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover/targetkcal:opacity-100"
                strokeWidth={1.75}
              />
            </button>
          ) : (
            <button
              type="button"
              onClick={startKcalEdit}
              title="Definir meta calórica"
              className="inline-flex items-center gap-1 rounded px-0.5 text-caption text-text-muted transition-colors hover:bg-bg-subtle hover:text-text-secondary"
            >
              <Target className="h-3 w-3" strokeWidth={1.75} />
              Definir meta kcal
              <Pencil
                className="h-2.5 w-2.5 opacity-0 transition-opacity group-hover/targetkcal:opacity-100"
                strokeWidth={1.75}
              />
            </button>
          )}
        </div>

        {/* PDF generation */}
        {hasItems && (
          <div className="mt-2 flex items-center gap-2">
            {pdfDocId ? (
              <a
                href={`/app/patients/${patientId}/documents/${pdfDocId}`}
                className="inline-flex items-center gap-1.5 rounded-md border border-success-border bg-success-bg px-3 py-1 text-tiny font-medium text-success transition-colors hover:opacity-80"
              >
                <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                Ver documento PDF
              </a>
            ) : (
              <button
                type="button"
                onClick={handleGeneratePdf}
                disabled={generatingPdf}
                className="inline-flex items-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-3 py-1 text-tiny font-medium text-text-secondary transition-all hover:border-brand-primary hover:bg-brand-primary-bg hover:text-brand-primary disabled:opacity-50"
              >
                {generatingPdf ? (
                  <>
                    <Loader2
                      className="h-3.5 w-3.5 animate-spin"
                      strokeWidth={2}
                    />
                    Gerando PDF…
                  </>
                ) : (
                  <>
                    <FileText className="h-3.5 w-3.5" strokeWidth={1.75} />
                    Gerar PDF
                  </>
                )}
              </button>
            )}
            {pdfError && <p className="text-tiny text-danger">{pdfError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
