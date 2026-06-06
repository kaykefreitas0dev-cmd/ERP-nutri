/**
 * Gerador de PDF do Relatório de Evolução do Paciente (via pdfkit).
 *
 * Consolida o progresso longitudinal do paciente em um documento único:
 *   - Cabeçalho: branding + nome+CRN do profissional
 *   - Identificação do paciente + período coberto
 *   - Evolução antropométrica: comparação inicial × atual (Δ) + tabela
 *   - Engajamento (check-ins): streak, médias, aderência ao plano
 *   - Histórico de planos alimentares
 *   - Rodapé + linha de assinatura
 *
 * Retorna Buffer pronto para stream. runtime "nodejs" (pdfkit usa fs).
 */

import PDFDocument from "pdfkit";

const COLORS = {
  brand: "#0f766e",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  border: "#e2e8f0",
  positive: "#0f766e",
  negative: "#dc2626",
  neutral: "#64748b",
  sectionHeader: "#f1f5f9",
  rowAlt: "#f8fafc",
  box: "#f0fdf4",
};

export type EvolutionAnthropometry = {
  measuredAt: Date;
  weightKg: number | null;
  heightCm: number | null;
  bodyMassIndex: number | null;
  bodyFatPctCalc: number | null;
  basalMetabolismMifflin: number | null;
};

export type EvolutionCheckins = {
  totalCheckins: number;
  currentStreak: number;
  longestStreak: number;
  avgMood: number | null;
  avgEnergy: number | null;
  avgWaterMl: number | null;
  adherencePct: number | null;
  daysTracked: number;
  lastCheckinDate: Date | null;
};

export type EvolutionMealPlan = {
  name: string;
  status: string;
  startDate: Date | null;
  endDate: Date | null;
  createdAt: Date;
};

export type EvolutionReportPayload = {
  issuerName: string;
  issuerCrn: string | null;
  issuerCrnUf: string | null;
  patientName: string;
  patientCpf: string | null;
  patientAge: string | null;
  generatedAt: Date;
  /** Cronológico ASC (mais antigo → mais recente). */
  anthropometry: EvolutionAnthropometry[];
  checkins: EvolutionCheckins | null;
  mealPlans: EvolutionMealPlan[];
};

const STATUS_LABEL: Record<string, string> = {
  DRAFT: "Rascunho",
  ACTIVE: "Ativo",
  COMPLETED: "Concluído",
  REPLACED: "Substituído",
  ARCHIVED: "Arquivado",
};

function maskCpf(cpf: string | null): string {
  if (!cpf) return "—";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.***.***-${digits.slice(9)}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function shortDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}

type Doc = InstanceType<typeof PDFDocument>;

function drawLine(doc: Doc, color = COLORS.border, width = 0.5) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  doc
    .strokeColor(color)
    .lineWidth(width)
    .moveTo(left, doc.y)
    .lineTo(right, doc.y)
    .stroke();
}

function ensureSpace(doc: Doc, needed: number) {
  if (doc.y > doc.page.height - doc.page.margins.bottom - needed) {
    doc.addPage();
  }
}

function sectionTitle(doc: Doc, title: string) {
  ensureSpace(doc, 60);
  const left = doc.page.margins.left;
  const pageW = doc.page.width - left - doc.page.margins.right;
  const top = doc.y;
  doc.rect(left, top, pageW, 18).fillColor(COLORS.sectionHeader).fill();
  doc
    .fontSize(10)
    .fillColor(COLORS.textPrimary)
    .font("Helvetica-Bold")
    .text(title, left + 6, top + 4.5, { width: pageW - 12 });
  doc.y = top + 24;
}

/** Format a metric value compactly with its unit. */
function fmt(value: number | null, unit: string, decimals = 1): string {
  if (value === null) return "—";
  const n =
    unit === "kcal"
      ? Math.round(value).toLocaleString("pt-BR")
      : value.toFixed(decimals);
  return unit ? `${n} ${unit}` : n;
}

export async function renderEvolutionReportPdf(
  payload: EvolutionReportPayload,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Relatório de evolução — ${payload.patientName}`,
          Author: payload.issuerName,
          Subject: "Relatório de evolução NutriCore",
          Creator: "NutriCore",
        },
        autoFirstPage: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const left = doc.page.margins.left;
      const pageW =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;

      // ── CABEÇALHO ──────────────────────────────────────────────────────
      doc
        .fontSize(16)
        .fillColor(COLORS.brand)
        .font("Helvetica-Bold")
        .text("NutriCore");
      doc.moveDown(0.15);
      doc
        .fontSize(9)
        .fillColor(COLORS.textSecondary)
        .font("Helvetica")
        .text(payload.issuerName);
      if (payload.issuerCrn) {
        doc.text(`CRN-${payload.issuerCrnUf ?? "—"}: ${payload.issuerCrn}`);
      }
      doc.moveDown(0.4);
      drawLine(doc);
      doc.moveDown(0.4);

      // ── TÍTULO ─────────────────────────────────────────────────────────
      doc
        .fontSize(15)
        .fillColor(COLORS.textPrimary)
        .font("Helvetica-Bold")
        .text("Relatório de Evolução", { align: "center" });
      doc.moveDown(0.6);

      // ── PACIENTE ───────────────────────────────────────────────────────
      doc
        .fontSize(10)
        .fillColor(COLORS.textPrimary)
        .font("Helvetica-Bold")
        .text("Paciente: ", { continued: true });
      doc.font("Helvetica").text(payload.patientName);
      doc.font("Helvetica-Bold").text("CPF: ", { continued: true });
      doc.font("Helvetica").text(maskCpf(payload.patientCpf), {
        continued: payload.patientAge !== null,
      });
      if (payload.patientAge !== null) {
        doc
          .font("Helvetica-Bold")
          .text("    Idade: ", { continued: true })
          .font("Helvetica")
          .text(payload.patientAge);
      }

      // Período coberto pela antropometria
      if (payload.anthropometry.length > 0) {
        const first = payload.anthropometry[0]!.measuredAt;
        const last =
          payload.anthropometry[payload.anthropometry.length - 1]!.measuredAt;
        doc.font("Helvetica-Bold").text("Período: ", { continued: true });
        doc.font("Helvetica").text(`${shortDate(first)} a ${shortDate(last)}`);
      }
      doc.moveDown(0.8);

      // ── EVOLUÇÃO ANTROPOMÉTRICA ─────────────────────────────────────────
      sectionTitle(doc, "Evolução antropométrica");

      if (payload.anthropometry.length === 0) {
        doc
          .fontSize(9)
          .fillColor(COLORS.textMuted)
          .font("Helvetica-Oblique")
          .text("Nenhuma medição registrada no período.");
        doc.moveDown(0.6);
      } else {
        const first = payload.anthropometry[0]!;
        const last = payload.anthropometry[payload.anthropometry.length - 1]!;

        // Cartões de comparação inicial × atual (Δ) — só para métricas com
        // ambos os extremos presentes.
        const metrics: Array<{
          label: string;
          unit: string;
          decimals: number;
          a: number | null;
          b: number | null;
          /** true = queda é geralmente desejável (peso, %GC). */
          lowerIsBetter: boolean;
        }> = [
          {
            label: "Peso",
            unit: "kg",
            decimals: 1,
            a: first.weightKg,
            b: last.weightKg,
            lowerIsBetter: true,
          },
          {
            label: "IMC",
            unit: "",
            decimals: 1,
            a: first.bodyMassIndex,
            b: last.bodyMassIndex,
            lowerIsBetter: true,
          },
          {
            label: "%GC",
            unit: "%",
            decimals: 1,
            a: first.bodyFatPctCalc,
            b: last.bodyFatPctCalc,
            lowerIsBetter: true,
          },
          {
            label: "GEB",
            unit: "kcal",
            decimals: 0,
            a: first.basalMetabolismMifflin,
            b: last.basalMetabolismMifflin,
            lowerIsBetter: false,
          },
        ].filter((m) => m.a !== null && m.b !== null);

        if (metrics.length > 0 && payload.anthropometry.length >= 2) {
          const boxTop = doc.y;
          const boxH = 56;
          const col = pageW / metrics.length;
          doc.rect(left, boxTop, pageW, boxH).fillColor(COLORS.box).fill();

          metrics.forEach((m, i) => {
            const x = left + i * col;
            const delta = (m.b as number) - (m.a as number);
            const deltaColor =
              Math.abs(delta) < 0.05
                ? COLORS.neutral
                : delta < 0 === m.lowerIsBetter
                  ? COLORS.positive
                  : COLORS.negative;
            doc
              .fontSize(7)
              .fillColor(COLORS.textMuted)
              .font("Helvetica")
              .text(m.label.toUpperCase(), x, boxTop + 7, {
                width: col,
                align: "center",
              });
            doc
              .fontSize(13)
              .fillColor(COLORS.textPrimary)
              .font("Helvetica-Bold")
              .text(fmt(m.b, m.unit, m.decimals), x, boxTop + 18, {
                width: col,
                align: "center",
              });
            const sign = delta > 0 ? "+" : "";
            doc
              .fontSize(7.5)
              .fillColor(deltaColor)
              .font("Helvetica")
              .text(
                `${sign}${m.decimals === 0 ? Math.round(delta) : delta.toFixed(m.decimals)} desde ${fmt(m.a, "", m.decimals)}`,
                x,
                boxTop + 38,
                { width: col, align: "center" },
              );
          });

          doc.y = boxTop + boxH + 12;
        }

        // Tabela de medições (mais recente primeiro) — limitada a 16 linhas.
        const rows = [...payload.anthropometry].reverse().slice(0, 16);
        const cols = [
          { label: "Data", w: 0.24, align: "left" as const },
          { label: "Peso", w: 0.19, align: "right" as const },
          { label: "IMC", w: 0.19, align: "right" as const },
          { label: "%GC", w: 0.19, align: "right" as const },
          { label: "GEB", w: 0.19, align: "right" as const },
        ];

        // Header da tabela
        ensureSpace(doc, 40);
        let ty = doc.y;
        doc.rect(left, ty, pageW, 16).fillColor(COLORS.sectionHeader).fill();
        let cx = left;
        cols.forEach((c) => {
          const w = pageW * c.w;
          doc
            .fontSize(7.5)
            .fillColor(COLORS.textSecondary)
            .font("Helvetica-Bold")
            .text(c.label.toUpperCase(), cx + 4, ty + 4.5, {
              width: w - 8,
              align: c.align,
            });
          cx += w;
        });
        doc.y = ty + 16;

        rows.forEach((r, idx) => {
          ensureSpace(doc, 20);
          ty = doc.y;
          if (idx % 2 === 1) {
            doc.rect(left, ty, pageW, 15).fillColor(COLORS.rowAlt).fill();
          }
          const cells = [
            shortDate(r.measuredAt),
            fmt(r.weightKg, "", 1),
            fmt(r.bodyMassIndex, "", 1),
            fmt(r.bodyFatPctCalc, "", 1),
            r.basalMetabolismMifflin !== null
              ? Math.round(r.basalMetabolismMifflin).toLocaleString("pt-BR")
              : "—",
          ];
          cx = left;
          cols.forEach((c, ci) => {
            const w = pageW * c.w;
            doc
              .fontSize(8)
              .fillColor(ci === 0 ? COLORS.textPrimary : COLORS.textSecondary)
              .font(ci === 0 ? "Helvetica-Bold" : "Helvetica")
              .text(cells[ci]!, cx + 4, ty + 3.5, {
                width: w - 8,
                align: c.align,
              });
            cx += w;
          });
          doc.y = ty + 15;
        });
        if (payload.anthropometry.length > 16) {
          doc
            .fontSize(7)
            .fillColor(COLORS.textMuted)
            .font("Helvetica-Oblique")
            .text(
              `Exibindo as 16 medições mais recentes de ${payload.anthropometry.length}.`,
              left,
              doc.y + 3,
            );
        }
        doc.moveDown(1);
      }

      // ── ENGAJAMENTO (CHECK-INS) ─────────────────────────────────────────
      sectionTitle(doc, "Engajamento e aderência");

      if (!payload.checkins || payload.checkins.totalCheckins === 0) {
        doc
          .fontSize(9)
          .fillColor(COLORS.textMuted)
          .font("Helvetica-Oblique")
          .text(
            payload.checkins
              ? "Paciente com acesso ao app, mas sem check-ins registrados."
              : "Paciente ainda não acessou o app paciente.",
          );
        doc.moveDown(0.6);
      } else {
        const c = payload.checkins;
        const stats: Array<{ label: string; value: string }> = [
          { label: "Check-ins", value: String(c.totalCheckins) },
          { label: "Streak atual", value: `${c.currentStreak}d` },
          { label: "Recorde", value: `${c.longestStreak}d` },
          {
            label: "Aderência (30d)",
            value: c.adherencePct !== null ? `${c.adherencePct}%` : "—",
          },
          {
            label: "Humor (30d)",
            value: c.avgMood !== null ? `${c.avgMood.toFixed(1)}/5` : "—",
          },
          {
            label: "Energia (30d)",
            value: c.avgEnergy !== null ? `${c.avgEnergy.toFixed(1)}/5` : "—",
          },
          {
            label: "Água (30d)",
            value:
              c.avgWaterMl !== null ? `${Math.round(c.avgWaterMl)}ml` : "—",
          },
          {
            label: "Último",
            value: c.lastCheckinDate ? shortDate(c.lastCheckinDate) : "—",
          },
        ];

        ensureSpace(doc, 80);
        const perRow = 4;
        const cellW = pageW / perRow;
        const cellH = 34;
        const rowsN = Math.ceil(stats.length / perRow);
        const gridTop = doc.y;
        for (let i = 0; i < stats.length; i++) {
          const r = Math.floor(i / perRow);
          const cc = i % perRow;
          const x = left + cc * cellW;
          const y = gridTop + r * cellH;
          doc
            .fontSize(7)
            .fillColor(COLORS.textMuted)
            .font("Helvetica")
            .text(stats[i]!.label.toUpperCase(), x + 2, y + 4, {
              width: cellW - 4,
              align: "center",
            });
          doc
            .fontSize(12)
            .fillColor(COLORS.textPrimary)
            .font("Helvetica-Bold")
            .text(stats[i]!.value, x + 2, y + 15, {
              width: cellW - 4,
              align: "center",
            });
        }
        doc.y = gridTop + rowsN * cellH + 6;
        doc.moveDown(0.4);
      }

      // ── PLANOS ALIMENTARES ──────────────────────────────────────────────
      sectionTitle(doc, "Histórico de planos alimentares");

      if (payload.mealPlans.length === 0) {
        doc
          .fontSize(9)
          .fillColor(COLORS.textMuted)
          .font("Helvetica-Oblique")
          .text("Nenhum plano alimentar registrado.");
        doc.moveDown(0.6);
      } else {
        for (const p of payload.mealPlans) {
          ensureSpace(doc, 24);
          const py = doc.y;
          doc
            .fontSize(9)
            .fillColor(COLORS.textPrimary)
            .font("Helvetica-Bold")
            .text(`• ${p.name}`, left + 2, py, {
              width: pageW * 0.62,
              continued: false,
            });
          const periodStr = p.startDate
            ? `${shortDate(p.startDate)}${p.endDate ? ` – ${shortDate(p.endDate)}` : ""}`
            : `criado ${shortDate(p.createdAt)}`;
          doc
            .fontSize(8)
            .fillColor(COLORS.textMuted)
            .font("Helvetica")
            .text(
              `${STATUS_LABEL[p.status] ?? p.status} · ${periodStr}`,
              left + pageW * 0.62,
              py,
              { width: pageW * 0.38, align: "right" },
            );
          doc.y = Math.max(doc.y, py + 14);
        }
        doc.moveDown(0.6);
      }

      // ── ASSINATURA ──────────────────────────────────────────────────────
      ensureSpace(doc, 90);
      doc.moveDown(1.2);
      const sigY = doc.y;
      doc
        .strokeColor(COLORS.textPrimary)
        .lineWidth(0.5)
        .moveTo(left + pageW * 0.2, sigY)
        .lineTo(left + pageW * 0.8, sigY)
        .stroke();
      doc.moveDown(0.3);
      doc
        .fontSize(9)
        .fillColor(COLORS.textPrimary)
        .font("Helvetica-Bold")
        .text(payload.issuerName, { align: "center" });
      if (payload.issuerCrn) {
        doc
          .fontSize(8)
          .fillColor(COLORS.textSecondary)
          .font("Helvetica")
          .text(`CRN-${payload.issuerCrnUf ?? "—"}: ${payload.issuerCrn}`, {
            align: "center",
          });
      }
      doc.moveDown(0.4);
      doc
        .fontSize(8)
        .fillColor(COLORS.textMuted)
        .text(`Emitido em ${formatDate(payload.generatedAt)}`, {
          align: "center",
        });

      // ── RODAPÉ ──────────────────────────────────────────────────────────
      doc
        .fontSize(6.5)
        .fillColor(COLORS.textMuted)
        .font("Helvetica")
        .text(
          "Gerado por NutriCore · plataforma de gestão clínica para nutricionistas · nutricore.app",
          left,
          doc.page.height - 35,
          { align: "center", width: pageW },
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
