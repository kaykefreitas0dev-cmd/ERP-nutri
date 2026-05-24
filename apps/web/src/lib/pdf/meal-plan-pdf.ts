/**
 * Gerador de PDF para MealPlan via pdfkit (S11 / S22)
 *
 * Layout por página A4:
 *   - Cabeçalho: branding + nome+CRN do profissional
 *   - Identificação: nome do paciente + CPF parcial
 *   - Resumo nutricional: kcal total, PTN/CHO/LIP
 *   - Dias → Refeições → Itens (quantidade, macros por item)
 *   - Rodapé: data + linha de assinatura
 *
 * Retorna Buffer pronto para stream.
 */

import PDFDocument from "pdfkit";

// Cores consistentes com design tokens do sistema
const COLORS = {
  brand: "#0f766e",
  textPrimary: "#0f172a",
  textSecondary: "#475569",
  textMuted: "#94a3b8",
  border: "#e2e8f0",
  protein: "#8b5cf6",
  carb: "#f97316",
  fat: "#eab308",
  kcal: "#0f766e",
  dayHeader: "#f1f5f9",
  mealHeader: "#f8fafc",
};

export type MealPlanPdfPayload = {
  planName: string;
  issuerName: string;
  issuerCrn: string | null;
  issuerCrnUf: string | null;
  patientName: string;
  patientCpf: string | null;
  generatedAt: Date;
  days: Array<{
    dayLabel: string;
    meals: Array<{
      name: string;
      scheduledTime: string | null;
      items: Array<{
        foodName: string;
        quantityG: number;
        kcal: number | null;
        proteinG: number | null;
        carbG: number | null;
        fatG: number | null;
        preparationNotes: string | null;
      }>;
    }>;
  }>;
};

function maskCpf(cpf: string | null): string {
  if (!cpf) return "—";
  const digits = cpf.replace(/\D/g, "");
  if (digits.length !== 11) return cpf;
  return `${digits.slice(0, 3)}.***.***.${digits.slice(9)}`;
}

function formatDate(d: Date): string {
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function sumMeal(items: MealPlanPdfPayload["days"][0]["meals"][0]["items"]) {
  return items.reduce(
    (acc, item) => ({
      kcal: acc.kcal + (item.kcal ?? 0),
      proteinG: acc.proteinG + (item.proteinG ?? 0),
      carbG: acc.carbG + (item.carbG ?? 0),
      fatG: acc.fatG + (item.fatG ?? 0),
    }),
    { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 },
  );
}

function sumPlan(payload: MealPlanPdfPayload) {
  return payload.days
    .flatMap((d) => d.meals)
    .flatMap((m) => m.items)
    .reduce(
      (acc, item) => ({
        kcal: acc.kcal + (item.kcal ?? 0),
        proteinG: acc.proteinG + (item.proteinG ?? 0),
        carbG: acc.carbG + (item.carbG ?? 0),
        fatG: acc.fatG + (item.fatG ?? 0),
      }),
      { kcal: 0, proteinG: 0, carbG: 0, fatG: 0 },
    );
}

function drawLine(
  doc: InstanceType<typeof PDFDocument>,
  color = COLORS.border,
  width = 0.5,
) {
  const left = doc.page.margins.left;
  const right = doc.page.width - doc.page.margins.right;
  doc
    .strokeColor(color)
    .lineWidth(width)
    .moveTo(left, doc.y)
    .lineTo(right, doc.y)
    .stroke();
}

export async function renderMealPlanPdf(
  payload: MealPlanPdfPayload,
): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: "A4",
        margins: { top: 50, bottom: 50, left: 50, right: 50 },
        info: {
          Title: `Plano alimentar — ${payload.patientName}`,
          Author: payload.issuerName,
          Subject: "Plano alimentar NutriCore",
          Creator: "NutriCore",
        },
        autoFirstPage: true,
      });

      const chunks: Buffer[] = [];
      doc.on("data", (c: Buffer) => chunks.push(c));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", reject);

      const pageW =
        doc.page.width - doc.page.margins.left - doc.page.margins.right;
      const left = doc.page.margins.left;
      const right = doc.page.width - doc.page.margins.right;

      // ── CABEÇALHO ────────────────────────────────────────────────────
      doc
        .fontSize(16)
        .fillColor(COLORS.brand)
        .font("Helvetica-Bold")
        .text("NutriCore", { continued: false });
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

      // ── TÍTULO ───────────────────────────────────────────────────────
      doc
        .fontSize(15)
        .fillColor(COLORS.textPrimary)
        .font("Helvetica-Bold")
        .text("Plano Alimentar", { align: "center" });
      doc.moveDown(0.2);
      doc
        .fontSize(11)
        .fillColor(COLORS.textSecondary)
        .font("Helvetica")
        .text(payload.planName, { align: "center" });
      doc.moveDown(0.7);

      // ── PACIENTE ─────────────────────────────────────────────────────
      doc
        .fontSize(10)
        .fillColor(COLORS.textPrimary)
        .font("Helvetica-Bold")
        .text("Paciente: ", { continued: true });
      doc.font("Helvetica").text(payload.patientName, { continued: false });
      doc.font("Helvetica-Bold").text("CPF: ", { continued: true });
      doc.font("Helvetica").text(maskCpf(payload.patientCpf));
      doc.moveDown(0.8);

      // ── RESUMO NUTRICIONAL ────────────────────────────────────────────
      const totals = sumPlan(payload);
      const nDays = payload.days.length || 1;
      const avgKcal = totals.kcal / nDays;
      const avgPtn = totals.proteinG / nDays;
      const avgCho = totals.carbG / nDays;
      const avgLip = totals.fatG / nDays;

      // caixa de resumo com fundo
      const boxTop = doc.y;
      const boxH = 50;
      doc.rect(left, boxTop, pageW, boxH).fillColor("#f0fdf4").fill();
      doc.fillColor(COLORS.textPrimary);

      // label + valores em colunas
      const col = pageW / 4;
      const summaryItems = [
        {
          label: "Média/dia",
          value: `${avgKcal.toFixed(0)} kcal`,
          color: COLORS.kcal,
        },
        {
          label: "Proteína",
          value: `${avgPtn.toFixed(0)} g`,
          color: COLORS.protein,
        },
        {
          label: "Carboidrato",
          value: `${avgCho.toFixed(0)} g`,
          color: COLORS.carb,
        },
        {
          label: "Lipídeo",
          value: `${avgLip.toFixed(0)} g`,
          color: COLORS.fat,
        },
      ];

      summaryItems.forEach((item, i) => {
        const x = left + i * col;
        doc
          .fontSize(7)
          .fillColor(COLORS.textMuted)
          .font("Helvetica")
          .text(item.label.toUpperCase(), x, boxTop + 8, {
            width: col,
            align: "center",
          });
        doc
          .fontSize(13)
          .fillColor(item.color)
          .font("Helvetica-Bold")
          .text(item.value, x, boxTop + 20, { width: col, align: "center" });
      });

      doc.y = boxTop + boxH + 10;
      doc.moveDown(0.5);

      // ── DIAS ─────────────────────────────────────────────────────────
      for (const [dayIdx, day] of payload.days.entries()) {
        // Garantir espaço para o cabeçalho do dia (pelo menos 80pt)
        const spaceNeeded = 80;
        if (doc.y > doc.page.height - doc.page.margins.bottom - spaceNeeded) {
          doc.addPage();
        }

        // ── Cabeçalho do dia
        const dayTop = doc.y;
        doc.rect(left, dayTop, pageW, 20).fillColor(COLORS.dayHeader).fill();
        doc
          .fontSize(10)
          .fillColor(COLORS.textPrimary)
          .font("Helvetica-Bold")
          .text(
            `Dia ${dayIdx + 1}${day.dayLabel ? ` — ${day.dayLabel}` : ""}`,
            left + 6,
            dayTop + 5,
            { width: pageW - 12 },
          );
        doc.y = dayTop + 24;
        doc.moveDown(0.3);

        for (const meal of day.meals) {
          // Garantir espaço para o cabeçalho da refeição (60pt mínimo)
          if (doc.y > doc.page.height - doc.page.margins.bottom - 60) {
            doc.addPage();
          }

          // ── Nome da refeição
          const mealTop = doc.y;
          doc
            .rect(left, mealTop, pageW, 16)
            .fillColor(COLORS.mealHeader)
            .fill();
          const mealLabel = meal.scheduledTime
            ? `${meal.name} (${meal.scheduledTime})`
            : meal.name;
          const mealTotals = sumMeal(meal.items);
          doc
            .fontSize(9)
            .fillColor(COLORS.textSecondary)
            .font("Helvetica-Bold")
            .text(mealLabel, left + 6, mealTop + 3, {
              continued: true,
              width: pageW - 120,
            });
          doc
            .font("Helvetica")
            .fontSize(8)
            .fillColor(COLORS.textMuted)
            .text(
              `${mealTotals.kcal.toFixed(0)} kcal · PTN ${mealTotals.proteinG.toFixed(0)}g · CHO ${mealTotals.carbG.toFixed(0)}g · LIP ${mealTotals.fatG.toFixed(0)}g`,
              {
                align: "right",
                width: 110,
              },
            );
          doc.y = mealTop + 18;

          // ── Itens da refeição
          for (const item of meal.items) {
            if (doc.y > doc.page.height - doc.page.margins.bottom - 30) {
              doc.addPage();
            }
            const itemTop = doc.y;
            // Nome do alimento + quantidade
            doc
              .fontSize(8.5)
              .fillColor(COLORS.textPrimary)
              .font("Helvetica")
              .text(`  • ${item.foodName}`, left, itemTop, {
                continued: true,
                width: pageW - 200,
              });
            doc
              .fillColor(COLORS.textMuted)
              .font("Helvetica")
              .text(`${item.quantityG.toFixed(0)} g`, {
                continued: true,
                width: 40,
                align: "right",
              });

            // Macros compactos no mesmo nível
            const macroStr = [
              item.kcal != null ? `${item.kcal.toFixed(0)} kcal` : "",
              item.proteinG != null ? `P ${item.proteinG.toFixed(1)}g` : "",
              item.carbG != null ? `C ${item.carbG.toFixed(1)}g` : "",
              item.fatG != null ? `L ${item.fatG.toFixed(1)}g` : "",
            ]
              .filter(Boolean)
              .join(" · ");

            doc
              .fontSize(7.5)
              .fillColor(COLORS.textMuted)
              .text(macroStr, { width: 155, align: "right" });

            // Notas de preparo (se houver) — linha abaixo, itálico
            if (item.preparationNotes) {
              doc
                .fontSize(7.5)
                .fillColor(COLORS.textMuted)
                .font("Helvetica-Oblique")
                .text(`    ${item.preparationNotes}`, left, doc.y + 1, {
                  width: pageW,
                });
            }
            doc.moveDown(0.2);
          }
          doc.moveDown(0.4);
        }
        doc.moveDown(0.3);
      }

      // ── ASSINATURA ───────────────────────────────────────────────────
      // Garantir que cabe na página atual
      if (doc.y > doc.page.height - doc.page.margins.bottom - 80) {
        doc.addPage();
      }
      doc.moveDown(1.5);
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

      // ── RODAPÉ ───────────────────────────────────────────────────────
      const pageHeight = doc.page.height;
      doc
        .fontSize(6.5)
        .fillColor(COLORS.textMuted)
        .font("Helvetica")
        .text(
          "Gerado por NutriCore · plataforma de gestão clínica para nutricionistas · nutricore.app",
          left,
          pageHeight - 35,
          { align: "center", width: pageW },
        );

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}
