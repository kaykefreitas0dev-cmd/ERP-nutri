"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { RegisterPaymentModal } from "./RegisterPaymentModal";

export function RegisterPaymentButton() {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-brand-primary px-4 text-body font-medium text-white transition-opacity hover:opacity-90"
      >
        <Plus className="h-4 w-4" strokeWidth={2} />
        Registrar pagamento
      </button>

      {open && <RegisterPaymentModal onClose={() => setOpen(false)} />}
    </>
  );
}
