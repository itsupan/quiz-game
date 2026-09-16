import { redirect } from '@sveltejs/kit';

import { ApiProblem, parsePublicId, requireLearner } from '$lib/features/quiz/api/http.server';
import { toPageError } from '$lib/features/quiz/api/page-errors.server';
import { getCompletedResult } from '$lib/features/quiz/api/quiz-api.server';
import type { QuizResult } from '$lib/features/quiz/api/types';
import { loadLifetimeXp } from '$lib/features/leaderboard/leaderboard.server';
import type { PageServerLoad } from './$types';

/** Calls the quiz service directly, like the attempt page, to skip an internal API hop. */
export const load: PageServerLoad = async ({ locals, params }) => {
	try {
		const learner = requireLearner(locals.user);
		const attemptId = parsePublicId(params.publicId, 'attemptId');
		const result = (await getCompletedResult(
			locals.db,
			attemptId,
			learner.id,
			new Date()
		)) as QuizResult;

		/*
		 * Lifetime XP including this sitting, so the page can tell whether it crossed a level.
		 * Subtracting what this attempt awarded gives the "before" figure, which is exact and
		 * stays correct if the page is reopened a week later — no extra column needed.
		 */
		const lifetimeXp = await loadLifetimeXp(locals.db, learner.id);

		return { result, lifetimeXp };
	} catch (cause) {
		if (cause instanceof ApiProblem) {
			if (cause.code === 'result_not_ready') {
				redirect(303, `/quiz/attempt/${params.publicId}`);
			}
			if (cause.code === 'attempt_abandoned') {
				redirect(303, '/home');
			}
		}
		toPageError(cause);
	}
};
