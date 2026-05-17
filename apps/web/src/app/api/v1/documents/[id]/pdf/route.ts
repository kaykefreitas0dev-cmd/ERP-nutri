/**
 * GET /api/v1/documents/[id]/pdf
 *
 * Stream do PDF de um ClinicalDocument:
 *   - DRAFT: gera on-the-fly (preview, sem assinatura)
 *   - ISSUED: serve do Supabase Storage (signed URL não é necessário —
 *     a Route Handler já roda tenant-aware via cookies)
 *
 * Tenant-aware via withTenantAction. Audit log em download de ISSUED.
 */

import { NextRequest, NextResponse } from "next/server";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";
import { createSupabaseServiceClient } from "@/lib/supabase/server";
import { renderClinicalDocumentPdf } from "@/lib/pdf/clinical-document-pdf";

const DOC_BUCKET = "clinical-documents";

interface Params {
  params: Promise<{ id: string }>;
}

export const dynamic = "force-dynamic";
export const runtime = "nodejs"; // pdfkit precisa de fs

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  try {
    const payload = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        const doc = await tx.clinicalDocument.findFirst({
          where: { id },
          include: {
            cidCodes: { include: { cid: true } },
            signature: true,
          },
        });
        if (!doc) return null;

        // Audit em download
        await tx.$executeRaw`
          SELECT audit.append_log(
            ${organizationId}::uuid, ${userId}::uuid,
            'nutritionist'::text, NULL::inet, NULL::text,
            'clinical_document.download'::text, 'ClinicalDocument'::text,
            ${doc.id}::text, ${doc.patientId}::uuid,
            ARRAY['pdfStorageKey']::text[],
            '{}'::jsonb
          )
        `;

        return doc;
      },
    );

    if (!payload) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }

    // ISSUED ou REVOKED → servir do Storage
    if (payload.status !== "DRAFT" && payload.pdfStorageKey) {
      const supabaseAdmin = createSupabaseServiceClient();
      const { data, error } = await supabaseAdmin.storage
        .from(DOC_BUCKET)
        .download(payload.pdfStorageKey);
      if (error || !data) {
        return NextResponse.json(
          { error: "storage_download_failed", message: error?.message },
          { status: 502 },
        );
      }
      const arrayBuffer = await data.arrayBuffer();
      return new NextResponse(arrayBuffer, {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename="${slug(payload.title)}.pdf"`,
          "Cache-Control": "private, no-cache",
        },
      });
    }

    // DRAFT → render on-the-fly (preview)
    const cidsForPdf = payload.cidCodes.map(
      (c: { cid: { code: string; description: string } }) => ({
        code: c.cid.code,
        description: c.cid.description,
      }),
    );
    const { buffer } = await renderClinicalDocumentPdf({
      title: payload.title,
      documentType: payload.documentType,
      issuerName: payload.issuerName,
      issuerCrn: payload.issuerCrn,
      issuerCrnUf: payload.issuerCrnUf,
      patientNameSnapshot: payload.patientNameSnapshot,
      patientCpfSnapshot: payload.patientCpfSnapshot,
      bodyMarkdown: payload.bodyMarkdown,
      cids: cidsForPdf,
      issuedAt: null,
      validUntil: payload.validUntil,
      signatureValue: null,
    });

    return new NextResponse(new Uint8Array(buffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${slug(payload.title)}-PREVIEW.pdf"`,
        "Cache-Control": "private, no-cache",
      },
    });
  } catch (err) {
    if (err instanceof ActionTenantError) {
      return NextResponse.json(
        { error: err.code, message: err.message },
        { status: err.code === "UNAUTHORIZED" ? 401 : 403 },
      );
    }
    return NextResponse.json(
      {
        error: "internal",
        message: err instanceof Error ? err.message : "Erro",
      },
      { status: 500 },
    );
  }
}

function slug(s: string): string {
  return s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .toLowerCase()
    .slice(0, 60);
}
