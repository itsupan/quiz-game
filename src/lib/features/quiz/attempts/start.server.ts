import { and, eq, sql } from 'drizzle-orm';

import type { WriteResult } from '$lib/domain/write-result';
import type { Database } from '$lib/server/db';
import { isForeignKeyFailure } from '$lib/server/db/errors';
import {
	attemptQuestions,
	attempts,
	questions,
	quizQuestions,
	quizzes,
	quizSections
} from '$lib/server/db/schema';
import type { Quiz, QuizSection, Section } from '$lib/server/db/schema';
import { attemptDeadline } from '../timing';

type ServedQuestion = { questionId: number; section: Section; points: number };

async function fixedServing(db: Database, quizId: number): Promise<ServedQuestion[]> {
	return db
		.select({
			questionId: quizQuestions.questionId,
			section: quizSections.section,
			points: sql<number>`coalesce(${quizQuestions.pointsOverride}, ${questions.points})`.mapWith(
				Number
			)
		})
		.from(quizQuestions)
		.innerJoin(questions, eq(questions.id, quizQuestions.questionId))
		.innerJoin(quizSections, eq(quizSections.id, quizQuestions.quizSectionId))
		.where(eq(quizQuestions.quizId, quizId))
		.orderBy(quizSections.position, quizQuestions.position);
}

async function randomServing(
	db: Database,
	quiz: Pick<Quiz, 'level'>,
	sections: Pick<QuizSection, 'section' | 'position' | 'drawCount'>[]
): Promise<WriteResult<ServedQuestion[]>> {
	const served: ServedQuestion[] = [];

	for (const section of [...sections].sort((a, b) => a.position - b.position)) {
		const drawCount = section.drawCount ?? 0;
		if (drawCount === 0) continue;

		const drawn = await db
			.select({ questionId: questions.id, points: questions.points })
			.from(questions)
			.where(
				and(
					eq(questions.level, quiz.level),
					eq(questions.section, section.section),
					eq(questions.status, 'PUBLISHED')
				)
			)
			.orderBy(sql`random()`)
			.limit(drawCount);

		if (drawn.length < drawCount) {
			return {
				ok: false,
				message: `This quiz has no published questions left for its ${section.section} section.`
			};
		}

		served.push(...drawn.map((row) => ({ ...row, section: section.section })));
	}

	return { ok: true, value: served };
}

export async function startAttempt(
	db: Database,
	quiz: Pick<Quiz, 'id' | 'level' | 'selectionMode' | 'timeLimitSeconds'>,
	sections: Pick<QuizSection, 'section' | 'position' | 'drawCount'>[],
	userId: number,
	now: Date
): Promise<WriteResult<string>> {
	const servedResult =
		quiz.selectionMode === 'FIXED'
			? { ok: true as const, value: await fixedServing(db, quiz.id) }
			: await randomServing(db, quiz, sections);

	if (!servedResult.ok) return servedResult;
	if (servedResult.value.length === 0) {
		return { ok: false, message: 'This quiz has no questions to serve yet.' };
	}

	const [created] = await db
		.insert(attempts)
		.values({
			quizId: quiz.id,
			userId,
			status: 'IN_PROGRESS',
			startedAt: now,
			expiresAt: attemptDeadline(now, quiz.timeLimitSeconds)
		})
		.returning({ id: attempts.id, publicId: attempts.publicId });

	try {
		await db.insert(attemptQuestions).values(
			servedResult.value.map((served, index) => ({
				attemptId: created.id,
				questionId: served.questionId,
				section: served.section,
				position: index + 1,
				points: served.points
			}))
		);
	} catch (cause) {
		await db.delete(attempts).where(eq(attempts.id, created.id));

		if (isForeignKeyFailure(cause)) {
			return { ok: false, message: 'One of this quiz’s questions no longer exists.' };
		}

		throw cause;
	}

	return { ok: true, value: created.publicId };
}

export async function startPublishedAttempt(
	db: Database,
	publicId: string,
	userId: number,
	now: Date
): Promise<WriteResult<string> | null> {
	const [quiz] = await db.select().from(quizzes).where(eq(quizzes.publicId, publicId));
	if (!quiz || quiz.status !== 'PUBLISHED') return null;

	const sections = await db
		.select({
			section: quizSections.section,
			position: quizSections.position,
			drawCount: quizSections.drawCount
		})
		.from(quizSections)
		.where(eq(quizSections.quizId, quiz.id));

	return startAttempt(db, quiz, sections, userId, now);
}
