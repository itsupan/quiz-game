import { and, count, desc, eq, ne } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import { quizQuestions, quizSections, quizzes } from '$lib/server/db/schema';
import type { ContentStatus, JlptLevel, Quiz, QuizMode, QuizSection } from '$lib/server/db/schema';
import { isForeignKeyFailure, type WriteResult } from '../questions/questions.server';
import type { QuizInput, QuizSectionInput } from '../validation';

export type QuizListItem = Pick<
	Quiz,
	| 'publicId'
	| 'title'
	| 'mode'
	| 'level'
	| 'selectionMode'
	| 'status'
	| 'timeLimitSeconds'
	| 'createdAt'
	| 'updatedAt'
> & { sectionCount: number; questionCount: number };

export type QuizFilters = {
	status?: ContentStatus;
	level?: JlptLevel;
	mode?: QuizMode;
	page?: number;
};

export const PAGE_SIZE = 25;

/** Filters are ordered to match `quizzes_status_level_mode_idx`. */
export async function listQuizzes(db: Database, filters: QuizFilters = {}) {
	const page = Math.max(1, filters.page ?? 1);

	const where = and(
		filters.status ? eq(quizzes.status, filters.status) : undefined,
		filters.level ? eq(quizzes.level, filters.level) : undefined,
		filters.mode ? eq(quizzes.mode, filters.mode) : undefined
	);

	const items = await db
		.select({
			publicId: quizzes.publicId,
			title: quizzes.title,
			mode: quizzes.mode,
			level: quizzes.level,
			selectionMode: quizzes.selectionMode,
			status: quizzes.status,
			timeLimitSeconds: quizzes.timeLimitSeconds,
			createdAt: quizzes.createdAt,
			updatedAt: quizzes.updatedAt,
			sectionCount: db.$count(quizSections, eq(quizSections.quizId, quizzes.id)),
			questionCount: db.$count(quizQuestions, eq(quizQuestions.quizId, quizzes.id))
		})
		.from(quizzes)
		.where(where)
		.orderBy(desc(quizzes.updatedAt))
		.limit(PAGE_SIZE)
		.offset((page - 1) * PAGE_SIZE);

	const [{ total }] = await db.select({ total: count() }).from(quizzes).where(where);

	return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

export async function getQuiz(db: Database, publicId: string) {
	const [quiz] = await db.select().from(quizzes).where(eq(quizzes.publicId, publicId));

	if (!quiz) {
		return null;
	}

	const sections = await db
		.select()
		.from(quizSections)
		.where(eq(quizSections.quizId, quiz.id))
		.orderBy(quizSections.position);

	return { quiz, sections };
}

export async function createQuiz(
	db: Database,
	actorUserId: number | null,
	input: QuizInput
): Promise<string> {
	const [created] = await db
		.insert(quizzes)
		.values({ ...input, createdBy: actorUserId })
		.returning({ publicId: quizzes.publicId });

	return created.publicId;
}

export async function updateQuiz(db: Database, quizId: number, input: QuizInput): Promise<void> {
	await db.update(quizzes).set(input).where(eq(quizzes.id, quizId));

	// Switching to FIXED makes every draw count dead data — the quiz now serves
	// quiz_questions — and leaving the numbers behind reads as if they still did
	// something. Switching the other way leaves them null on purpose: they have to be
	// filled in, and publishBlockers below refuses to publish until they are.
	if (input.selectionMode === 'FIXED') {
		await db.update(quizSections).set({ drawCount: null }).where(eq(quizSections.quizId, quizId));
	}
}

/**
 * Reasons a quiz cannot be published yet.
 *
 * The draw counts are the subtle one. `parseQuizSectionForm` enforces them against the
 * quiz's selection mode *at the moment the section is added*, so a quiz built as FIXED
 * and later switched to RANDOM ends up with sections that draw nothing — and would
 * otherwise publish cleanly and serve every learner an empty paper.
 */
export function quizPublishBlockers(
	quiz: Pick<Quiz, 'selectionMode'>,
	sections: Pick<QuizSection, 'section' | 'drawCount'>[]
): string[] {
	if (sections.length === 0) {
		return ['Add at least one section before publishing.'];
	}

	if (quiz.selectionMode !== 'RANDOM') {
		return [];
	}

	const undrawn = sections.filter((section) => section.drawCount === null);

	return undrawn.length === 0
		? []
		: [
				`This quiz draws its questions at random, so every section needs a draw count. Missing on: ${undrawn
					.map((section) => section.section)
					.join(', ')}.`
			];
}

/**
 * Adds or edits one section of a quiz.
 *
 * `quiz_sections` is unique on both (quiz_id, section) and (quiz_id, position), so the
 * two ways an administrator can collide are checked here to produce a sentence instead
 * of a constraint failure. The constraints stay the actual guarantee.
 */
export async function upsertSection(
	db: Database,
	quizId: number,
	sectionId: number | null,
	input: QuizSectionInput
): Promise<WriteResult<void>> {
	const clash = await db
		.select({ id: quizSections.id, section: quizSections.section, position: quizSections.position })
		.from(quizSections)
		.where(
			and(eq(quizSections.quizId, quizId), sectionId ? ne(quizSections.id, sectionId) : undefined)
		);

	if (clash.some((row) => row.section === input.section)) {
		return { ok: false, message: `This quiz already has a ${input.section} section.` };
	}

	if (clash.some((row) => row.position === input.position)) {
		return { ok: false, message: `Another section is already at position ${input.position}.` };
	}

	if (sectionId) {
		// Scoped by quiz, the way deleteSection is: the id comes from a form field, and an
		// id belonging to another quiz would otherwise be edited instead — past the clash
		// check above, which only sees this quiz's sections.
		const [updated] = await db
			.update(quizSections)
			.set(input)
			.where(and(eq(quizSections.quizId, quizId), eq(quizSections.id, sectionId)))
			.returning({ id: quizSections.id });

		if (!updated) {
			return { ok: false, message: 'That section does not belong to this quiz.' };
		}
	} else {
		await db.insert(quizSections).values({ quizId, ...input });
	}

	return { ok: true, value: undefined };
}

/**
 * Removes a section.
 *
 * `quiz_questions` cascades from its section, so deleting a section that still has
 * questions attached would silently drop them from the paper. Refuse instead.
 */
export async function deleteSection(
	db: Database,
	quizId: number,
	sectionId: number
): Promise<WriteResult<void>> {
	const [{ attached }] = await db
		.select({ attached: count() })
		.from(quizQuestions)
		.where(and(eq(quizQuestions.quizId, quizId), eq(quizQuestions.quizSectionId, sectionId)));

	if (attached > 0) {
		return {
			ok: false,
			message: `This section still has ${attached} question${attached === 1 ? '' : 's'} attached. Move them before removing it.`
		};
	}

	try {
		await db
			.delete(quizSections)
			.where(and(eq(quizSections.quizId, quizId), eq(quizSections.id, sectionId)));
	} catch (cause) {
		if (isForeignKeyFailure(cause)) {
			return { ok: false, message: 'This section is still referenced and cannot be removed.' };
		}

		throw cause;
	}

	return { ok: true, value: undefined };
}

/**
 * Publishing stamps `published_at` the first time only, so it records when a quiz first
 * became available rather than when it was last edited — `updated_at` already says that.
 */
export async function setQuizStatus(
	db: Database,
	quiz: { id: number; publishedAt: Date | null },
	status: ContentStatus
): Promise<void> {
	await db
		.update(quizzes)
		.set({
			status,
			publishedAt: status === 'PUBLISHED' && !quiz.publishedAt ? new Date() : quiz.publishedAt
		})
		.where(eq(quizzes.id, quiz.id));
}
