"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Loader2, X } from "lucide-react";
import { deleteRecipeAction } from "../actions";

export function DeleteRecipeButton({
  recipeId,
  name,
}: {
  recipeId: string;
  name: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleDelete() {
    startTransition(async () => {
      const r = await deleteRecipeAction(recipeId);
      if (r.ok) router.push("/app/recipes");
    });
  }

  if (!confirming) {
    return (
      <button
        type="button"
        onClick={() => setConfirming(true)}
        className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-border-default bg-bg-surface px-3 text-body font-medium text-text-secondary transition-colors hover:border-danger hover:text-danger"
      >
        <Trash2 className="h-4 w-4" strokeWidth={1.75} />
        Excluir
      </button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1.5">
      <span className="text-tiny text-text-secondary">Excluir “{name}”?</span>
      <button
        type="button"
        onClick={handleDelete}
        disabled={pending}
        className="inline-flex items-center gap-1 rounded-md bg-danger px-2.5 py-1.5 text-tiny font-medium text-white hover:opacity-90 disabled:opacity-50"
      >
        {pending ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" strokeWidth={2} />
        ) : (
          <Trash2 className="h-3.5 w-3.5" strokeWidth={2} />
        )}
        Excluir
      </button>
      <button
        type="button"
        onClick={() => setConfirming(false)}
        disabled={pending}
        className="inline-flex items-center rounded-md p-1.5 text-text-muted hover:text-text-primary disabled:opacity-50"
        aria-label="Cancelar"
      >
        <X className="h-3.5 w-3.5" strokeWidth={2} />
      </button>
    </div>
  );
}
