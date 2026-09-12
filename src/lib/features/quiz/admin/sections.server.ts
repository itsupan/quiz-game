import { and, count, eq, ne } from 'drizzle-orm';

import type { Section } from '$lib/domain/enums';
import type { WriteResult } from '$lib/domain/write-result';
import type { Database } from '$lib/server/db';
import { isForeignKeyFailure } from '$lib/server/db/errors';
import { quizQuestions, quizSections } from '$lib/server/db/schema';
import type { QuizSection } from '$lib/server/db/schema';
import type { QuizSectionInput } from './validation';

/**
 * Looks a section up by its enum value rather than its internal row id.
 *
 * `quiz_sections_quiz_section_idx` makes `(quizId, section)` unique, so the section enum
 * is already a stable, public identifier — the API addresses a section this way instead
 * of exposing the row's autoincrement id.
 */
export async function getSectionByEnum(
	db: Database,
	quizId: number,
	section: Section
): Promise<QuizSection | null> {
	const [found] = await db
		.select()
		.from(quizSections)
		.where(and(eq(quizSections.quizId, quizId), eq(quizSections.section, section)));

	return found ?? null;
}

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
		const [updated] = await db
			.update(quizSections)
			.set(input)
			.where(and(eq(quizSections.quizId, quizId), eq(quizSections.id, sectionId)))
			.returning({ id: quizSections.id });
		if (!updated) return { ok: false, message: 'That section does not belong to this quiz.' };
	} else {
		await db.insert(quizSections).values({ quizId, ...input });
	}

	return { ok: true, value: undefined };
}

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
