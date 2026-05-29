import { eq, and, count } from "drizzle-orm";
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
  async findByUser(userId: string, limit = 50): Promise<Notification[]> {
    return db
      .select()
      .from(notifications)
      .where(eq(notifications.userId, userId))
      .orderBy(notifications.createdAt)
      .limit(limit);
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
