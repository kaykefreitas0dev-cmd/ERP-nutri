import { SiteHeader } from "../components/SiteHeader";
import { SiteFooter } from "../components/SiteFooter";
import { Hero } from "../components/Hero";
import { Features } from "../components/Features";
import { Pricing } from "../components/Pricing";
import { Faq } from "../components/Faq";

export const revalidate = 3600; // ISR 1h (pricing pode mudar)

interface PricingPlan {
  slug: string;
  name: string;
  description: string | null;
  price_monthly_cents: number;
  price_yearly_cents: number;
  features: { included?: string[]; limits?: Record<string, number | null> };
  is_featured: boolean;
  trial_days: number;
}

async function fetchPricingPlans(): Promise<PricingPlan[]> {
  const url =
    process.env.NEXT_PUBLIC_PRICING_API_URL ??
    process.env.NEXT_PUBLIC_WEB_URL ??
    "https://erp-nutri-web.vercel.app";

  try {
    const res = await fetch(`${url}/api/v1/public/pricing-plans`, {
      next: { revalidate: 3600, tags: ["pricing"] },
    });
    if (!res.ok) return [];
    const data = (await res.json()) as { items?: PricingPlan[] };
    return data.items ?? [];
  } catch {
    return [];
  }
}

export default async function Home() {
  const plans = await fetchPricingPlans();

  return (
    <>
      <SiteHeader />
      <main>
        <Hero />
        <Features />
        <Pricing plans={plans} />
        <Faq />
      </main>
      <SiteFooter />
    </>
  );
}
