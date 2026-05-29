import { pgTable, uuid, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { z } from "zod/v4";
import { users } from "../users/users.schema";

// ---------------------------------------------------------------------------
// Table
// ---------------------------------------------------------------------------
export const aiRecommendationLogs = pgTable("ai_recommendation_logs", {
  id: uuid("id").primaryKey().defaultRandom(),
  userId: uuid("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  symptoms: text("symptoms").notNull(),
  recommendations: jsonb("recommendations").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type AiRecommendationLog = typeof aiRecommendationLogs.$inferSelect;

// ---------------------------------------------------------------------------
// Zod validators
// ---------------------------------------------------------------------------
export const recommendDoctorSchema = z.object({
  symptoms: z.string().min(10).max(1000),
});

export type RecommendDoctorInput = z.infer<typeof recommendDoctorSchema>;
