import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { SignOutButton } from "./SignOutButton";
import { NavBar } from "./NavBar";

export const dynamic = "force-dynamic";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  return (
    <div className="flex min-h-screen flex-col bg-bg-page">
      {/* Topbar (sticky, glassmorphism) */}
      <header className="sticky top-0 z-sticky border-b border-border-subtle glass px-5 py-3">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <Link
            href="/app"
            className="flex items-center gap-2 text-h3 font-semibold text-brand-primary"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              width="22"
              height="22"
              fill="none"
              aria-hidden="true"
            >
              <path
                d="M12 2C8 6 5 9 5 13a7 7 0 0 0 14 0c0-4-3-7-7-11z"
                fill="currentColor"
                fillOpacity="0.12"
              />
              <path
                d="M12 2C8 6 5 9 5 13a7 7 0 0 0 14 0c0-4-3-7-7-11z"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinejoin="round"
              />
              <path
                d="M9 16V9.5l6 6V8"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            NutriCore
          </Link>
          <div className="flex items-center gap-3 text-tiny">
            <span className="hidden text-text-muted sm:inline">
              {user.email}
            </span>
            <SignOutButton />
          </div>
        </div>
      </header>

      <main className="flex-1 pb-20">{children}</main>

      <NavBar />
    </div>
  );
}
