import { and, eq, inArray, max } from 'drizzle-orm';

import type { WriteResult } from '$lib/domain/write-result';
import type { Database } from '$lib/server/db';
import { questions, quizQuestions, quizSections } from '$lib/server/db/schema';
import type { ContentStatus, Quiz, QuizSection } from '$lib/server/db/schema';

export type AttachedQuestion = {
	quizQuestionId: number;
	quizSectionId: number;
	questionId: number;
	publicId: string;
	stem: string;
	position: number;
	points: number;
	status: ContentStatus;
};

export async function listAttachedQuestions(
	db: Database,
	quizId: number
): Promise<AttachedQuestion[]> {
	const rows = await db
		.select({
			quizQuestionId: quizQuestions.id,
			quizSectionId: quizQuestions.quizSectionId,
			questionId: questions.id,
			publicId: questions.publicId,
			stem: questions.stem,
			position: quizQuestions.position,
			pointsOverride: quizQuestions.pointsOverride,
			points: questions.points,
			status: questions.status
		})
		.from(quizQuestions)
		.innerJoin(questions, eq(questions.id, quizQuestions.questionId))
		.innerJoin(quizSections, eq(quizSections.id, quizQuestions.quizSectionId))
		.where(eq(quizQuestions.quizId, quizId))
		.orderBy(quizSections.position, quizQuestions.position);

	return rows.map(({ pointsOverride, points, ...question }) => ({
		...question,
		points: pointsOverride ?? points
	}));
}

export async function listAttachableQuestions(
	db: Database,
	quiz: Pick<Quiz, 'id' | 'level'>,
	sections: Pick<QuizSection, 'id' | 'section'>[]
): Promise<Record<number, { id: number; stem: string }[]>> {
	const bySection: Record<number, { id: number; stem: string }[]> = {};
	if (sections.length === 0) return bySection;

	const taken = await db
		.select({ questionId: quizQuestions.questionId })
		.from(quizQuestions)
		.where(eq(quizQuestions.quizId, quiz.id));
	const attached = new Set(taken.map((row) => row.questionId));
	const bank = await db
		.select({ id: questions.id, stem: questions.stem, section: questions.section })
		.from(questions)
		.where(
			and(
				eq(questions.level, quiz.level),
				eq(questions.status, 'PUBLISHED'),
				inArray(
					questions.section,
					sections.map((section) => section.section)
				)
			)
		)
		.orderBy(questions.id);

	for (const section of sections) {
		bySection[section.id] = bank
			.filter((question) => question.section === section.section && !attached.has(question.id))
			.map(({ id, stem }) => ({ id, stem }));
	}

	return bySection;
}

export async function attachQuestion(
	db: Database,
	quiz: Pick<Quiz, 'id' | 'level'>,
	quizSectionId: number,
	questionId: number
): Promise<WriteResult<void>> {
	const [section] = await db
		.select({ id: quizSections.id, section: quizSections.section })
		.from(quizSections)
		.where(and(eq(quizSections.quizId, quiz.id), eq(quizSections.id, quizSectionId)));
	if (!section) return { ok: false, message: 'That section does not belong to this quiz.' };

	const [question] = await db
		.select({
			id: questions.id,
			level: questions.level,
			section: questions.section,
			status: questions.status
		})
		.from(questions)
		.where(eq(questions.id, questionId));
	if (!question) return { ok: false, message: 'That question does not exist.' };
	if (question.status !== 'PUBLISHED') {
		return {
			ok: false,
			message: `That question is still ${question.status.toLowerCase()}. Publish it before putting it on a paper.`
		};
	}
	if (question.level !== quiz.level) {
		return {
			ok: false,
			message: `That question is ${question.level} and this quiz is ${quiz.level}.`
		};
	}
	if (question.section !== section.section) {
		return {
			ok: false,
			message: `That question is ${question.section} and this section is ${section.section}.`
		};
	}

	const [existing] = await db
		.select({ id: quizQuestions.id })
		.from(quizQuestions)
		.where(and(eq(quizQuestions.quizId, quiz.id), eq(quizQuestions.questionId, questionId)));
	if (existing) return { ok: false, message: 'That question is already on this paper.' };

	const [{ highest }] = await db
		.select({ highest: max(quizQuestions.position) })
		.from(quizQuestions)
		.where(eq(quizQuestions.quizSectionId, quizSectionId));
	await db.insert(quizQuestions).values({
		quizId: quiz.id,
		quizSectionId,
		questionId,
		position: (highest ?? 0) + 1
	});

	return { ok: true, value: undefined };
}

export async function detachQuestion(
	db: Database,
	quizId: number,
	quizQuestionId: number
): Promise<WriteResult<void>> {
	const [removed] = await db
		.delete(quizQuestions)
		.where(and(eq(quizQuestions.quizId, quizId), eq(quizQuestions.id, quizQuestionId)))
		.returning({ id: quizQuestions.id });

	return removed
		? { ok: true, value: undefined }
		: { ok: false, message: 'That question is not on this paper.' };
}
