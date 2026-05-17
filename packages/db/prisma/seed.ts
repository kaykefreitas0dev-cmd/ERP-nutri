// Prisma seed script — populando dados iniciais idempotentes
// Rodar via: `pnpm --filter @nutricore/db exec prisma db seed` (requer prisma.config.ts seed)
// Ou: `pnpm tsx packages/db/prisma/seed.ts`

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import pricingPlansData from "./seeds/pricing-plans.json";
import permissionsData from "./seeds/permissions.json";

if (!process.env.DATABASE_URL) {
  console.error("✗ DATABASE_URL não configurada. Defina antes de rodar seed.");
  process.exit(1);
}

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

async function seedPricingPlans() {
  console.log("→ Seeding pricing plans...");

  for (const plan of pricingPlansData) {
    await prisma.pricingPlan.upsert({
      where: { slug: plan.slug },
      create: {
        slug: plan.slug,
        name: plan.name,
        description: plan.description,
        priceMonthlyCents: plan.priceMonthlyCents,
        priceYearlyCents: plan.priceYearlyCents,
        features: plan.features,
        isPublic: plan.isPublic,
        isFeatured: plan.isFeatured,
        sortOrder: plan.sortOrder,
        trialDays: plan.trialDays,
      },
      update: {
        name: plan.name,
        description: plan.description,
        priceMonthlyCents: plan.priceMonthlyCents,
        priceYearlyCents: plan.priceYearlyCents,
        features: plan.features,
        isPublic: plan.isPublic,
        isFeatured: plan.isFeatured,
        sortOrder: plan.sortOrder,
        trialDays: plan.trialDays,
      },
    });
  }

  console.log(`  ✓ ${pricingPlansData.length} pricing plans`);
}

async function seedPermissions() {
  console.log("→ Seeding permissions baseline...");

  for (const perm of permissionsData) {
    await prisma.permission.upsert({
      where: { slug: perm.slug },
      create: {
        slug: perm.slug,
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
      },
      update: {
        resource: perm.resource,
        action: perm.action,
        description: perm.description,
      },
    });
  }

  console.log(`  ✓ ${permissionsData.length} permissions`);
}

async function seedKeepalive() {
  console.log("→ Seeding _keepalive...");
  await prisma.$executeRaw`
    INSERT INTO _keepalive (id, last_touched)
    VALUES (1, now())
    ON CONFLICT (id) DO NOTHING
  `;
  console.log("  ✓ _keepalive row");
}

async function seedDemoServiceHealth() {
  console.log("→ Seeding service_health (placeholder até CF Worker rodar)...");
  const services = [
    { service_key: "database", public_label: "Base de dados", internal_label: "Supabase Postgres" },
    { service_key: "email", public_label: "Envio de emails", internal_label: "AWS SES / Resend" },
    { service_key: "payments", public_label: "Processamento de pagamentos", internal_label: "Asaas" },
    { service_key: "storage", public_label: "Armazenamento de arquivos", internal_label: "Supabase Storage + R2" },
  ];

  for (const s of services) {
    await prisma.$executeRaw`
      INSERT INTO service_health (id, service_key, public_label, internal_label, status, observed_at)
      VALUES (gen_random_uuid(), ${s.service_key}, ${s.public_label}, ${s.internal_label}, 'operational', now())
    `;
  }
  console.log(`  ✓ ${services.length} service_health entries`);
}

async function main() {
  console.log("🌱 NutriCore seed starting...");
  console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? "✓ set" : "✗ not set"}`);

  await seedPricingPlans();
  await seedPermissions();
  await seedKeepalive();
  await seedDemoServiceHealth();

  console.log("✅ Seed completo");
}

main()
  .catch((e) => {
    console.error("✗ Seed falhou:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
