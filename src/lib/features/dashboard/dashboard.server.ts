import { and, desc, eq, gte, inArray, isNotNull, lt } from 'drizzle-orm';

import { currentWeek } from '$lib/features/analytics/analytics';
import type { Database } from '$lib/server/db';
import { attempts } from '$lib/server/db/schema';
import { calculateStreakDays, summarizeWeeklyActivity } from './dashboard';

async function loadCompletionDates(db: Database, userId: number): Promise<Date[]> {
	const rows = await db
		.select({ submittedAt: attempts.submittedAt })
		.from(attempts)
		.where(
			and(
				eq(attempts.userId, userId),
				inArray(attempts.status, ['SUBMITTED', 'EXPIRED']),
				isNotNull(attempts.submittedAt)
			)
		)
		.orderBy(desc(attempts.submittedAt));

	return rows.flatMap((row) => (row.submittedAt ? [row.submittedAt] : []));
}

export async function loadDashboardStreak(db: Database, userId: number, now: Date) {
	return calculateStreakDays(await loadCompletionDates(db, userId), now);
}

export async function loadWeeklyActivity(db: Database, userId: number, now: Date) {
	const period = currentWeek(now, 'UTC');
	const rows = await db
		.select({
			submittedAt: attempts.submittedAt,
			correctCount: attempts.correctCount,
			questionCount: attempts.questionCount,
			rawScore: attempts.rawScore,
			rawMax: attempts.rawMax
		})
		.from(attempts)
		.where(
			and(
				eq(attempts.userId, userId),
				inArray(attempts.status, ['SUBMITTED', 'EXPIRED']),
				isNotNull(attempts.submittedAt),
				gte(attempts.submittedAt, period.start),
				lt(attempts.submittedAt, period.end)
			)
		);

	return summarizeWeeklyActivity(
		rows.flatMap((row) => (row.submittedAt ? [{ ...row, submittedAt: row.submittedAt }] : [])),
		period.start,
		now
	);
}
