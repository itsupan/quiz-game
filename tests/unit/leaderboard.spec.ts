import { beforeEach, describe, expect, it } from 'vitest';

import {
	encodeLeaderboardCursor,
	parseLeaderboardCursor
} from '$lib/features/leaderboard/api.server';
import { computeLevel, computeStreak, LEVEL_CAP } from '$lib/features/leaderboard/leaderboard';
import { listLeaderboard } from '$lib/features/leaderboard/leaderboard.server';
import { ApiProblem } from '$lib/features/quiz/api/http.server';
import { createTestDatabase, type TestDatabase } from '$lib/server/db/test-harness';
import { attempts, quizzes, users } from '$lib/server/db/schema';

const NOW = new Date('2026-09-13T12:00:00.000Z');
const DAY = 86_400_000;

describe('computeLevel', () => {
	it('grants one level per 1,000 lifetime XP, starting at level 1', () => {
		expect(computeLevel(0)).toBe(1);
		expect(computeLevel(999)).toBe(1);
		expect(computeLevel(1000)).toBe(2);
	});

	it('caps at LEVEL_CAP however much XP is earned', () => {
		expect(computeLevel(1_000_000)).toBe(LEVEL_CAP);
	});
});

describe('computeStreak', () => {
	it('counts zero when there is no activity today or yesterday', () => {
		expect(computeStreak([new Date(NOW.getTime() - 3 * DAY)], NOW)).toBe(0);
	});

	it('counts consecutive days ending today', () => {
		const dates = [NOW, new Date(NOW.getTime() - DAY), new Date(NOW.getTime() - 2 * DAY)];

		expect(computeStreak(dates, NOW)).toBe(3);
	});

	it('still counts a streak that ended yesterday', () => {
		const dates = [new Date(NOW.getTime() - DAY), new Date(NOW.getTime() - 2 * DAY)];

		expect(computeStreak(dates, NOW)).toBe(2);
	});

	it('stops at the first gap', () => {
		const dates = [NOW, new Date(NOW.getTime() - 3 * DAY)];

		expect(computeStreak(dates, NOW)).toBe(1);
	});
});

describe('leaderboard cursor', () => {
	it('round-trips through encode and parse', () => {
		const cursor = { totalXp: 4200, userId: '01JSEEDSTATS00000000000001', rank: 5 };

		expect(parseLeaderboardCursor(encodeLeaderboardCursor(cursor))).toEqual(cursor);
	});

	it('rejects a malformed cursor', () => {
		expect(() => parseLeaderboardCursor('not-a-cursor')).toThrow(ApiProblem);
	});

	it('treats a missing cursor as the first page', () => {
		expect(parseLeaderboardCursor(null)).toBeUndefined();
	});
});

describe('listLeaderboard', () => {
	let db: TestDatabase;
	let quizId: number;

	beforeEach(async () => {
		db = createTestDatabase().db;
		const [quiz] = await db
			.insert(quizzes)
			.values({ title: 'Leaderboard quiz', level: 'N4', mode: 'MOCK_TEST', status: 'PUBLISHED' })
			.returning({ id: quizzes.id });
		quizId = quiz.id;
	});

	async function insertLearner(email: string, displayName: string) {
		const [learner] = await db
			.insert(users)
			.values({ email, displayName })
			.returning({ id: users.id, publicId: users.publicId });

		return learner;
	}

	async function insertSubmittedAttempt(input: {
		userId: number;
		xpAwarded: number;
		submittedAt: Date;
	}) {
		await db.insert(attempts).values({
			quizId,
			userId: input.userId,
			status: 'SUBMITTED',
			startedAt: new Date(input.submittedAt.getTime() - 60_000),
			submittedAt: input.submittedAt,
			xpAwarded: input.xpAwarded
		});
	}

	it('ranks learners by total lifetime XP, highest first', async () => {
		const top = await insertLearner('top@example.com', 'Top Learner');
		const middle = await insertLearner('middle@example.com', 'Middle Learner');
		const bottom = await insertLearner('bottom@example.com', 'Bottom Learner');
		await insertSubmittedAttempt({ userId: bottom.id, xpAwarded: 100, submittedAt: NOW });
		await insertSubmittedAttempt({ userId: top.id, xpAwarded: 900, submittedAt: NOW });
		await insertSubmittedAttempt({ userId: top.id, xpAwarded: 200, submittedAt: NOW });
		await insertSubmittedAttempt({ userId: middle.id, xpAwarded: 500, submittedAt: NOW });

		const page = await listLeaderboard(db, { limit: 20 }, NOW);

		expect(page.items.map((entry) => entry.userId)).toEqual([
			top.publicId,
			middle.publicId,
			bottom.publicId
		]);
		expect(page.items.map((entry) => entry.rank)).toEqual([1, 2, 3]);
		expect(page.items[0].totalXp).toBe(1100);
		expect(page.nextCursor).toBeNull();
	});

	it('paginates with a cursor that carries the running rank forward', async () => {
		for (const [name, xp] of [
			['a', 400],
			['b', 300],
			['c', 200],
			['d', 100]
		] as const) {
			const learner = await insertLearner(`${name}@example.com`, name);
			await insertSubmittedAttempt({ userId: learner.id, xpAwarded: xp, submittedAt: NOW });
		}

		const firstPage = await listLeaderboard(db, { limit: 2 }, NOW);
		expect(firstPage.items.map((entry) => entry.rank)).toEqual([1, 2]);
		expect(firstPage.nextCursor).not.toBeNull();

		const cursor = parseLeaderboardCursor(firstPage.nextCursor);
		const secondPage = await listLeaderboard(db, { cursor, limit: 2 }, NOW);
		expect(secondPage.items.map((entry) => entry.rank)).toEqual([3, 4]);
		expect(secondPage.nextCursor).toBeNull();
	});

	it('only counts SUBMITTED attempts toward XP and excludes guest attempts', async () => {
		const learner = await insertLearner('learner@example.com', 'Learner');
		await insertSubmittedAttempt({ userId: learner.id, xpAwarded: 500, submittedAt: NOW });
		await db.insert(attempts).values({
			quizId,
			userId: learner.id,
			status: 'IN_PROGRESS',
			startedAt: NOW,
			xpAwarded: 9999
		});
		await db.insert(attempts).values({
			quizId,
			userId: null,
			status: 'SUBMITTED',
			startedAt: NOW,
			submittedAt: NOW,
			xpAwarded: 9999
		});

		const page = await listLeaderboard(db, { limit: 20 }, NOW);

		expect(page.items).toHaveLength(1);
		expect(page.items[0].totalXp).toBe(500);
	});

	it("computes each learner's current day streak from their own attempt history", async () => {
		const streaky = await insertLearner('streaky@example.com', 'Streaky');
		const oneOff = await insertLearner('oneoff@example.com', 'One Off');
		await insertSubmittedAttempt({ userId: streaky.id, xpAwarded: 100, submittedAt: NOW });
		await insertSubmittedAttempt({
			userId: streaky.id,
			xpAwarded: 100,
			submittedAt: new Date(NOW.getTime() - DAY)
		});
		await insertSubmittedAttempt({
			userId: oneOff.id,
			xpAwarded: 100,
			submittedAt: new Date(NOW.getTime() - 10 * DAY)
		});

		const page = await listLeaderboard(db, { limit: 20 }, NOW);
		const byUser = new Map(page.items.map((entry) => [entry.userId, entry]));

		expect(byUser.get(streaky.publicId)?.streak).toBe(2);
		expect(byUser.get(oneOff.publicId)?.streak).toBe(0);
	});
});
