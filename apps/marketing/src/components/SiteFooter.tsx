import Link from "next/link";
import { Container } from "@repo/ui/container";

export function SiteFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-12">
      <Container>
        <div className="grid grid-cols-2 gap-8 md:grid-cols-4">
          <div className="col-span-2 md:col-span-1">
            <div className="flex items-center gap-2 text-xl font-bold text-teal-700">
              NutriCore
            </div>
            <p className="mt-2 text-sm text-slate-600">
              Plataforma de gestão para nutricionistas brasileiros.
            </p>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Produto</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/#funcionalidades" className="hover:text-teal-700">
                  Funcionalidades
                </Link>
              </li>
              <li>
                <Link href="/#precos" className="hover:text-teal-700">
                  Preços
                </Link>
              </li>
              <li>
                <Link href="/status" className="hover:text-teal-700">
                  Status
                </Link>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Suporte</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/contato" className="hover:text-teal-700">
                  Contato
                </Link>
              </li>
              <li>
                <a
                  href="mailto:suporte@nutricore.app"
                  className="hover:text-teal-700"
                >
                  suporte@nutricore.app
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-sm font-semibold text-slate-900">Legal</h3>
            <ul className="mt-3 space-y-2 text-sm text-slate-600">
              <li>
                <Link href="/privacidade" className="hover:text-teal-700">
                  Privacidade (LGPD)
                </Link>
              </li>
              <li>
                <Link href="/termos" className="hover:text-teal-700">
                  Termos de uso
                </Link>
              </li>
            </ul>
          </div>
        </div>

        <div className="mt-10 border-t border-slate-200 pt-6 text-center text-xs text-slate-500">
          © {new Date().getFullYear()} NutriCore. Plataforma brasileira.
          <br className="sm:hidden" />
          <span className="ml-2">CFN 599/2018 • Lei 13.787/2018 • LGPD</span>
        </div>
      </Container>
    </footer>
  );
}
