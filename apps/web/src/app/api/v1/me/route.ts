// GET /api/v1/me — User global + memberships
// Endpoint autenticado mas NÃO requer org context (user pode ter 0 ou N orgs)

import { NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { prisma } from "@nutricore/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const dbUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        id: true,
        email: true,
        phone: true,
        fullName: true,
        avatarUrl: true,
        preferredLanguage: true,
        timezone: true,
        status: true,
        createdAt: true,
        memberships: {
          where: { status: "ACTIVE" },
          select: {
            organizationId: true,
            role: true,
            organization: {
              select: {
                slug: true,
                name: true,
                subscriptionStatus: true,
              },
            },
          },
        },
      },
    });

    if (!dbUser) {
      // Trigger handle_new_user deve ter criado, mas se não foi (race),
      // retorna 404 forçando criação no próximo login
      return NextResponse.json(
        { error: "User profile not yet provisioned" },
        { status: 404 },
      );
    }

    return NextResponse.json(
      {
        id: dbUser.id,
        email: dbUser.email,
        phone: dbUser.phone,
        full_name: dbUser.fullName,
        avatar_url: dbUser.avatarUrl,
        preferred_language: dbUser.preferredLanguage,
        timezone: dbUser.timezone,
        status: dbUser.status,
        created_at: dbUser.createdAt.toISOString(),
        memberships: dbUser.memberships.map((m) => ({
          organization_id: m.organizationId,
          organization_slug: m.organization.slug,
          organization_name: m.organization.name,
          subscription_status: m.organization.subscriptionStatus,
          role: m.role,
        })),
      },
      {
        status: 200,
        headers: { "Cache-Control": "private, no-store" },
      },
    );
  } catch (err) {
    console.error("[/v1/me]", err);
    return NextResponse.json(
      { error: "Internal error" },
      { status: 500 },
    );
  }
}
