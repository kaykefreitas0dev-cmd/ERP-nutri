"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Ban, CircleCheck, AlertTriangle } from "lucide-react";
import { suspendOrgAction, reactivateOrgAction } from "./actions";

interface Props {
  orgId: string;
  currentStatus: string;
}

export function SuspendOrgButton({ orgId, currentStatus }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [showSuspend, setShowSuspend] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const isSuspended = currentStatus === "SUSPENDED";

  function handleSuspend() {
    setError(null);
    if (reason.trim().length < 5) {
      setError("Motivo precisa ter ao menos 5 caracteres");
      return;
    }
    startTransition(async () => {
      const r = await suspendOrgAction(orgId, reason.trim());
      if (!r.ok) {
        setError(r.message ?? "Erro");
        return;
      }
      setShowSuspend(false);
      setReason("");
      router.refresh();
    });
  }

  function handleReactivate() {
    if (!confirm("Reativar esta organização?")) return;
    startTransition(async () => {
      const r = await reactivateOrgAction(orgId);
      if (!r.ok) alert(r.message ?? "Erro");
      else router.refresh();
    });
  }

  if (isSuspended) {
    return (
      <button
        type="button"
        onClick={handleReactivate}
        disabled={pending}
        className="inline-flex items-center gap-1.5 rounded-md border border-green-300 bg-white px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 disabled:opacity-50"
      >
        <CircleCheck className="h-3.5 w-3.5" strokeWidth={1.75} />
        {pending ? "Reativando..." : "Reativar organização"}
      </button>
    );
  }

  if (!showSuspend) {
    return (
      <button
        type="button"
        onClick={() => setShowSuspend(true)}
        className="inline-flex items-center gap-1.5 rounded-md border border-red-300 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-50"
      >
        <Ban className="h-3.5 w-3.5" strokeWidth={1.75} />
        Suspender
      </button>
    );
  }

  return (
    <div className="rounded-md border border-red-300 bg-red-50 p-3 shadow-sm">
      <p className="flex items-center gap-1.5 text-xs font-semibold text-red-900">
        <AlertTriangle className="h-3.5 w-3.5" strokeWidth={2} />
        Suspender organização
      </p>
      <p className="mt-1 text-[10px] text-red-800">
        Logado em audit. Nutris da org não poderão mais acessar o app até
        reativar.
      </p>
      <input
        type="text"
        value={reason}
        onChange={(e) => setReason(e.target.value)}
        placeholder="Motivo (ex: fraude, chargeback alto)"
        className="mt-2 block w-full rounded border border-red-300 px-2 py-1 text-xs"
      />
      {error && <p className="mt-1 text-[10px] text-red-700">{error}</p>}
      <div className="mt-2 flex gap-1">
        <button
          type="button"
          onClick={handleSuspend}
          disabled={pending}
          className="rounded bg-red-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-red-700 disabled:opacity-50"
        >
          {pending ? "Suspendendo..." : "Confirmar suspensão"}
        </button>
        <button
          type="button"
          onClick={() => {
            setShowSuspend(false);
            setReason("");
            setError(null);
          }}
          className="rounded border border-slate-300 bg-white px-2 py-1 text-[10px]"
        >
          Cancelar
        </button>
      </div>
    </div>
  );
}
