import { and, asc, desc, eq, gt, inArray, isNotNull, lt, or, sql } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import { attempts, users } from '$lib/server/db/schema';
import { encodeLeaderboardCursor, type LeaderboardCursor } from './api.server';
import { computeLevel, computeStreak, type LeaderboardEntry } from './leaderboard';

export type LeaderboardFilters = {
	cursor?: LeaderboardCursor;
	limit: number;
};

async function loadStreaks(
	db: Database,
	userIds: number[],
	now: Date
): Promise<Map<number, number>> {
	if (userIds.length === 0) return new Map();

	const rows = await db
		.select({ userId: attempts.userId, submittedAt: attempts.submittedAt })
		.from(attempts)
		.where(and(eq(attempts.status, 'SUBMITTED'), inArray(attempts.userId, userIds)));
	const byUser = new Map<number, Date[]>();

	for (const row of rows) {
		if (row.submittedAt === null || row.userId === null) continue;
		const dates = byUser.get(row.userId) ?? [];
		dates.push(row.submittedAt);
		byUser.set(row.userId, dates);
	}

	return new Map([...byUser].map(([userId, dates]) => [userId, computeStreak(dates, now)]));
}

/**
 * Global, all-time ranking by lifetime XP across submitted attempts. Ranked over the
 * whole learner base rather than one quiz, unlike `attempts_leaderboard_idx`.
 *
 * Keyset-paginated on (totalXp desc, publicId asc): the cursor carries the previous
 * page's last rank forward, so absolute rank never needs a COUNT/window-function query.
 */
export async function listLeaderboard(db: Database, filters: LeaderboardFilters, now: Date) {
	const totalXpExpr = sql<number>`sum(${attempts.xpAwarded})`;
	const cursor = filters.cursor;
	const cursorCondition = cursor
		? or(
				lt(totalXpExpr, cursor.totalXp),
				and(eq(totalXpExpr, cursor.totalXp), gt(users.publicId, cursor.userId))
			)
		: undefined;
	const rawRows = await db
		.select({
			userId: attempts.userId,
			publicId: users.publicId,
			displayName: users.displayName,
			avatarUrl: users.avatarUrl,
			totalXp: totalXpExpr
		})
		.from(attempts)
		.innerJoin(users, eq(users.id, attempts.userId))
		.where(and(eq(attempts.status, 'SUBMITTED'), isNotNull(attempts.userId)))
		.groupBy(attempts.userId, users.publicId, users.displayName, users.avatarUrl)
		.having(cursorCondition)
		.orderBy(desc(totalXpExpr), asc(users.publicId))
		.limit(filters.limit + 1);
	// sqlite's sum() comes back as a string/bigint through the driver despite the sql<number> hint.
	const rows = rawRows.map((row) => ({ ...row, totalXp: Number(row.totalXp) }));
	const hasMore = rows.length > filters.limit;
	const pageRows = hasMore ? rows.slice(0, filters.limit) : rows;
	const baseRank = cursor?.rank ?? 0;
	const streaks = await loadStreaks(
		db,
		pageRows.flatMap((row) => (row.userId === null ? [] : [row.userId])),
		now
	);
	const items: LeaderboardEntry[] = pageRows.flatMap((row, index) => {
		if (row.userId === null) return [];

		return [
			{
				rank: baseRank + index + 1,
				userId: row.publicId,
				displayName: row.displayName,
				avatarUrl: row.avatarUrl,
				level: computeLevel(row.totalXp),
				totalXp: row.totalXp,
				streak: streaks.get(row.userId) ?? 0
			}
		];
	});
	const last = pageRows.at(-1);

	return {
		items,
		nextCursor:
			hasMore && last
				? encodeLeaderboardCursor({
						totalXp: last.totalXp,
						userId: last.publicId,
						rank: baseRank + pageRows.length
					})
				: null
	};
}
