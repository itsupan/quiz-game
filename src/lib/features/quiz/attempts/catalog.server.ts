import { and, count, eq } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import { quizQuestions, quizzes, quizSections } from '$lib/server/db/schema';
import type { QuizOverview } from './types.server';

/** Loads the public pre-start view for a published quiz. */
export async function loadQuizOverview(
	db: Database,
	publicId: string
): Promise<QuizOverview | null> {
	const [quiz] = await db
		.select({
			id: quizzes.id,
			publicId: quizzes.publicId,
			title: quizzes.title,
			description: quizzes.description,
			mode: quizzes.mode,
			level: quizzes.level,
			selectionMode: quizzes.selectionMode,
			timeLimitSeconds: quizzes.timeLimitSeconds
		})
		.from(quizzes)
		.where(and(eq(quizzes.publicId, publicId), eq(quizzes.status, 'PUBLISHED')));

	if (!quiz) return null;

	const sections = await db
		.select({
			id: quizSections.id,
			section: quizSections.section,
			position: quizSections.position,
			timeLimitSeconds: quizSections.timeLimitSeconds,
			drawCount: quizSections.drawCount
		})
		.from(quizSections)
		.where(eq(quizSections.quizId, quiz.id))
		.orderBy(quizSections.position);

	const attached =
		quiz.selectionMode === 'FIXED'
			? await db
					.select({ quizSectionId: quizQuestions.quizSectionId, total: count() })
					.from(quizQuestions)
					.where(eq(quizQuestions.quizId, quiz.id))
					.groupBy(quizQuestions.quizSectionId)
			: [];

	return {
		...quiz,
		sections: sections.map((section) => ({
			section: section.section,
			position: section.position,
			timeLimitSeconds: section.timeLimitSeconds,
			questionCount:
				quiz.selectionMode === 'FIXED'
					? (attached.find((row) => row.quizSectionId === section.id)?.total ?? 0)
					: (section.drawCount ?? 0)
		}))
	};
}
