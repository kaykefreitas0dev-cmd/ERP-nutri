"use server";

// Notificações in-app do PACIENTE (sino no topbar do PWA).
// Cross-org (Lock 6): o paciente é User global; vê notificações de todas as
// orgs em que é paciente. Escopado SEMPRE pelo user.id autenticado.

import { prisma } from "@nutricore/db";
import { createSupabaseServerClient } from "@/lib/supabase/server";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface PatientNotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkPath: string | null;
  read: boolean;
  createdAt: Date;
}

export interface PatientNotificationsResult {
  items: PatientNotificationItem[];
  unreadCount: number;
}

async function getUserId(): Promise<string | null> {
  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

interface Row {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkPath: string | null;
  readAt: Date | null;
  createdAt: Date;
}

export async function listPatientNotificationsAction(
  limit = 20,
): Promise<PatientNotificationsResult> {
  const take = Math.min(Math.max(limit, 1), 50);
  try {
    const userId = await getUserId();
    if (!userId) return { items: [], unreadCount: 0 };

    const rows = await prisma.inAppNotification.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take,
      select: {
        id: true,
        type: true,
        title: true,
        body: true,
        linkPath: true,
        readAt: true,
        createdAt: true,
      },
    });
    const unreadCount = await prisma.inAppNotification.count({
      where: { userId, readAt: null },
    });
    return {
      items: rows.map((r: Row) => ({
        id: r.id,
        type: r.type,
        title: r.title,
        body: r.body,
        linkPath: r.linkPath,
        read: r.readAt !== null,
        createdAt: r.createdAt,
      })),
      unreadCount,
    };
  } catch {
    return { items: [], unreadCount: 0 };
  }
}

export async function getPatientUnreadCountAction(): Promise<number> {
  try {
    const userId = await getUserId();
    if (!userId) return 0;
    return await prisma.inAppNotification.count({
      where: { userId, readAt: null },
    });
  } catch {
    return 0;
  }
}

export async function markPatientNotificationReadAction(
  id: string,
): Promise<{ ok: boolean }> {
  if (!id || !UUID_REGEX.test(id)) return { ok: false };
  try {
    const userId = await getUserId();
    if (!userId) return { ok: false };
    await prisma.inAppNotification.updateMany({
      where: { id, userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}

export async function markAllPatientNotificationsReadAction(): Promise<{
  ok: boolean;
}> {
  try {
    const userId = await getUserId();
    if (!userId) return { ok: false };
    await prisma.inAppNotification.updateMany({
      where: { userId, readAt: null },
      data: { readAt: new Date() },
    });
    return { ok: true };
  } catch {
    return { ok: false };
  }
}
