import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { PatientForm } from "../../PatientForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Editar paciente" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditPatientPage({ params }: Props) {
  const { id } = await params;

  let patient: Awaited<ReturnType<typeof loadPatient>> | null = null;
  try {
    patient = await loadPatient(id);
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG") {
      redirect("/onboarding");
    }
    throw err;
  }

  if (!patient) notFound();

  return (
    <main className="bg-transparent p-6">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/app/patients/${id}`}
          className="text-sm text-brand-primary hover:underline"
        >
          ← Voltar para {patient.fullName}
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-text-primary">
          Editar paciente
        </h1>

        <div className="mt-6 rounded-lg border border-border-subtle bg-white p-6 shadow-sm sm:p-8">
          <PatientForm mode="edit" patient={patient} />
        </div>
      </div>
    </main>
  );
}

async function loadPatient(id: string) {
  return withTenantAction(async ({ tx }) => {
    return tx.patient.findFirst({
      where: { id },
      select: {
        id: true,
        fullName: true,
        preferredName: true,
        email: true,
        phone: true,
        cpf: true,
        birthDate: true,
        biologicalSex: true,
        city: true,
        state: true,
        occupation: true,
        notes: true,
      },
    });
  });
}
