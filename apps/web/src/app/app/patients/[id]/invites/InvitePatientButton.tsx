"use client";

import { useState, useTransition } from "react";
import { CircleCheck, Mail, ClipboardCopy } from "lucide-react";
import { createInviteAction, revokeInviteAction } from "./actions";

interface Props {
  patientId: string;
  patientName: string;
  defaultEmail: string | null;
  hasActiveInvite: boolean;
  activeInviteId: string | null;
  activeInviteEmail: string | null;
  activeInviteExpiresAt: Date | null;
  hasLinkedAccount: boolean;
}

export function InvitePatientButton({
  patientId,
  defaultEmail,
  hasActiveInvite,
  activeInviteId,
  activeInviteEmail,
  activeInviteExpiresAt,
  hasLinkedAccount,
}: Props) {
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);

  if (hasLinkedAccount) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-800">
        <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
        Paciente acessou plataforma
      </span>
    );
  }

  async function handleCreate() {
    setError(null);
    setCopied(false);
    if (!email || !email.includes("@")) {
      setError("Email obrigatório");
      return;
    }
    startTransition(async () => {
      const r = await createInviteAction({ patientId, email: email.trim() });
      if (!r.ok) {
        setError(r.message ?? "Erro");
        return;
      }
      setInviteUrl(r.inviteUrl ?? null);
      setEmailSent(Boolean(r.emailSent));
    });
  }

  async function handleRevoke() {
    if (!activeInviteId) return;
    if (
      !confirm("Revogar convite ativo? O paciente não poderá mais usar o link.")
    )
      return;
    startTransition(async () => {
      await revokeInviteAction(activeInviteId);
      window.location.reload();
    });
  }

  async function handleCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // fallback: select text manually
    }
  }

  if (!open && !hasActiveInvite) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-primary-hover"
      >
        <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
        Convidar para acessar app
      </button>
    );
  }

  if (hasActiveInvite && !inviteUrl) {
    return (
      <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-xs text-amber-800">
        <p>
          <strong>Convite ativo enviado para:</strong>{" "}
          {activeInviteEmail ?? "—"}
        </p>
        {activeInviteExpiresAt && (
          <p>
            Expira em{" "}
            {new Date(activeInviteExpiresAt).toLocaleDateString("pt-BR")}
          </p>
        )}
        <div className="mt-2 flex gap-2">
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              setEmail(activeInviteEmail ?? "");
            }}
            className="rounded border border-amber-400 bg-white px-2 py-1 text-xs"
          >
            Reenviar (novo link)
          </button>
          <button
            type="button"
            onClick={handleRevoke}
            disabled={pending}
            className="rounded border border-red-300 bg-white px-2 py-1 text-xs text-red-700"
          >
            Revogar
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-slate-300 bg-white p-3 shadow-sm">
      <p className="text-xs text-slate-700">
        Gere um link de acesso passwordless. O paciente entrará pelo email
        recebido no app.
      </p>

      <div>
        <label htmlFor="invite-email" className="block text-xs font-medium">
          Email do paciente *
        </label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="paciente@email.com"
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm"
        />
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}

      {inviteUrl && (
        <div className="rounded-md border border-green-300 bg-green-50 p-2">
          {emailSent ? (
            <>
              <p className="flex items-center gap-1.5 text-xs font-semibold text-green-800">
                <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
                Email enviado para {email}!
              </p>
              <p className="mt-1 text-[10px] text-green-700">
                O paciente receberá um email com o link de acesso. Se ele não
                receber em alguns minutos, pode usar o link abaixo manualmente.
              </p>
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-xs font-medium text-green-800">
              <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
              Link gerado! (sem provider de email configurado — envie
              manualmente abaixo)
            </p>
          )}
          <input
            readOnly
            value={inviteUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="mt-2 block w-full rounded border border-green-300 bg-white px-2 py-1 font-mono text-[10px]"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="mt-1 inline-flex items-center gap-1 rounded bg-green-700 px-2 py-1 text-xs font-medium text-white hover:bg-green-800"
          >
            {copied ? (
              <>
                <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
                Copiado
              </>
            ) : (
              <>
                <ClipboardCopy className="h-3.5 w-3.5" strokeWidth={2} />
                Copiar link
              </>
            )}
          </button>
        </div>
      )}

      <div className="flex gap-2">
        {!inviteUrl && (
          <button
            type="button"
            onClick={handleCreate}
            disabled={pending}
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
          >
            {pending ? (
              "Enviando..."
            ) : (
              <>
                <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
                Enviar convite
              </>
            )}
          </button>
        )}
        <button
          type="button"
          onClick={() => {
            setOpen(false);
            setError(null);
            setInviteUrl(null);
          }}
          className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs"
        >
          {inviteUrl ? "Fechar" : "Cancelar"}
        </button>
      </div>
    </div>
  );
}
