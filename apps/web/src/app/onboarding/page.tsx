import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@nutricore/db";
import { OnboardingWizard } from "./OnboardingWizard";

export const dynamic = "force-dynamic";
export const metadata = {
  title: "Bem-vindo - NutriCore",
};

const TOTAL_STEPS = 5;

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?redirectTo=/onboarding");
  }

  // Se já tem org com membership ativa, vai direto para /app
  const existingMembership = await prisma.membership.findFirst({
    where: { userId: user.id, status: "ACTIVE" },
  });
  if (existingMembership) {
    redirect("/app");
  }

  // Buscar/criar progresso
  const progress = await prisma.onboardingProgress.upsert({
    where: { userId: user.id },
    create: { userId: user.id, currentStep: 1, totalSteps: TOTAL_STEPS },
    update: {},
  });

  return (
    <main className="min-h-screen bg-bg-subtle py-8">
      <OnboardingWizard
        userId={user.id}
        userEmail={user.email ?? ""}
        initialStep={progress.currentStep}
        totalSteps={progress.totalSteps}
        initialData={(progress.data as Record<string, unknown>) ?? {}}
      />
    </main>
  );
}
