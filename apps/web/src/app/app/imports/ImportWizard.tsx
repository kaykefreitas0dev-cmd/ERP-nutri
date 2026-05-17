"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { uploadImportFileAction, confirmImportAction } from "./actions";

type Step = "upload" | "mapping" | "processing" | "done";

const TARGET_FIELDS = [
  { value: "", label: "— Ignorar coluna —" },
  { value: "fullName", label: "Nome completo *" },
  { value: "email", label: "Email" },
  { value: "phone", label: "Telefone / WhatsApp" },
  { value: "cpf", label: "CPF" },
  { value: "birthDate", label: "Data nascimento (DD/MM/YYYY ou ISO)" },
  { value: "biologicalSex", label: "Sexo biológico (M/F)" },
  { value: "city", label: "Cidade" },
  { value: "state", label: "UF (2 letras)" },
  { value: "occupation", label: "Profissão" },
];

export function ImportWizard() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [step, setStep] = useState<Step>("upload");
  const [error, setError] = useState<string | null>(null);
  const [source, setSource] = useState<string>("dietbox");

  // upload result
  const [importId, setImportId] = useState<string>("");
  const [csvContent, setCsvContent] = useState<string>("");
  const [headers, setHeaders] = useState<string[]>([]);
  const [preview, setPreview] = useState<Record<string, string>[]>([]);
  const [totalRows, setTotalRows] = useState(0);
  const [templates, setTemplates] = useState<
    Array<{ id: string; name: string; columnMapping: Record<string, string> }>
  >([]);

  // mapping
  const [mapping, setMapping] = useState<Record<string, string>>({});

  // result
  const [processed, setProcessed] = useState(0);
  const [errorCount, setErrorCount] = useState(0);

  async function handleUpload(formData: FormData) {
    setError(null);
    const file = formData.get("file") as File | null;
    if (!file) {
      setError("Selecione um arquivo");
      return;
    }
    // Pega conteúdo antes (vamos re-enviar no confirm — MVP sem persist em storage)
    const text = await file.text();
    setCsvContent(text);

    formData.set("source", source);

    startTransition(async () => {
      const result = await uploadImportFileAction(formData);
      if (!result.ok) {
        setError(result.message ?? "Erro");
        return;
      }
      setImportId(result.importId ?? "");
      setHeaders(result.headers ?? []);
      setPreview(result.preview ?? []);
      setTotalRows(result.rows ?? 0);
      setTemplates(result.templates ?? []);

      // Pre-popular mapping com template default
      const matching = result.templates?.find((t) => t.columnMapping && Object.keys(t.columnMapping).length > 0);
      if (matching) {
        setMapping(matching.columnMapping);
      }

      setStep("mapping");
    });
  }

  function applyTemplate(templateId: string) {
    const t = templates.find((x) => x.id === templateId);
    if (t) setMapping(t.columnMapping);
  }

  function updateMapping(csvCol: string, targetField: string) {
    setMapping((prev) => {
      const next = { ...prev };
      if (targetField === "") {
        delete next[csvCol];
      } else {
        next[csvCol] = targetField;
      }
      return next;
    });
  }

  async function handleConfirm() {
    setError(null);
    setStep("processing");
    startTransition(async () => {
      const result = await confirmImportAction({
        importId,
        columnMapping: mapping,
        csvContent,
      });
      if (!result.ok) {
        setError(result.message ?? "Erro");
        setStep("mapping");
        return;
      }
      setProcessed(result.processed ?? 0);
      setErrorCount(result.errors ?? 0);
      setStep("done");
    });
  }

  function reset() {
    setStep("upload");
    setImportId("");
    setCsvContent("");
    setHeaders([]);
    setPreview([]);
    setMapping({});
    setError(null);
    router.refresh();
  }

  // ============================================================
  // RENDER STEPS
  // ============================================================

  if (step === "upload") {
    return (
      <form action={handleUpload} className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">1. Selecione o arquivo</h2>

        {error && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        <div>
          <label htmlFor="source" className="block text-sm font-medium">
            Origem do arquivo *
          </label>
          <select
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
          >
            <option value="dietbox">Dietbox (export padrão)</option>
            <option value="webdiet">Webdiet (export padrão)</option>
            <option value="custom_csv">CSV genérico</option>
          </select>
        </div>

        <div>
          <label htmlFor="file" className="block text-sm font-medium">
            Arquivo CSV *
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm file:mr-3 file:rounded-md file:border-0 file:bg-teal-700 file:px-3 file:py-1 file:text-xs file:text-white"
          />
          <p className="mt-1 text-xs text-slate-500">Até 10MB. UTF-8 ou Latin-1.</p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-md bg-teal-700 px-6 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
        >
          {pending ? "Analisando…" : "Próximo →"}
        </button>
      </form>
    );
  }

  if (step === "mapping") {
    return (
      <div className="space-y-4">
        <h2 className="text-lg font-semibold text-slate-900">
          2. Mapear colunas ({totalRows} linhas detectadas)
        </h2>

        {error && (
          <div role="alert" className="rounded-md bg-red-50 p-3 text-sm text-red-800">
            {error}
          </div>
        )}

        {templates.length > 0 && (
          <div className="rounded-md bg-teal-50 p-3 text-sm">
            <p className="font-medium text-teal-900">Templates disponíveis:</p>
            <div className="mt-1 flex flex-wrap gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  className="rounded-full bg-white px-3 py-1 text-xs font-medium text-teal-700 ring-1 ring-teal-300 hover:bg-teal-100"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-md border border-slate-200">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Coluna CSV
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Mapear para
                </th>
                <th className="px-3 py-2 text-left text-xs font-medium uppercase text-slate-500">
                  Preview (linha 1)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {headers.map((h) => (
                <tr key={h}>
                  <td className="px-3 py-2 font-mono text-xs">{h}</td>
                  <td className="px-3 py-2">
                    <select
                      value={mapping[h] ?? ""}
                      onChange={(e) => updateMapping(h, e.target.value)}
                      className="rounded-md border border-slate-300 px-2 py-1 text-xs"
                    >
                      {TARGET_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 font-mono text-xs text-slate-500">
                    {preview[0]?.[h]?.slice(0, 40) ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="flex justify-between">
          <button
            type="button"
            onClick={() => setStep("upload")}
            className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50"
          >
            ← Voltar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleConfirm}
            className="inline-flex h-9 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 disabled:opacity-50"
          >
            Importar {totalRows} pacientes
          </button>
        </div>
      </div>
    );
  }

  if (step === "processing") {
    return (
      <div className="py-12 text-center">
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-teal-300 border-t-teal-700" />
        <p className="mt-4 text-sm text-slate-600">Importando {totalRows} pacientes…</p>
        <p className="mt-1 text-xs text-slate-500">
          Aguarde — pode demorar alguns segundos para listas grandes.
        </p>
      </div>
    );
  }

  // step === "done"
  return (
    <div className="space-y-4 text-center">
      <div className="text-5xl">✅</div>
      <h2 className="text-xl font-semibold text-slate-900">Importação concluída!</h2>
      <p className="text-slate-600">
        <strong>{processed}</strong> pacientes importados com sucesso
        {errorCount > 0 && (
          <span>
            {" "}
            • <strong>{errorCount}</strong> com erros (revisar log da importação)
          </span>
        )}
      </p>

      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/app/patients")}
          className="inline-flex h-9 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800"
        >
          Ver pacientes →
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-9 items-center justify-center rounded-md border border-slate-300 bg-white px-4 text-sm font-medium hover:bg-slate-50"
        >
          Nova importação
        </button>
      </div>
    </div>
  );
}
