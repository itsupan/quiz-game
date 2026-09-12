import { and, desc, eq, gte, inArray, isNotNull, isNull, lt, or, sql } from 'drizzle-orm';

import type { JlptLevel, Section } from '$lib/domain/enums';
import type { Database } from '$lib/server/db';
import {
	attemptSectionScores,
	attemptSections,
	attempts,
	quizzes,
	users
} from '$lib/server/db/schema';
import {
	completeWeeklyPerformance,
	currentWeek,
	type AnalyticsPeriod,
	type ExamAttemptSummary,
	type ExamResult
} from './analytics';
import { encodeExamAttemptCursor, type ExamAttemptCursor } from './api.server';

export type ExamAttemptFilters = {
	level?: JlptLevel;
	result?: ExamResult;
	cursor?: ExamAttemptCursor;
	limit: number;
};

function resultCondition(result: ExamResult | undefined) {
	switch (result) {
		case 'PASSED':
			return and(eq(attempts.status, 'SUBMITTED'), eq(attempts.passed, true));
		case 'FAILED':
			return and(eq(attempts.status, 'SUBMITTED'), eq(attempts.passed, false));
		case 'INCOMPLETE':
			return eq(attempts.status, 'EXPIRED');
		case 'UNGRADED':
			return and(eq(attempts.status, 'SUBMITTED'), isNull(attempts.passed));
		case undefined:
			return undefined;
	}
}

function resultFor(row: { status: 'SUBMITTED' | 'EXPIRED'; passed: boolean | null }): ExamResult {
	if (row.status === 'EXPIRED') return 'INCOMPLETE';
	if (row.passed === true) return 'PASSED';
	if (row.passed === false) return 'FAILED';
	return 'UNGRADED';
}

async function sectionsByAttempt(db: Database, attemptIds: number[]) {
	if (attemptIds.length === 0) return new Map<number, Section[]>();

	const rows = await db
		.select({ attemptId: attemptSections.attemptId, section: attemptSections.section })
		.from(attemptSections)
		.where(inArray(attemptSections.attemptId, attemptIds))
		.orderBy(attemptSections.position);
	const grouped = new Map<number, Section[]>();

	for (const row of rows) {
		const sections = grouped.get(row.attemptId) ?? [];
		sections.push(row.section);
		grouped.set(row.attemptId, sections);
	}

	return grouped;
}

function categoryFor(sections: Section[]): 'COMPREHENSIVE' | Section {
	return sections.length === 1 ? sections[0] : 'COMPREHENSIVE';
}

export async function listExamAttempts(db: Database, userId: number, filters: ExamAttemptFilters) {
	const cursorCondition = filters.cursor
		? or(
				lt(attempts.submittedAt, filters.cursor.completedAt),
				and(
					eq(attempts.submittedAt, filters.cursor.completedAt),
					lt(attempts.publicId, filters.cursor.attemptId)
				)
			)
		: undefined;
	const rows = await db
		.select({
			attemptDatabaseId: attempts.id,
			attemptId: attempts.publicId,
			quizId: quizzes.publicId,
			title: quizzes.title,
			level: quizzes.level,
			completedAt: attempts.submittedAt,
			status: attempts.status,
			passed: attempts.passed,
			rawScore: attempts.rawScore,
			rawMax: attempts.rawMax,
			scaledTotal: attempts.scaledTotal,
			scaledTotalMax: attempts.scaledTotalMax
		})
		.from(attempts)
		.innerJoin(quizzes, eq(quizzes.id, attempts.quizId))
		.where(
			and(
				eq(attempts.userId, userId),
				inArray(attempts.status, ['SUBMITTED', 'EXPIRED']),
				isNotNull(attempts.submittedAt),
				inArray(quizzes.mode, ['MOCK_TEST', 'FULL_EXAM']),
				filters.level ? eq(quizzes.level, filters.level) : undefined,
				resultCondition(filters.result),
				cursorCondition
			)
		)
		.orderBy(desc(attempts.submittedAt), desc(attempts.publicId))
		.limit(filters.limit + 1);
	const hasMore = rows.length > filters.limit;
	const pageRows = hasMore ? rows.slice(0, filters.limit) : rows;
	const sectionMap = await sectionsByAttempt(
		db,
		pageRows.map((row) => row.attemptDatabaseId)
	);
	const items: ExamAttemptSummary[] = pageRows.flatMap((row) => {
		if (
			row.completedAt === null ||
			(row.status !== 'SUBMITTED' && row.status !== 'EXPIRED') ||
			row.rawScore === null ||
			row.rawMax === null
		) {
			return [];
		}

		const usesScaledScore = row.scaledTotal !== null && row.scaledTotalMax !== null;

		return [
			{
				attemptId: row.attemptId,
				quizId: row.quizId,
				title: row.title,
				level: row.level,
				category: categoryFor(sectionMap.get(row.attemptDatabaseId) ?? []),
				completedAt: row.completedAt.toISOString(),
				completionStatus: row.status,
				score: {
					earned: usesScaledScore ? (row.scaledTotal as number) : row.rawScore,
					maximum: usesScaledScore ? (row.scaledTotalMax as number) : row.rawMax,
					type: usesScaledScore ? ('SCALED' as const) : ('RAW' as const)
				},
				result: resultFor({ status: row.status, passed: row.passed }),
				resultHref: `/quiz/attempt/${row.attemptId}/result`
			}
		];
	});
	const last = pageRows.at(-1);

	return {
		items,
		nextCursor:
			hasMore && last?.completedAt
				? encodeExamAttemptCursor({ completedAt: last.completedAt, attemptId: last.attemptId })
				: null
	};
}

async function loadWeeklyPerformance(db: Database, userId: number, period: AnalyticsPeriod) {
	const rows = await db
		.select({
			section: attemptSectionScores.section,
			correct: sql<number>`sum(${attemptSectionScores.correctCount})`,
			total: sql<number>`sum(${attemptSectionScores.questionCount})`
		})
		.from(attemptSectionScores)
		.innerJoin(attempts, eq(attempts.id, attemptSectionScores.attemptId))
		.where(
			and(
				eq(attempts.userId, userId),
				inArray(attempts.status, ['SUBMITTED', 'EXPIRED']),
				isNotNull(attempts.submittedAt),
				gte(attempts.submittedAt, period.start),
				lt(attempts.submittedAt, period.end)
			)
		)
		.groupBy(attemptSectionScores.section);
	const bySection: Partial<Record<Section, { correct: number; total: number }>> = {};

	for (const row of rows) {
		bySection[row.section] = { correct: Number(row.correct), total: Number(row.total) };
	}

	return completeWeeklyPerformance(bySection);
}

async function loadLearnerLevel(db: Database, userId: number) {
	const [learner] = await db
		.select({ jlptLevel: users.jlptLevel })
		.from(users)
		.where(eq(users.id, userId));

	return learner?.jlptLevel ?? null;
}

export async function loadAnalyticsOverview(
	db: Database,
	userId: number,
	now: Date,
	timezone = 'UTC'
) {
	const period = currentWeek(now, timezone);
	const [weeklyPerformance, recentExams, jlptLevel] = await Promise.all([
		loadWeeklyPerformance(db, userId, period),
		listExamAttempts(db, userId, { limit: 3 }),
		loadLearnerLevel(db, userId)
	]);

	return {
		period: {
			start: period.start.toISOString(),
			end: period.end.toISOString(),
			timezone: period.timezone
		},
		weeklyPerformance,
		kanjiMastery: {
			available: false as const,
			learned: null,
			dueForReview: null,
			target: { level: jlptLevel, total: null, percentage: null }
		},
		recentExams: recentExams.items
	};
}
