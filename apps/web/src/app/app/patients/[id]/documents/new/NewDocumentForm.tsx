"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createDocumentAction, searchCidsAction } from "../actions";

type DocType =
  | "PLANO_ALIMENTAR"
  | "ATESTADO"
  | "RECEITA_SUPLEMENTO"
  | "ENCAMINHAMENTO"
  | "RECIBO";

const TYPE_OPTIONS: Array<{ value: DocType; label: string; help: string }> = [
  {
    value: "ATESTADO",
    label: "Atestado",
    help: "Para empresa, escola, academia.",
  },
  {
    value: "RECEITA_SUPLEMENTO",
    label: "Receita de suplemento",
    help: "Posologia + duração + suplemento.",
  },
  {
    value: "ENCAMINHAMENTO",
    label: "Encaminhamento",
    help: "Referral para outro profissional.",
  },
  {
    value: "PLANO_ALIMENTAR",
    label: "Plano alimentar (PDF)",
    help: "Snapshot do plano em documento assinado.",
  },
];

const TEMPLATES: Record<DocType, string> = {
  ATESTADO: `Atesto que **${"{paciente}"}** esteve em consulta nutricional nesta data, necessitando de afastamento/cuidados conforme avaliação clínica.

Recomendo:
- ${"{recomendação 1}"}
- ${"{recomendação 2}"}

Permanecerei à disposição para esclarecimentos.`,
  RECEITA_SUPLEMENTO: `**Suplemento:** ${"{nome do suplemento}"}
**Posologia:** ${"{dose}"} ao dia
**Duração:** ${"{duração em dias/semanas}"}
**Via de administração:** oral
**Horário:** ${"{antes/depois das refeições}"}

**Indicação clínica:** ${"{motivo da prescrição}"}

**Observações:** suspender uso em caso de efeitos adversos e procurar avaliação.`,
  ENCAMINHAMENTO: `Encaminho o(a) paciente **${"{paciente}"}** para avaliação com o(a) profissional:

**Especialidade:** ${"{ex: Endocrinologista}"}
**Motivo:** ${"{descreva o motivo do encaminhamento}"}

**Histórico relevante:** ${"{breve histórico clínico)"}

Agradeço o acompanhamento conjunto.`,
  PLANO_ALIMENTAR: `Plano alimentar prescrito para **${"{paciente}"}**.

Veja anexo o detalhamento das refeições, quantidades e horários sugeridos.

**Observações gerais:**
- Hidratação: 35ml/kg de peso/dia
- Mastigar bem os alimentos
- Evitar refeições próximas ao horário de dormir`,
  RECIBO: `Recibo referente a:

**Serviço:** consulta nutricional
**Valor:** R$ ${"{valor}"}
**Data:** ${"{data}"}
**Forma de pagamento:** ${"{PIX/cartão/dinheiro}"}`,
};

interface MealPlan {
  id: string;
  name: string;
  status: string;
}

interface Props {
  patientId: string;
  patientName: string;
  mealPlans: MealPlan[];
}

interface CidSelected {
  id: string;
  code: string;
  description: string;
}

export function NewDocumentForm({ patientId, patientName, mealPlans }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [docType, setDocType] = useState<DocType>("ATESTADO");
  const [title, setTitle] = useState("");
  const [body, setBody] = useState(
    TEMPLATES.ATESTADO.replace("{paciente}", patientName),
  );
  const [validUntil, setValidUntil] = useState("");
  const [mealPlanId, setMealPlanId] = useState("");

  // CIDs picker
  const [cidQuery, setCidQuery] = useState("");
  const [cidResults, setCidResults] = useState<CidSelected[]>([]);
  const [cidsSelected, setCidsSelected] = useState<CidSelected[]>([]);
  const [searchingCids, setSearchingCids] = useState(false);

  function handleTypeChange(t: DocType) {
    setDocType(t);
    setBody(TEMPLATES[t].replace(/\{paciente\}/g, patientName));
    if (!title) {
      const todayBr = new Date().toLocaleDateString("pt-BR");
      const label = TYPE_OPTIONS.find((o) => o.value === t)?.label ?? t;
      setTitle(`${label} — ${todayBr}`);
    }
  }

  async function handleCidSearch(q: string) {
    setCidQuery(q);
    if (q.length < 1) {
      setCidResults([]);
      return;
    }
    setSearchingCids(true);
    const r = await searchCidsAction({ query: q, limit: 12 });
    if (r.ok && r.cids) {
      setCidResults(
        r.cids.filter((c) => !cidsSelected.find((s) => s.id === c.id)),
      );
    }
    setSearchingCids(false);
  }

  function addCid(c: CidSelected) {
    setCidsSelected([...cidsSelected, c]);
    setCidResults(cidResults.filter((r) => r.id !== c.id));
    setCidQuery("");
  }

  function removeCid(id: string) {
    setCidsSelected(cidsSelected.filter((c) => c.id !== id));
  }

  async function handleSubmit(formData: FormData) {
    setError(null);
    formData.set("patientId", patientId);
    formData.set("documentType", docType);
    formData.set("bodyMarkdown", body);
    formData.set("cidIds", cidsSelected.map((c) => c.id).join(","));
    if (mealPlanId) formData.set("mealPlanId", mealPlanId);

    startTransition(async () => {
      const result = await createDocumentAction(formData);
      if (!result.ok) {
        setError(result.message ?? "Erro");
        return;
      }
      router.push(`/app/patients/${patientId}/documents/${result.documentId}`);
    });
  }

  return (
    <form
      action={handleSubmit}
      className="space-y-5 rounded-lg border border-slate-200 bg-white p-6 shadow-sm"
    >
      {error && (
        <div
          role="alert"
          className="rounded-md bg-red-50 p-3 text-sm text-red-800"
        >
          {error}
        </div>
      )}

      {/* Tipo */}
      <div>
        <label className="block text-xs font-medium text-slate-700">
          Tipo de documento *
        </label>
        <div className="mt-2 grid grid-cols-2 gap-2">
          {TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              onClick={() => handleTypeChange(opt.value)}
              className={`rounded-md border p-3 text-left text-sm transition ${
                docType === opt.value
                  ? "border-teal-500 bg-teal-50 ring-1 ring-teal-500"
                  : "border-slate-300 bg-white hover:border-slate-400"
              }`}
            >
              <div className="font-medium">{opt.label}</div>
              <div className="mt-0.5 text-xs text-slate-500">{opt.help}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Título */}
      <div>
        <label
          htmlFor="title"
          className="block text-xs font-medium text-slate-700"
        >
          Título *
        </label>
        <input
          id="title"
          name="title"
          type="text"
          required
          maxLength={160}
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Ex: Atestado — 15/03/2026"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {/* Plano alimentar relacionado (apenas para PLANO_ALIMENTAR) */}
      {docType === "PLANO_ALIMENTAR" && mealPlans.length > 0 && (
        <div>
          <label
            htmlFor="mealPlanId"
            className="block text-xs font-medium text-slate-700"
          >
            Plano alimentar relacionado
          </label>
          <select
            id="mealPlanId"
            value={mealPlanId}
            onChange={(e) => setMealPlanId(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="">— sem vínculo —</option>
            {mealPlans.map((mp) => (
              <option key={mp.id} value={mp.id}>
                {mp.name} ({mp.status})
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Validade */}
      <div>
        <label
          htmlFor="validUntil"
          className="block text-xs font-medium text-slate-700"
        >
          Válido até (opcional)
        </label>
        <input
          id="validUntil"
          name="validUntil"
          type="date"
          value={validUntil}
          onChange={(e) => setValidUntil(e.target.value)}
          className="mt-1 block w-44 rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {/* CIDs */}
      <div>
        <label className="block text-xs font-medium text-slate-700">
          CID-10 (opcional)
        </label>

        {cidsSelected.length > 0 && (
          <div className="mt-2 flex flex-wrap gap-1">
            {cidsSelected.map((c) => (
              <span
                key={c.id}
                className="inline-flex items-center gap-1 rounded-full bg-teal-100 px-2.5 py-1 text-xs font-medium text-teal-800"
              >
                <strong>{c.code}</strong>
                <span className="max-w-[200px] truncate">{c.description}</span>
                <button
                  type="button"
                  onClick={() => removeCid(c.id)}
                  className="ml-1 text-teal-600 hover:text-red-600"
                  aria-label={`Remover CID ${c.code}`}
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        )}

        <input
          type="search"
          value={cidQuery}
          onChange={(e) => handleCidSearch(e.target.value)}
          placeholder='Buscar CID (ex: "E66" ou "diabetes")'
          className="mt-2 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
        {searchingCids && (
          <p className="mt-1 text-xs text-slate-500">Buscando...</p>
        )}
        {cidResults.length > 0 && (
          <ul className="mt-1 max-h-48 space-y-1 overflow-y-auto rounded-md border border-slate-200 bg-white p-1">
            {cidResults.map((c) => (
              <li key={c.id}>
                <button
                  type="button"
                  onClick={() => addCid(c)}
                  className="block w-full rounded px-3 py-1.5 text-left text-xs hover:bg-teal-50"
                >
                  <strong>{c.code}</strong> — {c.description}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Corpo markdown */}
      <div>
        <label
          htmlFor="bodyMarkdown"
          className="block text-xs font-medium text-slate-700"
        >
          Corpo do documento *
        </label>
        <p className="text-xs text-slate-500">
          Use <code className="rounded bg-slate-100 px-1">**negrito**</code>{" "}
          para destacar. Parágrafos separados por linha em branco.
        </p>
        <textarea
          id="bodyMarkdown"
          name="bodyMarkdown"
          rows={14}
          required
          minLength={5}
          maxLength={20000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-xs"
        />
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
        <button
          type="submit"
          disabled={pending || !title.trim() || body.trim().length < 5}
          className="rounded-md bg-teal-700 px-5 py-2 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {pending ? "Salvando..." : "Salvar como rascunho"}
        </button>
      </div>
    </form>
  );
}
