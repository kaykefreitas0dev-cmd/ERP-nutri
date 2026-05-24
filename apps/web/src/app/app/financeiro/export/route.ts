import { NextRequest, NextResponse } from "next/server";
import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

const METHOD_LABEL: Record<string, string> = {
  PIX: "PIX",
  CARD_EXTERNAL: "Cartão",
  CASH: "Dinheiro",
  BANK_TRANSFER: "Transferência",
  OTHER: "Outro",
};

const STATUS_LABEL: Record<string, string> = {
  EXTERNAL_RECORDED: "Registrado (externo)",
  PENDING: "Pendente",
  PAID: "Pago",
  REFUNDED: "Estornado",
  CANCELLED: "Cancelado",
};

function escapeCSV(v: string | null | undefined): string {
  if (v == null || v === "") return "";
  // Wrap in quotes if contains comma, newline or quote; escape inner quotes
  const s = String(v);
  if (s.includes(",") || s.includes("\n") || s.includes('"')) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function row(cells: (string | null | undefined)[]): string {
  return cells.map(escapeCSV).join(",");
}

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const sp = req.nextUrl.searchParams;
  const from = sp.get("from");
  const to = sp.get("to");
  const method = sp.get("method");
  const q = sp.get("q");

  const today = new Date();
  const defaultFrom = new Date(today.getFullYear(), today.getMonth(), 1);
  const defaultTo = new Date(today.getFullYear(), today.getMonth() + 1, 0);

  const fromDate = from ? new Date(from + "T00:00:00Z") : defaultFrom;
  const toDate = to
    ? new Date(to + "T23:59:59Z")
    : new Date(defaultTo.setHours(23, 59, 59, 999));

  try {
    const payments = await withTenantAction(async ({ tx }) => {
      const where: Record<string, unknown> = {
        paymentDate: { gte: fromDate, lte: toDate },
      };
      if (method && METHOD_LABEL[method]) {
        where.externalPaymentMethod = method;
      }
      if (q) {
        where.patient = { fullName: { contains: q, mode: "insensitive" } };
      }

      return tx.patientPayment.findMany({
        where,
        orderBy: { paymentDate: "desc" },
        take: 5000,
        select: {
          paymentDate: true,
          amountCents: true,
          status: true,
          externalPaymentMethod: true,
          externalReference: true,
          description: true,
          patient: { select: { fullName: true, email: true, cpf: true } },
          appointment: { select: { startsAt: true } },
        },
      });
    });

    const lines: string[] = [
      // Header
      row([
        "Data",
        "Paciente",
        "CPF",
        "Email",
        "Consulta",
        "Valor (R$)",
        "Status",
        "Método",
        "Referência externa",
        "Descrição",
      ]),
    ];

    for (const p of payments as Array<{
      paymentDate: Date;
      amountCents: number;
      status: string;
      externalPaymentMethod: string | null;
      externalReference: string | null;
      description: string | null;
      patient: { fullName: string; email: string | null; cpf: string | null };
      appointment: { startsAt: Date } | null;
    }>) {
      const valor = (p.amountCents / 100).toFixed(2).replace(".", ",");

      lines.push(
        row([
          new Date(p.paymentDate).toLocaleDateString("pt-BR"),
          p.patient.fullName,
          p.patient.cpf,
          p.patient.email,
          p.appointment
            ? new Date(p.appointment.startsAt).toLocaleDateString("pt-BR")
            : null,
          valor,
          STATUS_LABEL[p.status] ?? p.status,
          p.externalPaymentMethod
            ? (METHOD_LABEL[p.externalPaymentMethod] ?? p.externalPaymentMethod)
            : null,
          p.externalReference,
          p.description,
        ]),
      );
    }

    const csv = "﻿" + lines.join("\r\n"); // BOM for Excel PT-BR
    const filename = `pagamentos_${fromDate.toISOString().slice(0, 10)}_${toDate.toISOString().slice(0, 10)}.csv`;

    return new NextResponse(csv, {
      status: 200,
      headers: {
        "Content-Type": "text/csv; charset=utf-8",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    if (err instanceof ActionTenantError && err.code === "NO_ORG") {
      return NextResponse.json({ error: "Sem organização" }, { status: 401 });
    }
    console.error("[financeiro/export]", err);
    return NextResponse.json({ error: "Erro ao exportar" }, { status: 500 });
  }
}
