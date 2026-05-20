"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
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
      const matching = result.templates?.find(
        (t) => t.columnMapping && Object.keys(t.columnMapping).length > 0,
      );
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
        <h2 className="text-h3 font-semibold text-text-primary">
          1. Selecione o arquivo
        </h2>

        {error && (
          <div
            role="alert"
            className="rounded-md bg-danger-bg p-3 text-body text-danger"
          >
            {error}
          </div>
        )}

        <div>
          <label htmlFor="source" className="block text-body font-medium">
            Origem do arquivo *
          </label>
          <select
            id="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
          >
            <option value="dietbox">Dietbox (export padrão)</option>
            <option value="webdiet">Webdiet (export padrão)</option>
            <option value="custom_csv">CSV genérico</option>
          </select>
        </div>

        <div>
          <label htmlFor="file" className="block text-body font-medium">
            Arquivo CSV *
          </label>
          <input
            id="file"
            name="file"
            type="file"
            accept=".csv,text/csv"
            required
            className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body file:mr-3 file:rounded-md file:border-0 file:bg-brand-primary file:px-3 file:py-1 file:text-tiny file:text-white"
          />
          <p className="mt-1 text-tiny text-text-muted">
            Até 10MB. UTF-8 ou Latin-1.
          </p>
        </div>

        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-11 items-center justify-center rounded-md bg-brand-primary px-6 text-body font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
        >
          {pending ? "Analisando…" : "Próximo →"}
        </button>
      </form>
    );
  }

  if (step === "mapping") {
    return (
      <div className="space-y-4">
        <h2 className="text-h3 font-semibold text-text-primary">
          2. Mapear colunas ({totalRows} linhas detectadas)
        </h2>

        {error && (
          <div
            role="alert"
            className="rounded-md bg-danger-bg p-3 text-body text-danger"
          >
            {error}
          </div>
        )}

        {templates.length > 0 && (
          <div className="rounded-md bg-brand-primary-bg p-3 text-body">
            <p className="font-medium text-brand-primary">
              Templates disponíveis:
            </p>
            <div className="mt-1 flex flex-wrap gap-2">
              {templates.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => applyTemplate(t.id)}
                  className="rounded-full bg-bg-surface px-3 py-1 text-tiny font-medium text-brand-primary ring-1 ring-brand-300 hover:bg-brand-primary-bg"
                >
                  {t.name}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="overflow-hidden rounded-md border border-border-subtle">
          <table className="min-w-full divide-y divide-border-subtle text-body">
            <thead className="bg-bg-subtle">
              <tr>
                <th className="px-3 py-2 text-left text-tiny font-medium uppercase text-text-muted">
                  Coluna CSV
                </th>
                <th className="px-3 py-2 text-left text-tiny font-medium uppercase text-text-muted">
                  Mapear para
                </th>
                <th className="px-3 py-2 text-left text-tiny font-medium uppercase text-text-muted">
                  Preview (linha 1)
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border-subtle">
              {headers.map((h) => (
                <tr key={h}>
                  <td className="px-3 py-2 font-mono text-tiny">{h}</td>
                  <td className="px-3 py-2">
                    <select
                      value={mapping[h] ?? ""}
                      onChange={(e) => updateMapping(h, e.target.value)}
                      className="rounded-md border border-border-default px-2 py-1 text-tiny"
                    >
                      {TARGET_FIELDS.map((f) => (
                        <option key={f.value} value={f.value}>
                          {f.label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="px-3 py-2 font-mono text-tiny text-text-muted">
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
            className="inline-flex h-9 items-center justify-center rounded-md border border-border-default bg-bg-surface px-4 text-body font-medium hover:bg-bg-subtle"
          >
            ← Voltar
          </button>
          <button
            type="button"
            disabled={pending}
            onClick={handleConfirm}
            className="inline-flex h-9 items-center justify-center rounded-md bg-brand-primary px-4 text-body font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
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
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-brand-300 border-t-brand-primary" />
        <p className="mt-4 text-body text-text-secondary">
          Importando {totalRows} pacientes…
        </p>
        <p className="mt-1 text-tiny text-text-muted">
          Aguarde — pode demorar alguns segundos para listas grandes.
        </p>
      </div>
    );
  }

  // step === "done"
  return (
    <div className="space-y-4 text-center">
      <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-success-bg text-success">
        <CircleCheck className="h-10 w-10" strokeWidth={1.75} />
      </div>
      <h2 className="text-xl font-semibold text-text-primary">
        Importação concluída!
      </h2>
      <p className="text-text-secondary">
        <strong>{processed}</strong> pacientes importados com sucesso
        {errorCount > 0 && (
          <span>
            {" "}
            • <strong>{errorCount}</strong> com erros (revisar log da
            importação)
          </span>
        )}
      </p>

      <div className="flex justify-center gap-3">
        <button
          type="button"
          onClick={() => router.push("/app/patients")}
          className="inline-flex h-9 items-center justify-center rounded-md bg-brand-primary px-4 text-body font-medium text-white hover:bg-brand-primary-hover"
        >
          Ver pacientes →
        </button>
        <button
          type="button"
          onClick={reset}
          className="inline-flex h-9 items-center justify-center rounded-md border border-border-default bg-bg-surface px-4 text-body font-medium hover:bg-bg-subtle"
        >
          Nova importação
        </button>
      </div>
    </div>
  );
}
