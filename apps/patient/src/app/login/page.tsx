import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar — NutriCore" };

function NutriCoreMark() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      width="32"
      height="32"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M16 3C11 8 7 11.5 7 16.5a9 9 0 0 0 18 0c0-5-4-8.5-9-13.5z"
        fill="currentColor"
        fillOpacity="0.18"
      />
      <path
        d="M16 3C11 8 7 11.5 7 16.5a9 9 0 0 0 18 0c0-5-4-8.5-9-13.5z"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinejoin="round"
      />
      <path
        d="M12 21V11l8 8V8"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  return (
    <main className="relative flex min-h-screen flex-col bg-bg-page">
      {/* Gradient blob bg sutil */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[400px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-160px] h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-brand-primary-bg opacity-70 blur-[80px]" />
      </div>

      <header className="px-5 py-5">
        <div className="mx-auto flex max-w-md items-center justify-between">
          <Link
            href="/"
            className="flex items-center gap-2 text-h3 font-semibold text-brand-primary"
          >
            <NutriCoreMark />
            NutriCore
          </Link>
        </div>
      </header>

      <section className="flex-1 px-5 pb-10">
        <div className="mx-auto max-w-md">
          <div className="mb-6 text-center">
            <h1 className="text-h1 font-semibold tracking-tight text-text-primary">
              Entrar no seu plano
            </h1>
            <p className="mt-2 text-caption text-text-secondary">
              Digite o email cadastrado pela(o) sua(eu) nutricionista.
              Enviaremos um link mágico — sem senha.
            </p>
          </div>

          <div className="rounded-xl border border-border-subtle bg-bg-surface p-5 [box-shadow:var(--shadow-md)]">
            <LoginForm />
          </div>

          <p className="mt-6 text-center text-tiny text-text-muted">
            Recebeu um link de convite? Cole no navegador para criar seu acesso.
          </p>
        </div>
      </section>
    </main>
  );
}
