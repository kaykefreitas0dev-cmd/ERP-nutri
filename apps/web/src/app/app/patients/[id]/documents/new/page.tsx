import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronLeft, FilePlus } from "lucide-react";
import { SectionHeader } from "@repo/ui/section-header";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { NewDocumentForm } from "./NewDocumentForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Novo documento clínico" };

interface Props {
  params: Promise<{ id: string }>;
}

export default async function NewDocumentPage({ params }: Props) {
  const { id } = await params;

  let data: {
    patient: { id: string; fullName: string };
    mealPlans: Array<{ id: string; name: string; status: string }>;
  } | null = null;

  try {
    data = await withTenantAction(async ({ tx }) => {
      const patient = await tx.patient.findFirst({
        where: { id },
        select: { id: true, fullName: true },
      });
      if (!patient) return null;

      const mealPlans = await tx.mealPlan.findMany({
        where: { patientId: id, status: { in: ["DRAFT", "ACTIVE"] } },
        orderBy: { updatedAt: "desc" },
        take: 20,
        select: { id: true, name: true, status: true },
      });

      return { patient, mealPlans };
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG")
      redirect("/onboarding");
    throw err;
  }

  if (!data) notFound();

  return (
    <main className="p-4 md:p-8">
      <div className="mx-auto max-w-3xl">
        <Link
          href={`/app/patients/${id}/documents`}
          className="inline-flex items-center gap-1 text-caption text-text-secondary transition-colors hover:text-text-primary"
        >
          <ChevronLeft className="h-3.5 w-3.5" strokeWidth={2} />
          Documentos de {data.patient.fullName}
        </Link>
        <SectionHeader
          as="h1"
          className="mt-3"
          label="Documentos"
          title={
            <span className="inline-flex items-center gap-2">
              <FilePlus
                className="h-6 w-6 text-text-secondary"
                strokeWidth={1.75}
              />
              Novo documento clínico
            </span>
          }
          description="Selecione o tipo, escreva o corpo, anexe CIDs e salve como rascunho. A assinatura digital é aplicada ao emitir."
        />

        <div className="mt-6">
          <NewDocumentForm
            patientId={id}
            patientName={data.patient.fullName}
            mealPlans={data.mealPlans}
          />
        </div>
      </div>
    </main>
  );
}
