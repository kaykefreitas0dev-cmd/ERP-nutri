"use server";

// Notificações in-app (sino do topbar).
// Tenant + user scoped: as Server Actions filtram SEMPRE por userId +
// organizationId explicitamente (defense-in-depth além do RLS).

import { withTenantAction, ActionTenantError } from "@/lib/with-tenant-action";

const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkPath: string | null;
  read: boolean;
  createdAt: Date;
}

export interface NotificationsResult {
  items: NotificationItem[];
  unreadCount: number;
}

interface NotificationRow {
  id: string;
  type: string;
  title: string;
  body: string | null;
  linkPath: string | null;
  readAt: Date | null;
  createdAt: Date;
}

/**
 * Lista as notificações recentes do usuário atual (própria org) + a
 * contagem de não-lidas. Falha silenciosa → estado vazio (o sino nunca
 * deve derrubar o layout autenticado).
 */
export async function listNotificationsAction(
  limit = 20,
): Promise<NotificationsResult> {
  const take = Math.min(Math.max(limit, 1), 50);
  try {
    return await withTenantAction(async ({ tx, organizationId, userId }) => {
      const rows = await tx.inAppNotification.findMany({
        where: { userId, organizationId },
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
      const unreadCount = await tx.inAppNotification.count({
        where: { userId, organizationId, readAt: null },
      });
      return {
        items: rows.map((r: NotificationRow) => ({
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
    });
  } catch {
    return { items: [], unreadCount: 0 };
  }
}

/**
 * Apenas a contagem de não-lidas — usado pelo polling leve do sino.
 */
export async function getUnreadCountAction(): Promise<number> {
  try {
    return await withTenantAction(async ({ tx, organizationId, userId }) => {
      return tx.inAppNotification.count({
        where: { userId, organizationId, readAt: null },
      });
    });
  } catch {
    return 0;
  }
}

/**
 * Marca uma notificação como lida (apenas se for do próprio usuário).
 */
export async function markNotificationReadAction(
  id: string,
): Promise<{ ok: boolean }> {
  if (!id || !UUID_REGEX.test(id)) return { ok: false };
  try {
    await withTenantAction(async ({ tx, organizationId, userId }) => {
      // updateMany com filtro de ownership: nunca marca de outro usuário.
      await tx.inAppNotification.updateMany({
        where: { id, userId, organizationId, readAt: null },
        data: { readAt: new Date() },
      });
    });
    return { ok: true };
  } catch (err) {
    if (err instanceof ActionTenantError) return { ok: false };
    return { ok: false };
  }
}

/**
 * Marca todas as não-lidas do usuário como lidas.
 */
export async function markAllNotificationsReadAction(): Promise<{
  ok: boolean;
  count: number;
}> {
  try {
    const count = await withTenantAction(
      async ({ tx, organizationId, userId }) => {
        const result = await tx.inAppNotification.updateMany({
          where: { userId, organizationId, readAt: null },
          data: { readAt: new Date() },
        });
        return result.count as number;
      },
    );
    return { ok: true, count };
  } catch {
    return { ok: false, count: 0 };
  }
}
