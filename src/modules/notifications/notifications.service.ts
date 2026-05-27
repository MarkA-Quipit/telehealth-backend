import { pusher } from "../../config/pusher";
import { notificationsRepository } from "./notifications.repository";
import type { NotificationType, Notification } from "./notifications.schema";

export const notificationsService = {
  // ── createAndPush — persist + fire Pusher event (fire-and-forget for caller)
  async createAndPush(
    userId: string,
    type: NotificationType,
    title: string,
    message: string,
    data?: Record<string, unknown>,
  ): Promise<void> {
    // 1. Persist notification record
    const notification = await notificationsRepository.create({
      userId,
      type,
      title,
      message,
      data,
    });

    // 2. Trigger Pusher event on public channel user-{userId}
    //    Fire-and-forget: don't await — don't block the caller
    pusher
      .trigger(`user-${userId}`, type, {
        id: notification.id,
        type: notification.type,
        title: notification.title,
        message: notification.message,
        data: notification.data,
        createdAt: notification.createdAt,
      })
      .catch((err: unknown) => {
        console.error("[Pusher] trigger failed:", err);
      });
  },

  // ── getNotifications ──────────────────────────────────────────────────────
  async getNotifications(
    userId: string,
  ): Promise<{ notifications: Notification[]; unreadCount: number }> {
    const [notificationsList, unreadCount] = await Promise.all([
      notificationsRepository.findByUser(userId),
      notificationsRepository.countUnread(userId),
    ]);
    return { notifications: notificationsList, unreadCount };
  },

  // ── markRead ──────────────────────────────────────────────────────────────
  async markRead(userId: string, notificationId: string): Promise<void> {
    await notificationsRepository.markRead(notificationId, userId);
  },

  // ── markAllRead ───────────────────────────────────────────────────────────
  async markAllRead(userId: string): Promise<void> {
    await notificationsRepository.markAllRead(userId);
  },
};
