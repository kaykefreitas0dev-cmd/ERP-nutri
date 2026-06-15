import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, Pencil } from "lucide-react";
import { SectionHeader } from "@repo/ui/section-header";
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
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/app/patients/${id}`}
          className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          {patient.fullName}
        </Link>
        <SectionHeader
          as="h1"
          className="mt-3"
          label="Paciente"
          title={
            <span className="inline-flex items-center gap-2">
              <Pencil
                className="h-6 w-6 text-text-secondary"
                strokeWidth={1.75}
              />
              Editar paciente
            </span>
          }
        />

        <div className="mt-6 rounded-lg border border-border-subtle bg-bg-surface p-6 [box-shadow:var(--shadow-xs)] sm:p-8">
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
