import { error, fail, redirect } from '@sveltejs/kit';

import { loadQuizOverview, startPublishedAttempt } from '$lib/features/quiz/attempts.server';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals, params }) => {
	const overview = await loadQuizOverview(locals.db, params.publicId);

	if (!overview) {
		error(404, 'That quiz does not exist.');
	}

	return { quiz: overview };
};

export const actions: Actions = {
	/**
	 * No pause, and no resume: starting again always begins a fresh sitting. A learner is
	 * free to retake a quiz, and nothing here tries to guess whether an existing
	 * `IN_PROGRESS` attempt was meant to continue — that decision belongs to the learner,
	 * not to a heuristic.
	 */
	start: async ({ locals, params }) => {
		const written = await startPublishedAttempt(
			locals.db,
			params.publicId,
			locals.user!.id,
			new Date()
		);

		if (!written) {
			error(404, 'That quiz does not exist.');
		}

		if (!written.ok) {
			return fail(409, { message: written.message });
		}

		redirect(303, `/quiz/attempt/${written.value}`);
	}
};
