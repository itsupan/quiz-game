import { redirect } from '@sveltejs/kit';

import { ApiProblem, parsePublicId, requireLearner } from '$lib/features/quiz/api/http.server';
import { toPageError } from '$lib/features/quiz/api/page-errors.server';
import { getCompletedResult } from '$lib/features/quiz/api/quiz-api.server';
import type { QuizResult } from '$lib/features/quiz/api/types';
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

		return { result };
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
