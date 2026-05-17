import Link from "next/link";
import {
  Download,
  Trash2,
  ShieldCheck,
  FileLock,
  Clock,
  KeyRound,
  ArrowRight,
} from "lucide-react";
import { SiteHeader } from "../../components/SiteHeader";
import { SiteFooter } from "../../components/SiteFooter";

export const metadata = {
  title: "Portabilidade & seus dados — NutriCore",
  description:
    "Como exportar, transferir e excluir seus dados no NutriCore. Direitos garantidos pela LGPD (Lei 13.709/2018).",
};

const RIGHTS = [
  {
    Icon: Download,
    title: "Exportar tudo (Art. 18, V)",
    body: "Owner solicita em Configurações → Portabilidade. Em até 6h você recebe ZIP com pacientes, planos, anotações, agenda, pagamentos e audit log.",
  },
  {
    Icon: Trash2,
    title: "Excluir conta (Art. 18, VI)",
    body: "Anonimização determinística: dados pessoais são apagados, histórico estatístico anônimo é mantido conforme exigência CFN (Lei 13.787 / Resolução CFN 599).",
  },
  {
    Icon: KeyRound,
    title: "Acessar e corrigir (Art. 18, II, III)",
    body: "Paciente acessa os próprios dados pelo app PWA. Correções de cadastro disponíveis a qualquer momento.",
  },
  {
    Icon: ShieldCheck,
    title: "Saber com quem compartilhamos (Art. 18, VII)",
    body: "Lista de subprocessadores publicada e mantida no DPIA. Hoje: Supabase (DB+Auth), Resend (email), Vercel (hosting), Cloudflare (DNS).",
  },
];

const EXPORT_CONTENT = [
  "Cadastro de pacientes + anamnese + alergias",
  "Antropometria histórica completa",
  "Planos alimentares (todas as versões) + receitas próprias",
  "Documentos clínicos (atestados, receitas, encaminhamentos) em PDF",
  "Pagamentos registrados + recibos PDF",
  "Agenda completa (passada e futura)",
  "Audit log imutável (hash chain)",
  "Branding (logo, cores, nome de email)",
];

export default function PortabilidadePage() {
  return (
    <>
      <SiteHeader />
      <main className="min-h-screen">
        {/* Hero */}
        <section className="bg-gradient-to-b from-teal-50 to-white px-4 py-16">
          <div className="mx-auto max-w-4xl text-center">
            <p className="mb-3 inline-flex items-center gap-2 rounded-full bg-teal-100 px-3 py-1 text-xs font-medium uppercase tracking-wider text-teal-800">
              <ShieldCheck className="h-3.5 w-3.5" strokeWidth={2} />
              LGPD · CFN · Lei 13.787
            </p>
            <h1 className="text-4xl font-bold text-slate-900 sm:text-5xl">
              Seus dados são <span className="text-teal-700">seus</span>
            </h1>
            <p className="mx-auto mt-6 max-w-2xl text-lg text-slate-600">
              No NutriCore portabilidade não é checkbox de marketing — é função
              do produto. Exportar tudo, migrar para outro sistema ou apagar a
              conta leva minutos, não meses.
            </p>
            <div className="mt-8 flex flex-wrap justify-center gap-3">
              <Link
                href="/contato"
                className="inline-flex items-center gap-2 rounded-md bg-teal-700 px-6 py-3 text-base font-medium text-white transition hover:bg-teal-800"
              >
                Falar com DPO
                <ArrowRight className="h-4 w-4" strokeWidth={2} />
              </Link>
              <Link
                href="/"
                className="rounded-md border border-slate-300 bg-white px-6 py-3 text-base font-medium text-slate-700 transition hover:bg-slate-50"
              >
                Voltar à home
              </Link>
            </div>
          </div>
        </section>

        {/* Direitos LGPD */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-5xl">
            <h2 className="text-center text-2xl font-bold text-slate-900">
              Os 4 direitos que você efetivamente usa
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-center text-sm text-slate-600">
              A LGPD lista 10 direitos do titular (Art. 18). Aqui estão os que
              os nutricionistas mais pedem — e que entregamos via interface, sem
              precisar abrir chamado.
            </p>
            <div className="mt-10 grid grid-cols-1 gap-6 md:grid-cols-2">
              {RIGHTS.map(({ Icon, title, body }) => (
                <div
                  key={title}
                  className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm"
                >
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-teal-50 text-teal-700">
                    <Icon className="h-5 w-5" strokeWidth={1.75} />
                  </div>
                  <h3 className="mt-3 font-semibold text-slate-900">{title}</h3>
                  <p className="mt-2 text-sm text-slate-600">{body}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* O que vai no ZIP */}
        <section className="bg-slate-50 px-4 py-16">
          <div className="mx-auto max-w-4xl">
            <div className="grid gap-8 md:grid-cols-[1fr_1.2fr] md:items-start">
              <div>
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-teal-100 text-teal-700">
                  <FileLock className="h-5 w-5" strokeWidth={1.75} />
                </div>
                <h2 className="mt-3 text-2xl font-bold text-slate-900">
                  O que vai no seu ZIP de portabilidade
                </h2>
                <p className="mt-3 text-sm text-slate-600">
                  Estrutura organizada por domínio, com manifest JSON listando
                  contagens e checksums. ZIP criptografado; senha enviada por
                  SMS (canal separado do link de download).
                </p>
                <p className="mt-3 inline-flex items-center gap-2 text-xs text-slate-500">
                  <Clock className="h-3.5 w-3.5" strokeWidth={2} />
                  Disponibilidade: signed URL válida por 7 dias.
                </p>
              </div>
              <ul className="space-y-2.5 rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
                {EXPORT_CONTENT.map((item) => (
                  <li
                    key={item}
                    className="flex items-start gap-2.5 text-sm text-slate-700"
                  >
                    <span
                      aria-hidden
                      className="mt-1.5 inline-block h-1.5 w-1.5 shrink-0 rounded-full bg-teal-600"
                    />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="px-4 py-16">
          <div className="mx-auto max-w-3xl">
            <h2 className="text-center text-2xl font-bold text-slate-900">
              Perguntas frequentes
            </h2>
            <dl className="mt-8 space-y-6">
              <div>
                <dt className="font-semibold text-slate-900">
                  Por que algumas informações ficam mesmo após exclusão?
                </dt>
                <dd className="mt-1 text-sm text-slate-600">
                  Lei 13.787/2018 + Resolução CFN 599 exigem retenção mínima de
                  prontuários por 20 anos. Anonimizamos: dados pessoais (nome,
                  CPF, contato) são apagados; apenas o histórico clínico anônimo
                  permanece, sem possibilidade de re-identificação.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">
                  Quanto custa exportar?
                </dt>
                <dd className="mt-1 text-sm text-slate-600">
                  Zero. Portabilidade é um direito do titular pela LGPD (Art.
                  18, V) e da organização (cliente B2B). Não cobramos por
                  export, anonimização ou ação relacionada a direitos LGPD.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">
                  Posso importar pra outro sistema?
                </dt>
                <dd className="mt-1 text-sm text-slate-600">
                  Sim. O ZIP contém CSVs estruturados (compatíveis com Dietbox,
                  Webdiet e formato CSV genérico) + PDFs originais. A maioria
                  dos sistemas concorrentes aceita esses formatos diretamente.
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">Quem é o DPO?</dt>
                <dd className="mt-1 text-sm text-slate-600">
                  Contato direto pelo formulário em /contato, assunto &ldquo;DPO
                  / LGPD&rdquo;. Resposta em até 15 dias úteis (Art. 19, § 2º).
                </dd>
              </div>
              <div>
                <dt className="font-semibold text-slate-900">
                  Como vocês protegem o ZIP durante o download?
                </dt>
                <dd className="mt-1 text-sm text-slate-600">
                  ZIP encriptado AES-256. Senha por SMS no celular cadastrado
                  (canal separado). Link expira em 7 dias. Logs de download
                  ficam no audit trail imutável.
                </dd>
              </div>
            </dl>
          </div>
        </section>

        {/* CTA final */}
        <section className="bg-teal-700 px-4 py-12 text-center text-white">
          <div className="mx-auto max-w-2xl">
            <h2 className="text-2xl font-bold">
              Quer testar a portabilidade antes de assinar?
            </h2>
            <p className="mt-2 text-teal-100">
              Crie uma conta beta, importe 10 pacientes, exporte tudo e veja o
              ZIP. Se não gostar, anonimiza em 1 clique.
            </p>
            <Link
              href="/contato"
              className="mt-6 inline-flex items-center gap-2 rounded-md bg-white px-6 py-3 text-base font-medium text-teal-800 transition hover:bg-teal-50"
            >
              Solicitar acesso ao beta
              <ArrowRight className="h-4 w-4" strokeWidth={2} />
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
    </>
  );
}
