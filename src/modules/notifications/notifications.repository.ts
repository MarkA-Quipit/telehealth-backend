import { eq, and, count, desc } from "drizzle-orm";
import { db } from "../../config/db";
import { notifications } from "./notifications.schema";
import type { CreateNotificationData, Notification } from "./notifications.schema";

export const notificationsRepository = {
  // ── create ────────────────────────────────────────────────────────────────
  async create(data: CreateNotificationData): Promise<Notification> {
    const inserted = await db
      .insert(notifications)
      .values({
        userId: data.userId,
        type: data.type,
        title: data.title,
        message: data.message,
        data: data.data ?? null,
        isRead: false,
      })
      .returning();

    return inserted[0];
  },

  // ── findByUser ────────────────────────────────────────────────────────────
  async findByUser(
    userId: string,
    type?: string,
    page = 1,
    limit = 20,
  ): Promise<{ items: Notification[]; total: number }> {
    const offset = (page - 1) * limit;
    const conditions = type
      ? and(eq(notifications.userId, userId), eq(notifications.type, type as Notification["type"]))
      : eq(notifications.userId, userId);

    const [items, countResult] = await Promise.all([
      db
        .select()
        .from(notifications)
        .where(conditions)
        .orderBy(desc(notifications.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ total: count() }).from(notifications).where(conditions),
    ]);

    return { items, total: Number(countResult[0]?.total ?? 0) };
  },

  // ── countUnread ───────────────────────────────────────────────────────────
  async countUnread(userId: string): Promise<number> {
    const rows = await db
      .select({ total: count() })
      .from(notifications)
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
        ),
      );
    return Number(rows[0]?.total ?? 0);
  },

  // ── markRead — ownership enforced in query ────────────────────────────────
  async markRead(notificationId: string, userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.id, notificationId),
          eq(notifications.userId, userId),
        ),
      );
  },

  // ── markAllRead ───────────────────────────────────────────────────────────
  async markAllRead(userId: string): Promise<void> {
    await db
      .update(notifications)
      .set({ isRead: true })
      .where(
        and(
          eq(notifications.userId, userId),
          eq(notifications.isRead, false),
        ),
      );
  },

  // ── deleteById ────────────────────────────────────────────────────────────
  async deleteById(id: string): Promise<void> {
    await db.delete(notifications).where(eq(notifications.id, id));
  },

  // ── findById ──────────────────────────────────────────────────────────────
  async findById(id: string): Promise<Notification | null> {
    const rows = await db
      .select()
      .from(notifications)
      .where(eq(notifications.id, id))
      .limit(1);
    return rows[0] ?? null;
  },
};
