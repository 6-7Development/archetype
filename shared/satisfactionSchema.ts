import { pgTable, varchar, integer, text, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const satisfactionSurveys = pgTable('satisfaction_surveys', {
  id: varchar('id').primaryKey().$defaultFn(() => crypto.randomUUID()),
  userId: varchar('user_id'),
  rating: integer('rating').notNull(),
  category: varchar('category', { length: 50 }).notNull(),
  feedback: text('feedback'),
  wouldRecommend: boolean('would_recommend'),
  featureRequests: text('feature_requests'),
  browserInfo: text('browser_info'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => ({
  userIdIdx: index('satisfaction_user_id_idx').on(table.userId),
  categoryIdx: index('satisfaction_category_idx').on(table.category),
  createdAtIdx: index('satisfaction_created_at_idx').on(table.createdAt),
}));

export const insertSatisfactionSurveySchema = createInsertSchema(satisfactionSurveys, {
  rating: z.number().min(1).max(5),
  category: z.enum(['ai_quality', 'platform_ux', 'performance', 'support', 'overall']),
  feedback: z.string().min(10).max(1000).optional(),
  wouldRecommend: z.boolean().optional(),
}).omit({
  id: true,
  createdAt: true,
});

export type InsertSatisfactionSurvey = z.infer<typeof insertSatisfactionSurveySchema>;
export type SatisfactionSurvey = typeof satisfactionSurveys.$inferSelect;
