"use client";

import { useState, useTransition } from "react";
import { Download, Loader2, CircleCheck, TriangleAlert } from "lucide-react";
import { exportOrganizationDataAction } from "./actions";

export function ExportOrgButton() {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{
    signedUrl: string;
    expiresAt: string;
    counts: Record<string, number>;
  } | null>(null);

  function handleExport() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const r = await exportOrganizationDataAction();
      if (!r.ok || !r.signedUrl) {
        setError(r.message ?? "Erro ao exportar");
        return;
      }
      setResult({
        signedUrl: r.signedUrl,
        expiresAt: r.expiresAt ?? "",
        counts: r.counts ?? {},
      });
    });
  }

  return (
    <div className="mt-4">
      <button
        type="button"
        onClick={handleExport}
        disabled={pending}
        className="inline-flex h-10 items-center gap-2 rounded-md bg-brand-primary px-4 text-body font-medium text-white [box-shadow:var(--shadow-sm)] transition-all duration-fast hover:bg-brand-primary-hover disabled:opacity-50 active:scale-[0.98]"
      >
        {pending ? (
          <Loader2 className="h-4 w-4 animate-spin" strokeWidth={2} />
        ) : (
          <Download className="h-4 w-4" strokeWidth={1.75} />
        )}
        {pending ? "Gerando arquivo…" : "Gerar exportação (.zip)"}
      </button>

      {error && (
        <div
          role="alert"
          className="mt-3 flex items-start gap-2 rounded-md border border-danger-border bg-danger-bg p-3 text-caption text-danger"
        >
          <TriangleAlert
            className="mt-0.5 h-4 w-4 shrink-0"
            strokeWidth={1.75}
          />
          <span>{error}</span>
        </div>
      )}

      {result && (
        <div className="mt-3 rounded-md border border-success-border bg-success-bg p-3 text-caption text-success">
          <p className="flex items-center gap-2 font-medium">
            <CircleCheck className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Exportação pronta
          </p>
          <p className="mt-1 text-text-secondary">
            {Object.entries(result.counts)
              .map(([k, v]) => `${v} ${k}`)
              .join(" · ")}
          </p>
          <a
            href={result.signedUrl}
            className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-tiny font-medium text-white hover:bg-brand-primary-hover"
            download
          >
            <Download className="h-3.5 w-3.5" strokeWidth={2} />
            Baixar .zip
          </a>
          <p className="mt-2 text-tiny text-text-muted">
            Link válido por 24 horas. Guarde o arquivo em local seguro — contém
            dados pessoais e clínicos.
          </p>
        </div>
      )}
    </div>
  );
}
