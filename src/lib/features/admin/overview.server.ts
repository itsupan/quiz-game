import { count, eq, gte, sql } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import { attempts, questions, quizzes, users } from '$lib/server/db/schema';

export type Overview = {
	quizzes: { total: number; published: number; draft: number };
	questions: { total: number; published: number; draft: number };
	users: { total: number; admins: number; suspended: number };
	attempts: { total: number; submitted: number; lastSevenDays: number };
};

/** Counts rows matching a condition in the same query as the total. */
const tally = (condition: ReturnType<typeof eq>) =>
	sql<number>`sum(case when ${condition} then 1 else 0 end)`.mapWith(Number);

/**
 * The dashboard's headline numbers.
 *
 * One aggregate query per table rather than one per number: a `count(*)` and its
 * breakdowns come from the same scan, so the whole overview is four round trips to D1
 * instead of eleven.
 */
export async function getOverview(db: Database): Promise<Overview> {
	const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

	const [quizTotals] = await db
		.select({
			total: count(),
			published: tally(eq(quizzes.status, 'PUBLISHED')),
			draft: tally(eq(quizzes.status, 'DRAFT'))
		})
		.from(quizzes);

	const [questionTotals] = await db
		.select({
			total: count(),
			published: tally(eq(questions.status, 'PUBLISHED')),
			draft: tally(eq(questions.status, 'DRAFT'))
		})
		.from(questions);

	const [userTotals] = await db
		.select({
			total: count(),
			admins: tally(eq(users.role, 'ADMIN')),
			suspended: tally(eq(users.status, 'SUSPENDED'))
		})
		.from(users);

	const [attemptTotals] = await db
		.select({
			total: count(),
			submitted: tally(eq(attempts.status, 'SUBMITTED')),
			lastSevenDays: tally(gte(attempts.startedAt, sevenDaysAgo))
		})
		.from(attempts);

	return {
		quizzes: quizTotals,
		questions: questionTotals,
		users: userTotals,
		attempts: attemptTotals
	};
}
