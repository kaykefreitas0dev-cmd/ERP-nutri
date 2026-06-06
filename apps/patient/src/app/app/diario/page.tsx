import Link from "next/link";
import { ChevronLeft, NotebookPen } from "lucide-react";
import { DiaryClient } from "./DiaryClient";

export const dynamic = "force-dynamic";
export const metadata = { title: "Diário alimentar" };

export default function DiaryPage() {
  return (
    <main className="mx-auto max-w-3xl p-4 md:p-6">
      <Link
        href="/app"
        className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
      >
        <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
        Início
      </Link>
      <header className="mt-3 mb-5">
        <h1 className="flex items-center gap-2 text-h1 font-semibold tracking-tight text-text-primary">
          <NotebookPen
            className="h-6 w-6 text-text-secondary"
            strokeWidth={1.75}
          />
          Diário alimentar
        </h1>
        <p className="mt-1 text-caption text-text-secondary">
          Registre o que você comeu. Seu nutricionista acompanha para ajustar
          seu plano.
        </p>
      </header>

      <DiaryClient />
    </main>
  );
}
