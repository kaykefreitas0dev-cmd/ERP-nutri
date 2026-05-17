/**
 * GET /auth/accept-invite?token=<plain>
 *
 * Disparado depois do magic link voltar para /auth/callback?next=/auth/accept-invite?token=...
 * - Confere usuário autenticado
 * - Confere token (hash match + não expirado + não revogado + não aceito)
 * - Confere email do invite == email do JWT
 * - Linka Patient.user_id = auth.users.id
 * - Marca invite.accepted_at + accepted_by_user_id
 *
 * Tudo em transação para atomicidade.
 */

import { NextRequest, NextResponse } from "next/server";
import { createHash } from "node:crypto";
import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.redirect(new URL("/?error=missing_token", url.origin));
  }

  // 1. Confere sessão Supabase
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user || !user.email) {
    return NextResponse.redirect(
      new URL("/login?error=not_authenticated", url.origin),
    );
  }

  // 2. Lookup invite
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const invite = await prisma.patientInvite.findUnique({
    where: { tokenHash },
    select: {
      id: true,
      email: true,
      patientId: true,
      organizationId: true,
      expiresAt: true,
      acceptedAt: true,
      revokedAt: true,
    },
  });

  if (!invite) {
    return NextResponse.redirect(
      new URL("/?error=invite_not_found", url.origin),
    );
  }
  if (invite.revokedAt) {
    return NextResponse.redirect(new URL("/?error=invite_revoked", url.origin));
  }
  if (invite.acceptedAt) {
    // Já aceito previamente — deixar passar para /app (idempotente)
    return NextResponse.redirect(new URL("/app", url.origin));
  }
  if (new Date(invite.expiresAt) < new Date()) {
    return NextResponse.redirect(new URL("/?error=invite_expired", url.origin));
  }

  // 3. Email check (case-insensitive)
  if (invite.email.trim().toLowerCase() !== user.email.trim().toLowerCase()) {
    return NextResponse.redirect(new URL("/?error=email_mismatch", url.origin));
  }

  // 4. Linkar Patient.user_id + accepted_at (transação)
  try {
    await prisma.$transaction(async (tx) => {
      // Atomic check-and-set: só atualiza se ainda não aceito (anti-race)
      const updated = await tx.patientInvite.updateMany({
        where: { id: invite.id, acceptedAt: null, revokedAt: null },
        data: { acceptedAt: new Date(), acceptedByUserId: user.id },
      });
      if (updated.count === 0) {
        throw new Error("Invite already processed (race)");
      }

      // Link patient.user_id se ainda não vinculado
      const patient = await tx.patient.findUnique({
        where: { id: invite.patientId },
        select: { userId: true },
      });
      if (patient && !patient.userId) {
        await tx.patient.update({
          where: { id: invite.patientId },
          data: { userId: user.id },
        });
      }

      // Audit log (com org context manual)
      await tx.$executeRaw`
        SELECT audit.append_log(
          ${invite.organizationId}::uuid, ${user.id}::uuid,
          'patient'::text, NULL::inet, NULL::text,
          'patient_invite.accept'::text, 'PatientInvite'::text,
          ${invite.id}::text, ${invite.patientId}::uuid,
          ARRAY['acceptedAt','acceptedByUserId']::text[],
          '{}'::jsonb
        )
      `;
    });
  } catch {
    return NextResponse.redirect(new URL("/?error=accept_failed", url.origin));
  }

  return NextResponse.redirect(new URL("/app?welcome=1", url.origin));
}
