import { fail, redirect } from '@sveltejs/kit';

import { createQuiz } from '$lib/features/quiz/admin/quizzes.server';
import { parseQuizForm } from '$lib/features/quiz/admin/validation';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ locals, request }) => {
		const parsed = parseQuizForm(await request.formData());

		if (!parsed.ok) {
			return fail(400, { errors: parsed.errors, values: parsed.values });
		}

		const publicId = await createQuiz(locals.db, locals.user?.id ?? null, parsed.value);

		// Sections are configured on the edit page, which is where a quiz becomes usable.
		redirect(303, `/admin/quizzes/${publicId}`);
	}
};
