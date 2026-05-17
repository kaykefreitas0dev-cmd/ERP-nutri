"use client";

import { useState, useTransition } from "react";
import { Download, Package, CircleCheck } from "lucide-react";
import { exportPatientDataAction } from "./actions";

interface Props {
  patientId: string;
}

export function ExportDataButton({ patientId }: Props) {
  const [pending, startTransition] = useTransition();
  const [result, setResult] = useState<{
    url: string;
    expiresAt: string;
    counts: Record<string, number>;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);

  function handleExport() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const r = await exportPatientDataAction({ patientId });
      if (!r.ok || !r.signedUrl || !r.manifest || !r.expiresAt) {
        setError(r.message ?? "Erro ao gerar export");
        return;
      }
      setResult({
        url: r.signedUrl,
        expiresAt: r.expiresAt,
        counts: r.manifest.counts,
      });
    });
  }

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={handleExport}
        disabled={pending}
        className="inline-flex w-full items-center justify-center gap-1.5 rounded-md border border-border-default bg-white px-3 py-1.5 text-xs hover:bg-bg-subtle disabled:opacity-50"
      >
        {pending ? (
          <>
            <Package className="h-3.5 w-3.5 animate-pulse" strokeWidth={1.75} />
            Gerando ZIP...
          </>
        ) : (
          <>
            <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
            Exportar dados (LGPD)
          </>
        )}
      </button>

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}

      {result && (
        <div className="rounded-md border border-green-300 bg-green-50 p-3">
          <p className="flex items-center gap-1.5 text-xs font-semibold text-green-900">
            <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
            ZIP gerado!
          </p>
          <a
            href={result.url}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-1 inline-block text-xs font-medium text-green-700 underline"
          >
            <Download className="inline h-3 w-3" strokeWidth={1.75} /> Baixar
            ZIP
          </a>
          <p className="mt-1 text-[10px] text-green-700">
            Link válido até {new Date(result.expiresAt).toLocaleString("pt-BR")}
          </p>
          <details className="mt-2">
            <summary className="cursor-pointer text-[10px] text-green-800">
              Conteúdo (
              {Object.values(result.counts).reduce((a, b) => a + b, 0)}{" "}
              registros)
            </summary>
            <ul className="mt-1 space-y-0.5 text-[10px] text-green-800">
              {Object.entries(result.counts)
                .filter(([, n]) => n > 0)
                .map(([k, n]) => (
                  <li key={k}>
                    {k}: <strong>{n}</strong>
                  </li>
                ))}
            </ul>
          </details>
        </div>
      )}
    </div>
  );
}
