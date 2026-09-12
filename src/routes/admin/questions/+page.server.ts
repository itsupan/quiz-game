import { error, fail } from '@sveltejs/kit';

import { recordAudit } from '$lib/features/admin/audit.server';
import { listQuestions, setQuestionStatus } from '$lib/features/admin/questions/questions.server';
import { getQuestion } from '$lib/features/admin/questions/questions.server';
import { CONTENT_STATUS, JLPT_LEVELS, SECTIONS } from '$lib/server/db/schema/enums';
import type { ContentStatus, JlptLevel, Section } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

/** Reads a filter from the query string, ignoring anything not in the schema's enum. */
function filter<T extends string>(url: URL, key: string, allowed: readonly T[]): T | undefined {
	const value = url.searchParams.get(key);

	return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const filters = {
		level: filter<JlptLevel>(url, 'level', JLPT_LEVELS),
		section: filter<Section>(url, 'section', SECTIONS),
		status: filter<ContentStatus>(url, 'status', CONTENT_STATUS),
		page: Number(url.searchParams.get('page')) || 1
	};

	return { ...(await listQuestions(locals.db, filters)), filters };
};

export const actions: Actions = {
	/**
	 * Archiving, not deleting. `attempt_questions` references questions with
	 * ON DELETE RESTRICT so past attempts stay readable, which means the status column
	 * is the only way content leaves circulation.
	 */
	archive: async ({ locals, request }) => {
		const data = await request.formData();
		const publicId = String(data.get('publicId') ?? '');
		const found = await getQuestion(locals.db, publicId);

		if (!found) {
			error(404, 'That question no longer exists.');
		}

		if (found.question.status === 'ARCHIVED') {
			return fail(400, { message: 'That question is already archived.' });
		}

		await setQuestionStatus(locals.db, found.question.id, 'ARCHIVED');
		await recordAudit(locals.db, {
			actorUserId: locals.user?.id ?? null,
			action: 'QUESTION_ARCHIVED',
			entityType: 'question',
			entityId: found.question.id,
			before: { status: found.question.status },
			after: { status: 'ARCHIVED' }
		});

		return { ok: true, message: `Archived “${found.question.stem.slice(0, 40)}”.` };
	}
};
