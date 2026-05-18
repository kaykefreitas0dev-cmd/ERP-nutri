import Link from "next/link";
import { ChevronLeft, UserPlus } from "lucide-react";
import { PatientForm } from "../PatientForm";

export const metadata = { title: "Novo paciente" };

export default function NewPatientPage() {
  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <Link
            href="/app/patients"
            className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
          >
            <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
            Pacientes
          </Link>
          <p className="mt-3 text-tiny font-semibold uppercase tracking-wider text-text-muted">
            Cadastro
          </p>
          <h1 className="mt-0.5 flex items-center gap-2 text-h1 font-semibold tracking-tight text-text-primary">
            <UserPlus
              className="h-6 w-6 text-text-secondary"
              strokeWidth={1.75}
            />
            Novo paciente
          </h1>
          <p className="mt-1 text-caption text-text-secondary">
            Apenas dados básicos. Anamnese completa, antropometria e exames
            podem ser adicionados depois.
          </p>
        </header>

        <div className="rounded-lg border border-border-subtle bg-bg-surface p-6 [box-shadow:var(--shadow-xs)] sm:p-8">
          <PatientForm mode="create" />
        </div>
      </div>
    </main>
  );
}
