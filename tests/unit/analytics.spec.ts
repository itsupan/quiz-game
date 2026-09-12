import { eq } from 'drizzle-orm';
import { beforeEach, describe, expect, it } from 'vitest';

import {
	encodeExamAttemptCursor,
	parseExamAttemptCursor,
	parseExamResult,
	parsePeriod,
	parseTimezone
} from '$lib/features/analytics/api.server';
import { currentWeek } from '$lib/features/analytics/analytics';
import { listExamAttempts, loadAnalyticsOverview } from '$lib/features/analytics/analytics.server';
import { ApiProblem } from '$lib/features/quiz/api/http.server';
import { createTestDatabase, type TestDatabase } from '$lib/server/db/test-harness';
import {
	attemptSectionScores,
	attemptSections,
	attempts,
	quizzes,
	quizSections,
	users
} from '$lib/server/db/schema';

const NOW = new Date('2026-09-13T12:00:00.000Z');

let db: TestDatabase;
let learnerId: number;
let otherLearnerId: number;

beforeEach(async () => {
	db = createTestDatabase().db;

	const [learner] = await db
		.insert(users)
		.values({
			email: 'analytics@example.com',
			displayName: 'Analytics learner',
			jlptLevel: 'N4'
		})
		.returning({ id: users.id });
	const [otherLearner] = await db
		.insert(users)
		.values({ email: 'analytics-other@example.com', displayName: 'Other learner' })
		.returning({ id: users.id });

	learnerId = learner.id;
	otherLearnerId = otherLearner.id;
});

async function insertQuiz(input: {
	title: string;
	level?: 'N5' | 'N4';
	mode?: 'JLPT_PRACTICE' | 'MOCK_TEST' | 'FULL_EXAM';
	sections: ('VOCAB_KANJI' | 'GRAMMAR_READING' | 'LISTENING')[];
}) {
	const [quiz] = await db
		.insert(quizzes)
		.values({
			title: input.title,
			level: input.level ?? 'N4',
			mode: input.mode ?? 'MOCK_TEST',
			status: 'PUBLISHED'
		})
		.returning({ id: quizzes.id, publicId: quizzes.publicId });

	if (input.sections.length > 0) {
		await db.insert(quizSections).values(
			input.sections.map((section, index) => ({
				quizId: quiz.id,
				section,
				position: index + 1
			}))
		);
	}

	return quiz;
}

async function insertCompletedAttempt(input: {
	publicId: string;
	quizId: number;
	userId?: number;
	completedAt: string;
	status?: 'SUBMITTED' | 'EXPIRED';
	passed?: boolean | null;
	rawScore: number;
	rawMax: number;
	scaledTotal?: number | null;
	scaledTotalMax?: number | null;
	section?: 'VOCAB_KANJI' | 'GRAMMAR_READING' | 'LISTENING';
	correctCount?: number;
	questionCount?: number;
}) {
	const completedAt = new Date(input.completedAt);
	const [attempt] = await db
		.insert(attempts)
		.values({
			publicId: input.publicId,
			quizId: input.quizId,
			userId: input.userId ?? learnerId,
			status: input.status ?? 'SUBMITTED',
			startedAt: new Date(completedAt.getTime() - 60_000),
			submittedAt: completedAt,
			rawScore: input.rawScore,
			rawMax: input.rawMax,
			correctCount: input.correctCount ?? input.rawScore,
			questionCount: input.questionCount ?? input.rawMax,
			scaledTotal: input.scaledTotal ?? null,
			scaledTotalMax: input.scaledTotalMax ?? null,
			passed: input.passed ?? null
		})
		.returning({ id: attempts.id });

	if (input.section) {
		await db.insert(attemptSectionScores).values({
			attemptId: attempt.id,
			section: input.section,
			rawScore: input.rawScore,
			rawMax: input.rawMax,
			correctCount: input.correctCount ?? input.rawScore,
			questionCount: input.questionCount ?? input.rawMax
		});
	}

	const frozenSections = await db
		.select({ section: quizSections.section, position: quizSections.position })
		.from(quizSections)
		.where(eq(quizSections.quizId, input.quizId));
	if (frozenSections.length > 0) {
		await db.insert(attemptSections).values(
			frozenSections.map((section) => ({
				attemptId: attempt.id,
				section: section.section,
				position: section.position
			}))
		);
	}

	return attempt;
}

describe('analytics periods and request parsing', () => {
	it('calculates a Monday-to-Monday week in the requested timezone', () => {
		const period = currentWeek(NOW, 'Asia/Phnom_Penh');

		expect(period.start.toISOString()).toBe('2026-09-06T17:00:00.000Z');
		expect(period.end.toISOString()).toBe('2026-09-13T17:00:00.000Z');
	});

	it('accounts for a daylight-saving offset change at the end of a week', () => {
		const period = currentWeek(new Date('2026-11-01T18:00:00.000Z'), 'America/New_York');

		expect(period.start.toISOString()).toBe('2026-10-26T04:00:00.000Z');
		expect(period.end.toISOString()).toBe('2026-11-02T05:00:00.000Z');
	});

	it('validates timezone, period, result and cursor query values', () => {
		const cursor = {
			completedAt: new Date('2026-09-12T09:00:00.000Z'),
			attemptId: '01JSEEDSTATS00000000000001'
		};

		expect(parseTimezone(null)).toBe('UTC');
		expect(parseTimezone('Asia/Phnom_Penh')).toBe('Asia/Phnom_Penh');
		expect(parsePeriod('week')).toBe('week');
		expect(parseExamResult('FAILED')).toBe('FAILED');
		expect(parseExamAttemptCursor(encodeExamAttemptCursor(cursor))).toEqual(cursor);
	});

	it('rejects malformed analytics query values', () => {
		const invalidCalls = [
			() => parseTimezone('Not/A_Real_Timezone'),
			() => parsePeriod('month'),
			() => parseExamResult('pass'),
			() => parseExamAttemptCursor('not-a-cursor')
		];

		for (const call of invalidCalls) {
			expect(call).toThrowError(ApiProblem);
		}
	});
});

describe('learner analytics queries', () => {
	it('returns only the learner’s weekly scores and recent exam attempts', async () => {
		const mockExam = await insertQuiz({
			title: 'N4 mock exam',
			mode: 'MOCK_TEST',
			sections: ['VOCAB_KANJI', 'GRAMMAR_READING']
		});
		const practice = await insertQuiz({
			title: 'Grammar practice',
			mode: 'JLPT_PRACTICE',
			sections: ['GRAMMAR_READING']
		});
		const oldExam = await insertQuiz({
			title: 'Old full exam',
			level: 'N5',
			mode: 'FULL_EXAM',
			sections: ['VOCAB_KANJI', 'GRAMMAR_READING', 'LISTENING']
		});

		await insertCompletedAttempt({
			publicId: '01JSEEDSTATS00000000000003',
			quizId: mockExam.id,
			completedAt: '2026-09-10T10:00:00.000Z',
			passed: true,
			rawScore: 7,
			rawMax: 10,
			scaledTotal: 142,
			scaledTotalMax: 180,
			section: 'VOCAB_KANJI',
			correctCount: 7,
			questionCount: 10
		});
		await insertCompletedAttempt({
			publicId: '01JSEEDSTATS00000000000002',
			quizId: practice.id,
			completedAt: '2026-09-09T10:00:00.000Z',
			status: 'EXPIRED',
			rawScore: 2,
			rawMax: 5,
			section: 'GRAMMAR_READING',
			correctCount: 2,
			questionCount: 5
		});
		await insertCompletedAttempt({
			publicId: '01JSEEDSTATS00000000000001',
			quizId: oldExam.id,
			completedAt: '2026-09-01T10:00:00.000Z',
			passed: false,
			rawScore: 3,
			rawMax: 5,
			section: 'LISTENING',
			correctCount: 3,
			questionCount: 5
		});
		await insertCompletedAttempt({
			publicId: '01JSEEDSTATS00000000000004',
			quizId: mockExam.id,
			userId: otherLearnerId,
			completedAt: '2026-09-11T10:00:00.000Z',
			passed: true,
			rawScore: 10,
			rawMax: 10,
			section: 'LISTENING',
			correctCount: 10,
			questionCount: 10
		});

		const overview = await loadAnalyticsOverview(db, learnerId, NOW, 'UTC');

		expect(overview.weeklyPerformance).toEqual([
			{
				category: 'VOCAB_KANJI',
				label: 'Vocabulary & Kanji',
				correct: 7,
				total: 10,
				percentage: 70
			},
			{
				category: 'GRAMMAR_READING',
				label: 'Grammar & Reading',
				correct: 2,
				total: 5,
				percentage: 40
			},
			{
				category: 'LISTENING',
				label: 'Listening',
				correct: 0,
				total: 0,
				percentage: null
			}
		]);
		expect(overview.recentExams.map((exam) => exam.title)).toEqual([
			'N4 mock exam',
			'Old full exam'
		]);
		expect(overview.recentExams[0]).toMatchObject({
			category: 'COMPREHENSIVE',
			score: { earned: 142, maximum: 180, type: 'SCALED' },
			result: 'PASSED'
		});
		expect(overview.kanjiMastery).toEqual({
			available: false,
			learned: null,
			dueForReview: null,
			target: { level: 'N4', total: null, percentage: null }
		});
	});

	it('paginates exam attempts with an exclusive stable cursor and applies filters', async () => {
		const n4Exam = await insertQuiz({
			title: 'N4 exam',
			sections: ['VOCAB_KANJI']
		});
		const n5Exam = await insertQuiz({
			title: 'N5 exam',
			level: 'N5',
			mode: 'FULL_EXAM',
			sections: ['LISTENING']
		});

		await insertCompletedAttempt({
			publicId: '01JSEEDSTATS00000000000002',
			quizId: n4Exam.id,
			completedAt: '2026-09-12T10:00:00.000Z',
			passed: true,
			rawScore: 8,
			rawMax: 10
		});
		await insertCompletedAttempt({
			publicId: '01JSEEDSTATS00000000000001',
			quizId: n5Exam.id,
			completedAt: '2026-09-11T10:00:00.000Z',
			passed: false,
			rawScore: 4,
			rawMax: 10
		});
		await db
			.update(quizSections)
			.set({ section: 'GRAMMAR_READING' })
			.where(eq(quizSections.quizId, n5Exam.id));

		const first = await listExamAttempts(db, learnerId, { limit: 1 });
		expect(first.items.map((attempt) => attempt.title)).toEqual(['N4 exam']);
		expect(first.nextCursor).not.toBeNull();

		const second = await listExamAttempts(db, learnerId, {
			limit: 1,
			cursor: parseExamAttemptCursor(first.nextCursor)
		});
		expect(second.items.map((attempt) => attempt.title)).toEqual(['N5 exam']);
		expect(second.nextCursor).toBeNull();

		const failedN5 = await listExamAttempts(db, learnerId, {
			level: 'N5',
			result: 'FAILED',
			limit: 20
		});
		expect(failedN5.items).toHaveLength(1);
		expect(failedN5.items[0]).toMatchObject({
			// Historical analytics use the frozen attempt section, not the edited quiz.
			category: 'LISTENING',
			completionStatus: 'SUBMITTED',
			result: 'FAILED',
			score: { earned: 4, maximum: 10, type: 'RAW' }
		});
	});
});
