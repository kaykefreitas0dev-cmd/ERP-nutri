"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
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
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState(defaultEmail ?? "");
  const [error, setError] = useState<string | null>(null);
  const [inviteUrl, setInviteUrl] = useState<string | null>(null);
  const [emailSent, setEmailSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [confirmingRevoke, setConfirmingRevoke] = useState(false);

  if (hasLinkedAccount) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-full bg-success-bg px-3 py-1 text-tiny font-medium text-success">
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
    setConfirmingRevoke(true);
  }

  function confirmRevoke() {
    if (!activeInviteId) return;
    setConfirmingRevoke(false);
    startTransition(async () => {
      await revokeInviteAction(activeInviteId);
      router.refresh();
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
        className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-tiny font-medium text-white hover:bg-brand-primary-hover"
      >
        <Mail className="h-3.5 w-3.5" strokeWidth={1.75} />
        Convidar para acessar app
      </button>
    );
  }

  if (hasActiveInvite && !inviteUrl) {
    return (
      <div className="rounded-md border border-warning-border bg-warning-bg p-3 text-tiny text-warning">
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
        {confirmingRevoke ? (
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="text-danger">
              Revogar convite? O paciente não poderá mais usar o link.
            </span>
            <button
              type="button"
              onClick={confirmRevoke}
              disabled={pending}
              className="rounded bg-danger px-2 py-1 text-tiny text-white transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              Confirmar
            </button>
            <button
              type="button"
              onClick={() => setConfirmingRevoke(false)}
              className="rounded border border-border-default bg-bg-surface px-2 py-1 text-tiny"
            >
              Cancelar
            </button>
          </div>
        ) : (
          <div className="mt-2 flex gap-2">
            <button
              type="button"
              onClick={() => {
                setOpen(true);
                setEmail(activeInviteEmail ?? "");
              }}
              className="rounded border border-border-default bg-bg-surface px-2 py-1 text-tiny"
            >
              Reenviar (novo link)
            </button>
            <button
              type="button"
              onClick={handleRevoke}
              disabled={pending}
              className="rounded border border-danger bg-bg-surface px-2 py-1 text-tiny text-danger"
            >
              Revogar
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3 rounded-md border border-border-default bg-bg-surface p-3 [box-shadow:var(--shadow-xs)]">
      <p className="text-tiny text-text-secondary">
        Gere um link de acesso passwordless. O paciente entrará pelo email
        recebido no app.
      </p>

      <div>
        <label htmlFor="invite-email" className="block text-tiny font-medium">
          Email do paciente *
        </label>
        <input
          id="invite-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="paciente@email.com"
          className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-body"
        />
      </div>

      {error && (
        <p role="alert" className="text-tiny text-danger">
          {error}
        </p>
      )}

      {inviteUrl && (
        <div className="rounded-md border border-success-border bg-success-bg p-2">
          {emailSent ? (
            <>
              <p className="flex items-center gap-1.5 text-tiny font-semibold text-success">
                <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
                Email enviado para {email}!
              </p>
              <p className="mt-1 text-[10px] text-success">
                O paciente receberá um email com o link de acesso. Se ele não
                receber em alguns minutos, pode usar o link abaixo manualmente.
              </p>
            </>
          ) : (
            <p className="flex items-center gap-1.5 text-tiny font-medium text-success">
              <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
              Link gerado! (sem provider de email configurado — envie
              manualmente abaixo)
            </p>
          )}
          <input
            readOnly
            value={inviteUrl}
            onClick={(e) => (e.target as HTMLInputElement).select()}
            className="mt-2 block w-full rounded border border-success-border bg-bg-surface px-2 py-1 font-mono text-[10px]"
          />
          <button
            type="button"
            onClick={handleCopy}
            className="mt-1 inline-flex items-center gap-1 rounded bg-success px-2 py-1 text-tiny font-medium text-white transition-opacity hover:opacity-90"
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
            className="inline-flex items-center gap-1.5 rounded-md bg-brand-primary px-3 py-1.5 text-tiny font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
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
          className="rounded-md border border-border-default bg-bg-surface px-3 py-1.5 text-tiny"
        >
          {inviteUrl ? "Fechar" : "Cancelar"}
        </button>
      </div>
    </div>
  );
}
