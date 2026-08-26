import { sql } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

/**
 * Placeholder schema — replace with the real quiz tables.
 *
 * Workflow after editing this file:
 *   pnpm db:generate        # drizzle-kit writes a new migrations/NNNN_*.sql
 *   pnpm db:migrate:local   # apply it to the local D1 in .wrangler/state
 */
export const quizzes = sqliteTable('quizzes', {
	id: integer('id').primaryKey({ autoIncrement: true }),
	title: text('title').notNull(),
	createdAt: integer('created_at', { mode: 'timestamp' })
		.notNull()
		.default(sql`(unixepoch())`)
});

export type Quiz = typeof quizzes.$inferSelect;
export type NewQuiz = typeof quizzes.$inferInsert;
