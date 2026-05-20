"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { CircleCheck } from "lucide-react";
import { updateBrandingAction } from "./actions";

interface Props {
  orgId: string;
  initial: {
    logoUrl: string;
    primaryColor: string;
    emailFromName: string;
  };
  disabled: boolean;
}

export function OrgSettingsForm({ initial, disabled }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl);
  const [primaryColor, setPrimaryColor] = useState(initial.primaryColor);
  const [emailFromName, setEmailFromName] = useState(initial.emailFromName);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaved(false);
    startTransition(async () => {
      const r = await updateBrandingAction({
        logoUrl: logoUrl.trim(),
        primaryColor,
        emailFromName: emailFromName.trim(),
      });
      if (!r.ok) {
        setError(r.message ?? "Erro");
        return;
      }
      setSaved(true);
      router.refresh();
      setTimeout(() => setSaved(false), 3000);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label
          htmlFor="logoUrl"
          className="block text-xs font-medium text-text-secondary"
        >
          URL do logo (opcional)
        </label>
        <input
          id="logoUrl"
          type="url"
          value={logoUrl}
          onChange={(e) => setLogoUrl(e.target.value)}
          placeholder="https://exemplo.com/logo.png"
          disabled={disabled}
          className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-sm disabled:bg-bg-subtle"
        />
        <p className="mt-1 text-xs text-text-muted">
          Aceita URL pública de imagem (Imgur, Cloudinary, etc.).
        </p>
        {logoUrl && (
          <div className="mt-2 inline-flex items-center gap-2 rounded-md border border-border-subtle bg-bg-subtle px-3 py-2">
            <img
              src={logoUrl}
              alt="Preview"
              className="h-10 w-auto object-contain"
              onError={(e) =>
                ((e.target as HTMLImageElement).style.display = "none")
              }
            />
            <span className="text-xs text-text-secondary">Preview</span>
          </div>
        )}
      </div>

      <div>
        <label
          htmlFor="primaryColor"
          className="block text-xs font-medium text-text-secondary"
        >
          Cor primária (hex)
        </label>
        <div className="mt-1 flex items-center gap-2">
          <input
            id="primaryColor"
            type="color"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            disabled={disabled}
            className="h-10 w-16 rounded border border-border-default"
          />
          <input
            type="text"
            value={primaryColor}
            onChange={(e) => setPrimaryColor(e.target.value)}
            disabled={disabled}
            pattern="^#[0-9A-Fa-f]{6}$"
            className="block w-32 rounded-md border border-border-default px-3 py-2 font-mono text-sm uppercase disabled:bg-bg-subtle"
          />
        </div>
        <p className="mt-1 text-xs text-text-muted">
          Aparece em PDFs (atestados, recibos) e botões CTA do email de convite.
        </p>
      </div>

      <div>
        <label
          htmlFor="emailFromName"
          className="block text-xs font-medium text-text-secondary"
        >
          Nome no remetente do email
        </label>
        <input
          id="emailFromName"
          type="text"
          value={emailFromName}
          onChange={(e) => setEmailFromName(e.target.value)}
          required
          minLength={2}
          maxLength={80}
          disabled={disabled}
          className="mt-1 block w-full rounded-md border border-border-default px-3 py-2 text-sm disabled:bg-bg-subtle"
        />
        <p className="mt-1 text-xs text-text-muted">
          Como aparece em &ldquo;De:&rdquo; nos emails de convite. Ex:
          &ldquo;Clínica X&rdquo; vira &ldquo;Clínica X
          &lt;onboarding@resend.dev&gt;&rdquo;.
        </p>
      </div>

      {error && (
        <p role="alert" className="text-xs text-red-700">
          {error}
        </p>
      )}

      {saved && (
        <p className="flex items-center gap-1.5 text-xs font-medium text-green-700">
          <CircleCheck className="h-3.5 w-3.5" strokeWidth={2} />
          Salvo!
        </p>
      )}

      <button
        type="submit"
        disabled={disabled || pending}
        className="rounded-md bg-brand-primary px-5 py-2 text-sm font-medium text-white hover:bg-brand-primary-hover disabled:opacity-50"
      >
        {pending ? "Salvando..." : "Salvar branding"}
      </button>
    </form>
  );
}
