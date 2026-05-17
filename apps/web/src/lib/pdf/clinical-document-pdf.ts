/**
 * Gerador de PDF para ClinicalDocument via pdfkit (S11)
 *
 * Cada tipo (ATESTADO, RECEITA_SUPLEMENTO, ENCAMINHAMENTO, PLANO_ALIMENTAR)
 * recebe layout específico, mas todos compartilham:
 *   - Cabeçalho com nome+CRN do profissional
 *   - Identificação do paciente (nome + CPF parcial)
 *   - Corpo (markdown simples renderizado como texto plano)
 *   - Lista de CIDs (se houver)
 *   - Rodapé com data + assinatura mock (linha + nome+CRN)
 *
 * Retorna { buffer, sha256 } — hash usado para Lock 15 (imutabilidade).
 */

import PDFDocument from "pdfkit";
import { createHash } from "node:crypto";

export type DocPayload = {
  title: string;
  documentType:
    | "PLANO_ALIMENTAR"
    | "ATESTADO"
    | "RECEITA_SUPLEMENTO"
    | "ENCAMINHAMENTO"
    | "RECIBO";
  issuerName: string;
  issuerCrn: string | null;
  issuerCrnUf: string | null;
  patientNameSnapshot: string;
  patientCpfSnapshot: string | null;
  bodyMarkdown: string;
  cids: Array<{ code: string; description: string }>;
  issuedAt: Date | null;
  validUntil: Date | null;
  signatureValue: string | null;
};

const TYPE_LABELS: Record<DocPayload["documentType"], string> = {
  PLANO_ALIMENTAR: "Plano alimentar",
  ATESTADO: "Atestado",
  RECEITA_SUPLEMENTO: "Receita / Prescrição de suplementação",
  ENCAMINHAMENTO: "Encaminhamento profissional",
  RECIBO: "Recibo simples",
};

function maskCpf(cpf: string | null): string {
  if (!cpf) return "—";
  // mostra primeiros 3 + asteriscos + últimos 2 dígitos (LGPD: PHI parcial em doc clínico)
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.***.***.${digits.slice(9)}`;
}

function formatDate(d: Date | null): string {
  if (!d) return "—";
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

export async function renderClinicalDocumentPdf(
  payload: DocPayload,
): Promise<{ buffer: Buffer; sha256: string }> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 60, bottom: 60, left: 60, right: 60 },
        info: {
          Title: payload.title,
          Author: payload.issuerName,
          Subject: TYPE_LABELS[payload.documentType],
          Creator: "NutriCore",
        },
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => {
        const buffer = Buffer.concat(chunks);
        const sha256 = createHash("sha256").update(buffer).digest("hex");
        resolve({ buffer, sha256 });
      });
      doc.on("error", reject);

      // ---- CABEÇALHO ----
      doc
        .fontSize(18)
        .fillColor("#0f766e")
        .text("NutriCore", { align: "left", continued: false });
      doc.moveDown(0.2);
      doc
        .fontSize(10)
        .fillColor("#475569")
        .text(payload.issuerName, { continued: false });
      if (payload.issuerCrn) {
        doc.text(`CRN-${payload.issuerCrnUf ?? "—"}: ${payload.issuerCrn}`, {
          continued: false,
        });
      }
      doc.moveDown(0.5);

      // Linha separadora
      doc
        .strokeColor("#cbd5e1")
        .lineWidth(0.5)
        .moveTo(60, doc.y)
        .lineTo(535, doc.y)
        .stroke();
      doc.moveDown(0.5);

      // ---- TÍTULO DO DOCUMENTO ----
      doc
        .fontSize(16)
        .fillColor("#0f172a")
        .text(TYPE_LABELS[payload.documentType], { align: "center" });
      doc.moveDown(0.3);
      doc
        .fontSize(11)
        .fillColor("#64748b")
        .text(payload.title, { align: "center" });
      doc.moveDown(1);

      // ---- IDENTIFICAÇÃO DO PACIENTE ----
      doc.fontSize(11).fillColor("#0f172a");
      doc.font("Helvetica-Bold").text("Paciente: ", { continued: true });
      doc
        .font("Helvetica")
        .text(payload.patientNameSnapshot, { continued: false });
      doc.font("Helvetica-Bold").text("CPF: ", { continued: true });
      doc.font("Helvetica").text(maskCpf(payload.patientCpfSnapshot));
      doc.moveDown(1);

      // ---- CORPO ----
      doc.fontSize(11).fillColor("#0f172a").font("Helvetica");
      // Tratamento de markdown simples: split por \n\n para parágrafos
      const paragraphs = payload.bodyMarkdown.split(/\n\s*\n/).filter(Boolean);
      for (const p of paragraphs) {
        // Negrito **texto**
        const segments = p.split(/(\*\*[^*]+\*\*)/);
        for (const seg of segments) {
          if (seg.startsWith("**") && seg.endsWith("**")) {
            doc
              .font("Helvetica-Bold")
              .text(seg.slice(2, -2), { continued: true });
          } else if (seg) {
            doc.font("Helvetica").text(seg, { continued: true });
          }
        }
        doc.text("", { continued: false });
        doc.moveDown(0.6);
      }

      // ---- CIDs ----
      if (payload.cids.length > 0) {
        doc.moveDown(0.5);
        doc.fontSize(11).fillColor("#0f172a").font("Helvetica-Bold");
        doc.text("CID-10 relacionado(s):");
        doc.font("Helvetica").fontSize(10).fillColor("#334155");
        for (const cid of payload.cids) {
          doc.text(`  • ${cid.code} — ${cid.description}`);
        }
        doc.moveDown(1);
      }

      // ---- VALIDADE ----
      if (payload.validUntil) {
        doc.fontSize(10).fillColor("#475569").font("Helvetica-Oblique");
        doc.text(`Válido até: ${formatDate(payload.validUntil)}`);
        doc.moveDown(0.8);
      }

      // ---- ASSINATURA ----
      doc.moveDown(2);
      const sigY = doc.y;
      doc
        .strokeColor("#0f172a")
        .lineWidth(0.5)
        .moveTo(170, sigY)
        .lineTo(425, sigY)
        .stroke();
      doc.moveDown(0.3);
      doc
        .fontSize(10)
        .fillColor("#0f172a")
        .font("Helvetica-Bold")
        .text(payload.issuerName, { align: "center" });
      if (payload.issuerCrn) {
        doc
          .font("Helvetica")
          .fontSize(9)
          .fillColor("#475569")
          .text(`CRN-${payload.issuerCrnUf ?? "—"}: ${payload.issuerCrn}`, {
            align: "center",
          });
      }

      // Data + cidade da emissão
      doc.moveDown(0.5);
      doc
        .fontSize(9)
        .fillColor("#64748b")
        .text(`Emitido em ${formatDate(payload.issuedAt ?? new Date())}`, {
          align: "center",
        });

      // ---- MARCA D'ÁGUA DE ASSINATURA (Mock) ----
      if (payload.signatureValue) {
        doc.moveDown(2);
        doc
          .fontSize(7)
          .fillColor("#94a3b8")
          .font("Courier")
          .text(
            `Assinatura digital (Mock SHA-256): ${payload.signatureValue.slice(0, 32)}...${payload.signatureValue.slice(-8)}`,
            { align: "center" },
          );
        doc.text("Documento eletrônico — válido sem assinatura física.", {
          align: "center",
        });
      } else {
        doc.moveDown(2);
        doc
          .fontSize(8)
          .fillColor("#dc2626")
          .font("Helvetica-Oblique")
          .text("RASCUNHO — não assinado", { align: "center" });
      }

      // ---- RODAPÉ ----
      const pageHeight = doc.page.height;
      doc
        .fontSize(7)
        .fillColor("#94a3b8")
        .font("Helvetica")
        .text(
          "Gerado por NutriCore · plataforma de gestão clínica para nutricionistas",
          60,
          pageHeight - 40,
          { align: "center", width: 475 },
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
