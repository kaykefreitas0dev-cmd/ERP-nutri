import Link from "next/link";
import { ChevronLeft, UserPlus } from "lucide-react";
import { SectionHeader } from "@repo/ui/section-header";
import { PatientForm } from "../PatientForm";

export const metadata = { title: "Novo paciente" };

export default function NewPatientPage() {
  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/app/patients"
          className="mb-3 inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Pacientes
        </Link>
        <SectionHeader
          as="h1"
          className="mb-6"
          label="Pacientes"
          title={
            <span className="inline-flex items-center gap-2">
              <UserPlus
                className="h-6 w-6 text-text-secondary"
                strokeWidth={1.75}
              />
              Novo paciente
            </span>
          }
          description="Apenas dados básicos. Anamnese completa, antropometria e exames podem ser adicionados depois."
        />

        <div className="rounded-lg border border-border-subtle bg-bg-surface p-6 [box-shadow:var(--shadow-xs)] sm:p-8">
          <PatientForm mode="create" />
        </div>
      </div>
    </main>
  );
}
