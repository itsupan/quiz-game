import { and, count, desc, eq, inArray, notInArray, sql } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import { isForeignKeyFailure } from '$lib/server/db/errors';
import { mediaAssets, questionOptions, questions } from '$lib/server/db/schema';
import type { ContentStatus, JlptLevel, Question, Section } from '$lib/server/db/schema';
import type { WriteResult } from '$lib/domain/write-result';
import type { QuestionInput } from './validation';

export type QuestionListItem = Pick<
	Question,
	'publicId' | 'stem' | 'level' | 'section' | 'status' | 'points' | 'createdAt' | 'updatedAt'
> & { optionCount: number; hasAnswerKey: boolean };

export type QuestionFilters = {
	level?: JlptLevel;
	section?: Section;
	status?: ContentStatus;
	page?: number;
	/** Defaults to `PAGE_SIZE`. The admin dashboard never overrides this; the JSON API does. */
	limit?: number;
};

export const PAGE_SIZE = 25;

/**
 * The admin question list.
 *
 * Filters are ordered level → section → status to match
 * `questions_level_section_status_idx`, so a filtered list is an index range rather than
 * a scan of the bank.
 *
 * `hasAnswerKey` is here because a question without one cannot be published, and finding
 * that out on the edit page one question at a time is how a draft sits broken for weeks.
 */
export async function listQuestions(db: Database, filters: QuestionFilters = {}) {
	const page = Math.max(1, filters.page ?? 1);
	const limit = filters.limit ?? PAGE_SIZE;

	const where = and(
		filters.level ? eq(questions.level, filters.level) : undefined,
		filters.section ? eq(questions.section, filters.section) : undefined,
		filters.status ? eq(questions.status, filters.status) : undefined
	);

	const rows = await db
		.select({
			publicId: questions.publicId,
			stem: questions.stem,
			level: questions.level,
			section: questions.section,
			status: questions.status,
			points: questions.points,
			createdAt: questions.createdAt,
			updatedAt: questions.updatedAt,
			optionCount: sql<number>`count(${questionOptions.id})`.mapWith(Number),
			answerKeys:
				sql<number>`sum(case when ${questionOptions.isCorrect} then 1 else 0 end)`.mapWith(Number)
		})
		.from(questions)
		.leftJoin(questionOptions, eq(questionOptions.questionId, questions.id))
		.where(where)
		.groupBy(questions.id)
		.orderBy(desc(questions.updatedAt))
		.limit(limit)
		.offset((page - 1) * limit);

	const [{ total }] = await db.select({ total: count() }).from(questions).where(where);

	return {
		items: rows.map(({ answerKeys, ...row }) => ({ ...row, hasAnswerKey: answerKeys > 0 })),
		total,
		page,
		pageCount: Math.max(1, Math.ceil(total / limit))
	};
}

/**
 * One question with everything the edit form needs.
 *
 * This is the one place `question_options.isCorrect` is legitimately read, and it never
 * leaves an `/admin` response — the learner-facing projection is
 * `publicQuestionOptionColumns`, which has no such column to leak.
 */
/** A light lookup for callers that only need to resolve a public id, such as attaching a question to a quiz. */
export async function getQuestionRefByPublicId(db: Database, publicId: string) {
	const [question] = await db
		.select({
			id: questions.id,
			publicId: questions.publicId,
			level: questions.level,
			section: questions.section,
			status: questions.status
		})
		.from(questions)
		.where(eq(questions.publicId, publicId));

	return question ?? null;
}

export async function getQuestion(db: Database, publicId: string) {
	const [question] = await db.select().from(questions).where(eq(questions.publicId, publicId));

	if (!question) {
		return null;
	}

	const options = await db
		.select()
		.from(questionOptions)
		.where(eq(questionOptions.questionId, question.id))
		.orderBy(questionOptions.position);

	const attachedIds = [question.imageMediaId, question.audioMediaId].filter(
		(id): id is number => id !== null
	);

	const media = attachedIds.length
		? await db.select().from(mediaAssets).where(inArray(mediaAssets.id, attachedIds))
		: [];

	return {
		question,
		options,
		image: media.find((asset) => asset.id === question.imageMediaId) ?? null,
		audio: media.find((asset) => asset.id === question.audioMediaId) ?? null
	};
}

/**
 * Checks the media a question points at actually exists, and is the right kind.
 *
 * Without this an unknown id reaches the database as a foreign-key failure — a raw 500
 * on create, and on update a failure indistinguishable from the option RESTRICT below,
 * which reported entirely the wrong cause. The kind check matters separately: an audio
 * asset stored in `imageMediaId` passes every constraint, and the publish gate then
 * complains that the audio file has no alt text.
 */
export async function checkMediaSlots(
	db: Database,
	input: Pick<QuestionInput, 'imageMediaId' | 'audioMediaId'>
): Promise<Record<string, string>> {
	const wanted = [
		{ field: 'imageMediaId', id: input.imageMediaId, kind: 'IMAGE' as const },
		{ field: 'audioMediaId', id: input.audioMediaId, kind: 'AUDIO' as const }
	].filter(
		(slot): slot is { field: string; id: number; kind: 'IMAGE' | 'AUDIO' } => slot.id !== null
	);

	if (wanted.length === 0) {
		return {};
	}

	const found = await db
		.select({ id: mediaAssets.id, kind: mediaAssets.kind })
		.from(mediaAssets)
		.where(
			inArray(
				mediaAssets.id,
				wanted.map((slot) => slot.id)
			)
		);

	const errors: Record<string, string> = {};

	for (const slot of wanted) {
		const asset = found.find((row) => row.id === slot.id);

		if (!asset) {
			errors[slot.field] = 'That file no longer exists. Choose another on the Media page.';
		} else if (asset.kind !== slot.kind) {
			errors[slot.field] =
				`That file is ${asset.kind.toLowerCase()}, not ${slot.kind.toLowerCase()}.`;
		}
	}

	return errors;
}

export async function createQuestion(
	db: Database,
	actorUserId: number | null,
	input: QuestionInput
): Promise<WriteResult<string>> {
	const [created] = await db
		.insert(questions)
		.values({
			stem: input.stem,
			explanation: input.explanation,
			level: input.level,
			section: input.section,
			points: input.points,
			imageMediaId: input.imageMediaId,
			audioMediaId: input.audioMediaId,
			createdBy: actorUserId
		})
		.returning({ id: questions.id, publicId: questions.publicId });

	await db.insert(questionOptions).values(
		input.options.map((option) => ({
			questionId: created.id,
			body: option.body,
			isCorrect: option.isCorrect,
			position: option.position
		}))
	);

	return { ok: true, value: created.publicId };
}

/**
 * Rewrites a question and its options.
 *
 * Two constraints dictate the statement order, and getting it wrong fails at write time
 * rather than at review time:
 *
 *   `question_options_one_correct_idx` is a partial unique index, so the old answer key
 *   must be cleared BEFORE the new one is set — SQLite checks it per statement, not at
 *   commit.
 *
 *   `question_options_position_idx` is unique on (question_id, position), so reordering
 *   two options collides halfway through. Existing rows are parked on `-id`, which is
 *   unique because ids are, before final positions are assigned.
 *
 * Options are updated in place rather than replaced because `attempt_answers` references
 * them with ON DELETE RESTRICT: deleting an option a learner once selected would erase
 * what their attempt said.
 */
export async function updateQuestion(
	db: Database,
	questionId: number,
	input: QuestionInput
): Promise<WriteResult<void>> {
	const keptIds = input.options
		.map((option) => option.id)
		.filter((id): id is number => id !== null);

	// Refuse outright rather than let the scoped statements below quietly match nothing:
	// an id belonging to another question would otherwise survive as far as the delete,
	// which — seeing none of this question's own ids among the kept ones — would remove
	// every option it has.
	const owned = await db
		.select({ id: questionOptions.id })
		.from(questionOptions)
		.where(eq(questionOptions.questionId, questionId));

	const ownedIds = new Set(owned.map((option) => option.id));

	if (keptIds.some((id) => !ownedIds.has(id))) {
		return {
			ok: false,
			message: 'Those options do not belong to this question. Reload the page and try again.'
		};
	}

	const statements = [
		db
			.update(questions)
			.set({
				stem: input.stem,
				explanation: input.explanation,
				level: input.level,
				section: input.section,
				points: input.points,
				imageMediaId: input.imageMediaId,
				audioMediaId: input.audioMediaId
			})
			.where(eq(questions.id, questionId)),

		// Clear the answer key and park every position out of the way in one statement.
		db
			.update(questionOptions)
			.set({ isCorrect: false, position: sql`-${questionOptions.id}` })
			.where(eq(questionOptions.questionId, questionId)),

		keptIds.length
			? db
					.delete(questionOptions)
					.where(
						and(eq(questionOptions.questionId, questionId), notInArray(questionOptions.id, keptIds))
					)
			: db.delete(questionOptions).where(eq(questionOptions.questionId, questionId)),

		// Every statement below is scoped to this question as well as to the row. The ids
		// arrive in hidden form inputs, so without the questionId a POST to question A
		// carrying question B's option ids would rewrite B's options and move B's answer
		// key — while the delete above, seeing none of A's ids in keptIds, wiped A's.
		...input.options
			.filter((option) => option.id !== null)
			.map((option) =>
				db
					.update(questionOptions)
					.set({ body: option.body, position: option.position })
					.where(
						and(
							eq(questionOptions.questionId, questionId),
							eq(questionOptions.id, option.id as number)
						)
					)
			),

		...input.options
			.filter((option) => option.id === null)
			.map((option) =>
				db.insert(questionOptions).values({
					questionId,
					body: option.body,
					// Safe: every existing row was cleared two statements ago.
					isCorrect: option.isCorrect,
					position: option.position
				})
			)
	];

	// The key belongs to an existing row only when it was not just inserted above.
	const existingKey = input.options.find((option) => option.isCorrect && option.id !== null);

	if (existingKey) {
		statements.push(
			db
				.update(questionOptions)
				.set({ isCorrect: true })
				.where(
					and(
						eq(questionOptions.questionId, questionId),
						eq(questionOptions.id, existingKey.id as number)
					)
				)
		);
	}

	try {
		await db.batch(statements as [(typeof statements)[number], ...typeof statements]);
	} catch (cause) {
		if (isForeignKeyFailure(cause)) {
			return {
				ok: false,
				message:
					'An option you removed has already been chosen in a learner attempt, so it cannot be deleted. Edit its text instead of removing the row.'
			};
		}

		throw cause;
	}

	return { ok: true, value: undefined };
}

export async function setQuestionStatus(db: Database, questionId: number, status: ContentStatus) {
	await db.update(questions).set({ status }).where(eq(questions.id, questionId));
}
