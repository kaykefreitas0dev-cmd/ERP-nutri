import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar — NutriCore" };

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  return (
    <main className="flex min-h-screen flex-col">
      <header className="bg-brand-primary px-5 py-4 text-white shadow-sm">
        <div className="mx-auto max-w-md">
          <Link href="/" className="text-xl font-bold">
            NutriCore
          </Link>
        </div>
      </header>

      <section className="flex-1 px-5 py-10">
        <div className="mx-auto max-w-md">
          <h2 className="text-2xl font-bold text-text-primary">Entrar</h2>
          <p className="mt-2 text-sm text-text-secondary">
            Digite o email cadastrado pela(o) sua(eu) nutricionista. Enviaremos
            um link mágico para entrar — sem senha.
          </p>

          <div className="mt-6 rounded-lg border border-border-subtle bg-white p-5 shadow-sm">
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-xs text-text-muted">
            Recebeu um link de convite? Cole no navegador para criar seu acesso.
          </p>
        </div>
      </section>
    </main>
  );
}
