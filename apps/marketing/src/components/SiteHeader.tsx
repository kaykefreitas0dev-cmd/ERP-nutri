import Link from "next/link";
import { Container } from "@repo/ui/container";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/80 backdrop-blur">
      <Container className="flex h-16 items-center justify-between">
        <Link
          href="/"
          className="flex items-center gap-2 text-xl font-bold text-teal-700"
          aria-label="NutriCore - página inicial"
        >
          <svg
            aria-hidden
            xmlns="http://www.w3.org/2000/svg"
            width="28"
            height="28"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M12 2C8 6 6 9 6 13a6 6 0 0 0 12 0c0-4-2-7-6-11z" />
            <path d="M12 13v8" />
          </svg>
          NutriCore
        </Link>

        <nav
          aria-label="Navegação principal"
          className="hidden items-center gap-6 text-sm font-medium text-slate-700 md:flex"
        >
          <Link href="/#funcionalidades" className="hover:text-teal-700">
            Funcionalidades
          </Link>
          <Link href="/para/nutri-solo" className="hover:text-teal-700">
            Nutri autônomo
          </Link>
          <Link href="/para/clinica" className="hover:text-teal-700">
            Clínicas
          </Link>
          <Link href="/#precos" className="hover:text-teal-700">
            Preços
          </Link>
          <Link href="/status" className="hover:text-teal-700">
            Status
          </Link>
          <Link href="/contato" className="hover:text-teal-700">
            Contato
          </Link>
        </nav>

        <div className="flex items-center gap-3">
          <Link
            href="https://erp-nutri-web.vercel.app/login"
            className="hidden text-sm font-medium text-slate-700 hover:text-teal-700 sm:inline-block"
          >
            Entrar
          </Link>
          <Link
            href="/#precos"
            className="inline-flex h-9 items-center justify-center rounded-md bg-teal-700 px-4 text-sm font-medium text-white hover:bg-teal-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500 focus-visible:ring-offset-2"
          >
            Começar grátis
          </Link>
        </div>
      </Container>
    </header>
  );
}
