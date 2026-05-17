"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { LogOut } from "lucide-react";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export function SignOutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function handleSignOut() {
    setBusy(true);
    const supabase = createSupabaseBrowserClient();
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={busy}
      className="mt-1 inline-flex items-center gap-1.5 text-xs text-text-subtle hover:text-white disabled:opacity-50"
    >
      <LogOut className="h-3.5 w-3.5" strokeWidth={1.75} />
      {busy ? "Saindo..." : "Sair"}
    </button>
  );
}
