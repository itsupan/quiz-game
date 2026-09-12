import { error, fail } from '@sveltejs/kit';

import { recordAudit } from '$lib/features/admin/audit.server';
import { enumFilter } from '$lib/features/admin/query-filters';
import { getQuiz, listQuizzes, setQuizStatus } from '$lib/features/quiz/admin/quizzes.server';
import {
	CONTENT_STATUS,
	JLPT_LEVELS,
	QUIZ_MODES,
	type ContentStatus,
	type JlptLevel,
	type QuizMode
} from '$lib/domain/enums';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, url }) => {
	const filters = {
		status: enumFilter<ContentStatus>(url, 'status', CONTENT_STATUS),
		level: enumFilter<JlptLevel>(url, 'level', JLPT_LEVELS),
		mode: enumFilter<QuizMode>(url, 'mode', QUIZ_MODES),
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
