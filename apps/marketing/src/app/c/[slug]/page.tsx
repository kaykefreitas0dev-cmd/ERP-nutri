import { notFound } from "next/navigation";
import Link from "next/link";
import { Container } from "@repo/ui/container";
import { Card, CardContent } from "@repo/ui/card";
import { Badge } from "@repo/ui/badge";
import { prisma } from "@nutricore/db";
import { SiteHeader } from "../../../components/SiteHeader";
import { SiteFooter } from "../../../components/SiteFooter";
import { BookingForm } from "./BookingForm";

export const dynamic = "force-dynamic";
export const revalidate = 300; // 5min — booking page raramente muda

interface Props {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: Props) {
  const { slug } = await params;
  try {
    const bp = await prisma.bookingPage.findFirst({
      where: { slug, isPublished: true },
      select: {
        displayName: true,
        bio: true,
        specialties: true,
        crn: true,
        crnUf: true,
      },
    });
    if (!bp) return { title: "Profissional não encontrado" };
    return {
      title: `${bp.displayName} - Agende sua consulta`,
      description:
        bp.bio?.slice(0, 160) ??
        `Agende uma consulta com ${bp.displayName}${
          bp.crn ? ` (${bp.crn}/${bp.crnUf})` : ""
        }. Atendimento profissional nutricional.`,
      openGraph: {
        title: `${bp.displayName} - NutriCore`,
        description: bp.bio?.slice(0, 200),
        type: "profile",
      },
    };
  } catch {
    return { title: "NutriCore" };
  }
}

export default async function BookingPagePublic({ params }: Props) {
  const { slug } = await params;

  let data: {
    bookingPage: {
      id: string;
      displayName: string;
      bio: string | null;
      photoUrl: string | null;
      crn: string | null;
      crnUf: string | null;
      specialties: string[];
      timezone: string;
      acceptsNewPatients: boolean;
      minNoticeHours: number;
      maxAdvanceDays: number;
    };
    services: Array<{
      id: string;
      name: string;
      description: string | null;
      durationMinutes: number;
      priceCents: number | null;
    }>;
    availabilityRules: Array<{
      dayOfWeek: number;
      startTime: string;
      endTime: string;
    }>;
  } | null = null;

  try {
    // Query pública: sem SET LOCAL app.current_org (RLS public_read cobre isPublished=true)
    const bookingPage = await prisma.bookingPage.findFirst({
      where: { slug, isPublished: true },
      select: {
        id: true,
        displayName: true,
        bio: true,
        photoUrl: true,
        crn: true,
        crnUf: true,
        specialties: true,
        timezone: true,
        acceptsNewPatients: true,
        minNoticeHours: true,
        maxAdvanceDays: true,
      },
    });

    if (!bookingPage) {
      data = null;
    } else {
      const services = await prisma.serviceOffering.findMany({
        where: { bookingPageId: bookingPage.id, isActive: true },
        orderBy: { sortOrder: "asc" },
        select: {
          id: true,
          name: true,
          description: true,
          durationMinutes: true,
          priceCents: true,
        },
      });

      const availabilityRules = await prisma.availabilityRule.findMany({
        where: { bookingPageId: bookingPage.id },
        select: {
          dayOfWeek: true,
          startTime: true,
          endTime: true,
        },
        orderBy: { dayOfWeek: "asc" },
      });

      data = { bookingPage, services, availabilityRules };
    }
  } catch (err) {
    console.error("[/c/:slug]", err);
    data = null;
  }

  if (!data) notFound();

  // JSON-LD structured data
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "MedicalBusiness",
    name: data.bookingPage.displayName,
    description: data.bookingPage.bio,
    image: data.bookingPage.photoUrl,
    medicalSpecialty: data.bookingPage.specialties?.[0] ?? "Nutrition",
    ...(data.bookingPage.crn && {
      identifier: `${data.bookingPage.crn}/${data.bookingPage.crnUf}`,
    }),
  };

  return (
    <>
      <SiteHeader />
      <main className="bg-bg-subtle py-10">
        <Container size="md">
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
          />

          <Card>
            <CardContent className="p-6 sm:p-8">
              <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
                {data.bookingPage.photoUrl ? (
                  <div className="h-24 w-24 overflow-hidden rounded-full bg-bg-subtle">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={data.bookingPage.photoUrl}
                      alt={data.bookingPage.displayName}
                      className="h-full w-full object-cover"
                    />
                  </div>
                ) : (
                  <div
                    className="flex h-24 w-24 items-center justify-center rounded-full bg-brand-100 text-3xl font-bold text-brand-primary"
                    aria-hidden
                  >
                    {data.bookingPage.displayName.charAt(0)}
                  </div>
                )}
                <div className="flex-1 text-center sm:text-left">
                  <h1 className="text-2xl font-bold text-text-primary">
                    {data.bookingPage.displayName}
                  </h1>
                  {data.bookingPage.crn && (
                    <p className="mt-1 text-sm text-text-secondary">
                      {data.bookingPage.crn}/{data.bookingPage.crnUf}
                    </p>
                  )}
                  {data.bookingPage.specialties.length > 0 && (
                    <div className="mt-3 flex flex-wrap justify-center gap-2 sm:justify-start">
                      {data.bookingPage.specialties.map((s) => (
                        <Badge key={s} variant="default">
                          {s}
                        </Badge>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {data.bookingPage.bio && (
                <p className="mt-6 whitespace-pre-wrap text-sm leading-relaxed text-text-secondary">
                  {data.bookingPage.bio}
                </p>
              )}
            </CardContent>
          </Card>

          {data.bookingPage.acceptsNewPatients ? (
            <div className="mt-6">
              <BookingForm
                bookingPageId={data.bookingPage.id}
                services={data.services}
                availabilityRules={data.availabilityRules}
                timezone={data.bookingPage.timezone}
                minNoticeHours={data.bookingPage.minNoticeHours}
                maxAdvanceDays={data.bookingPage.maxAdvanceDays}
              />
            </div>
          ) : (
            <Card className="mt-6">
              <CardContent className="p-6 text-center text-sm text-text-secondary">
                Esta profissional não está aceitando novos pacientes no momento.
                <br />
                <Link href="/" className="text-brand-primary underline">
                  Explore outros profissionais
                </Link>
              </CardContent>
            </Card>
          )}
        </Container>
      </main>
      <SiteFooter />
    </>
  );
}
