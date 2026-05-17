// GET /api/v1/public/pricing-plans — endpoint público (sem auth)
// Consumido por apps/marketing para Pricing dinâmico (S2b)
// Cache CDN 1h (planos não mudam com frequência)

import { NextResponse } from "next/server";
import { prisma } from "@nutricore/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface PublicPricingPlan {
  slug: string;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_yearly_cents: number;
  features: Record<string, unknown>;
  is_featured: boolean;
  trial_days: number;
}

export async function GET() {
  try {
    const plans = await prisma.pricingPlan.findMany({
      where: { isPublic: true },
      orderBy: [{ sortOrder: "asc" }, { priceMonthlyCents: "asc" }],
      select: {
        slug: true,
        name: true,
        description: true,
        priceMonthlyCents: true,
        priceYearlyCents: true,
        features: true,
        isFeatured: true,
        trialDays: true,
      },
    });

    // Renomear para snake_case (API convention) e remover campos internos
    // (asaas_plan_id, stripe_price_* não vão pra cliente público)
    const publicPlans: PublicPricingPlan[] = plans.map((p) => ({
      slug: p.slug,
      name: p.name,
      description: p.description,
      price_monthly_cents: p.priceMonthlyCents,
      price_yearly_cents: p.priceYearlyCents,
      features: (p.features as Record<string, unknown>) ?? {},
      is_featured: p.isFeatured,
      trial_days: p.trialDays,
    }));

    return NextResponse.json(
      { items: publicPlans, count: publicPlans.length },
      {
        status: 200,
        headers: {
          // Cache CDN 1h + stale-while-revalidate 24h
          "Cache-Control":
            "public, max-age=3600, s-maxage=3600, stale-while-revalidate=86400",
        },
      },
    );
  } catch (err) {
    console.error("[/v1/public/pricing-plans]", err);
    return NextResponse.json(
      {
        items: [],
        count: 0,
        error: "Pricing plans temporarily unavailable",
      },
      { status: 200 }, // 200 graceful — não quebrar pricing page
    );
  }
}
