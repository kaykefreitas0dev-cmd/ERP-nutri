import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (user) {
    redirect("/app");
  }

  return (
    <main className="flex min-h-screen flex-col">
      <header className="bg-brand-primary px-5 py-4 text-white shadow-sm">
        <div className="mx-auto max-w-3xl">
          <h1 className="text-xl font-bold">NutriCore</h1>
          <p className="text-xs opacity-90">Seu acompanhamento nutricional</p>
        </div>
      </header>

      <section className="flex-1 px-5 py-12">
        <div className="mx-auto max-w-md text-center">
          <h2 className="text-3xl font-bold text-slate-900">Bem-vindo(a)</h2>
          <p className="mt-3 text-base text-slate-600">
            Esta área é exclusiva para pacientes. Acesse com o link que sua(seu)
            nutricionista enviou ou faça login com seu email cadastrado.
          </p>

          <div className="mt-8 space-y-3">
            <Link
              href="/login"
              className="inline-flex h-12 w-full items-center justify-center rounded-md bg-brand-primary px-6 text-base font-semibold text-white hover:bg-brand-primary-hover"
            >
              📧 Entrar com email
            </Link>
            <p className="text-xs text-slate-500">
              Sem cadastro? Peça à sua(seu) nutricionista para enviar o convite.
            </p>
          </div>
        </div>
      </section>

      <footer className="border-t border-slate-200 bg-white px-5 py-3 text-center text-xs text-slate-500">
        NutriCore · seu nutricionista define seu plano, você acompanha aqui.
      </footer>
    </main>
  );
}
