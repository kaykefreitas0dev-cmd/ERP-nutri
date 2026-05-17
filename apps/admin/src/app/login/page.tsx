import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { LoginForm } from "./LoginForm";

export const dynamic = "force-dynamic";
export const metadata = { title: "Admin · Entrar" };

export default async function LoginPage() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (user) redirect("/app");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-6">
      <div className="w-full max-w-md">
        <div className="text-center">
          <Link href="/" className="text-2xl font-bold text-text-primary">
            NutriCore · Admin
          </Link>
          <p className="mt-1 text-xs uppercase tracking-wider text-text-muted">
            Acesso restrito
          </p>
        </div>
        <div className="mt-6 rounded-lg border border-border-subtle bg-white p-6 shadow-sm">
          <LoginForm />
        </div>
        <p className="mt-4 text-center text-xs text-text-muted">
          Apenas super-admins. Para promover novos admins, use o SQL Editor
          (raw_app_meta_data.is_super_admin = true).
        </p>
      </div>
    </main>
  );
}
