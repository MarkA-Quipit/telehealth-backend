import {
  pgTable,
  uuid,
  varchar,
  text,
  boolean,
  timestamp,
  jsonb,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";
import { z } from "zod/v4";
import { users } from "../users/users.schema";

// ---------------------------------------------------------------------------
// notifications
// ---------------------------------------------------------------------------
export const notifications = pgTable("notifications", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),

  type: varchar("type", { length: 50 }).notNull(),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  data: jsonb("data"),
  isRead: boolean("is_read").notNull().default(false),

  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
export type NotificationType =
  | "appointment_booked"
  | "appointment_confirmed"
  | "appointment_cancelled"
  | "appointment_completed";

export type Notification = typeof notifications.$inferSelect;

// ---------------------------------------------------------------------------
// Zod validator (internal use only — no POST endpoint)
// ---------------------------------------------------------------------------
export const createNotificationInput = z.object({
  userId: z.uuid(),
  type: z.enum([
    "appointment_booked",
    "appointment_confirmed",
    "appointment_cancelled",
    "appointment_completed",
  ]),
  title: z.string().max(200),
  message: z.string(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type CreateNotificationData = z.infer<typeof createNotificationInput>;
