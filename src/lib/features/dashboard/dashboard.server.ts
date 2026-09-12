import { and, desc, eq, inArray, isNotNull } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import { attempts, quizzes, quizSections } from '$lib/server/db/schema';
import { calculateStreakDays, type DashboardQuiz } from './dashboard';

async function listPublishedQuizzes(db: Database): Promise<DashboardQuiz[]> {
	const rows = await db
		.select({
			id: quizzes.id,
			publicId: quizzes.publicId,
			title: quizzes.title,
			description: quizzes.description,
			level: quizzes.level,
			mode: quizzes.mode,
			timeLimitSeconds: quizzes.timeLimitSeconds,
			createdAt: quizzes.createdAt
		})
		.from(quizzes)
		.where(eq(quizzes.status, 'PUBLISHED'))
		.orderBy(desc(quizzes.createdAt));

	if (rows.length === 0) return [];

	const sections = await db
		.select({ quizId: quizSections.quizId, section: quizSections.section })
		.from(quizSections)
		.where(
			inArray(
				quizSections.quizId,
				rows.map((quiz) => quiz.id)
			)
		)
		.orderBy(quizSections.position);

	const sectionsByQuiz = new Map<number, (typeof sections)[number]['section'][]>();
	for (const row of sections) {
		const quizSections = sectionsByQuiz.get(row.quizId) ?? [];
		quizSections.push(row.section);
		sectionsByQuiz.set(row.quizId, quizSections);
	}

	return rows.map((quiz) => ({
		publicId: quiz.publicId,
		title: quiz.title,
		description: quiz.description,
		level: quiz.level,
		mode: quiz.mode,
		timeLimitSeconds: quiz.timeLimitSeconds,
		sections: sectionsByQuiz.get(quiz.id) ?? [],
		createdAt: quiz.createdAt.toISOString()
	}));
}

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

export async function loadDashboard(db: Database, userId: number, now: Date) {
	const [quizzes, completionDates] = await Promise.all([
		listPublishedQuizzes(db),
		loadCompletionDates(db, userId)
	]);

	return { quizzes, streakDays: calculateStreakDays(completionDates, now) };
}
