import Link from "next/link";
import { PatientForm } from "../PatientForm";

export const metadata = { title: "Novo paciente" };

export default function NewPatientPage() {
  return (
    <main className="bg-transparent p-6">
      <div className="mx-auto max-w-3xl">
        <header className="mb-6">
          <Link
            href="/app/patients"
            className="text-sm text-brand-primary hover:underline"
          >
            ← Voltar para Pacientes
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900">
            Novo paciente
          </h1>
          <p className="mt-1 text-sm text-slate-600">
            Apenas dados básicos. Anamnese completa, antropometria e exames
            podem ser adicionados depois.
          </p>
        </header>

        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
          <PatientForm mode="create" />
        </div>
      </div>
    </main>
  );
}
