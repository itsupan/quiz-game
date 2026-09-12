import { error, fail } from '@sveltejs/kit';

import { recordAudit } from '$lib/features/admin/audit.server';
import { getQuiz, listQuizzes, setQuizStatus } from '$lib/features/admin/quizzes/quizzes.server';
import { CONTENT_STATUS, JLPT_LEVELS, QUIZ_MODES } from '$lib/server/db/schema/enums';
import type { ContentStatus, JlptLevel, QuizMode } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

function filter<T extends string>(url: URL, key: string, allowed: readonly T[]): T | undefined {
	const value = url.searchParams.get(key);

	return value && (allowed as readonly string[]).includes(value) ? (value as T) : undefined;
}

export const load: PageServerLoad = async ({ locals, url }) => {
	const filters = {
		status: filter<ContentStatus>(url, 'status', CONTENT_STATUS),
		level: filter<JlptLevel>(url, 'level', JLPT_LEVELS),
		mode: filter<QuizMode>(url, 'mode', QUIZ_MODES),
		page: Number(url.searchParams.get('page')) || 1
	};

	return { ...(await listQuizzes(locals.db, filters)), filters };
};

export const actions: Actions = {
	/** Archiving takes a quiz off the homepage without touching anyone's past attempts. */
	archive: async ({ locals, request }) => {
		const data = await request.formData();
		const found = await getQuiz(locals.db, String(data.get('publicId') ?? ''));

		if (!found) {
			error(404, 'That quiz no longer exists.');
		}

		if (found.quiz.status === 'ARCHIVED') {
			return fail(400, { message: 'That quiz is already archived.' });
		}

		await setQuizStatus(locals.db, found.quiz, 'ARCHIVED');
		await recordAudit(locals.db, {
			actorUserId: locals.user?.id ?? null,
			action: 'QUIZ_ARCHIVED',
			entityType: 'quiz',
			entityId: found.quiz.id,
			before: { status: found.quiz.status },
			after: { status: 'ARCHIVED' }
		});

		return { ok: true, message: `Archived “${found.quiz.title}”.` };
	}
};
