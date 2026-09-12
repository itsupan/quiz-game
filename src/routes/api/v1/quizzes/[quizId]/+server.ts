import { json } from '@sveltejs/kit';

import { apiEndpoint, parsePublicId, requireLearner } from '$lib/features/quiz/api/http.server';
import { getPublishedQuiz } from '$lib/features/quiz/api/quiz-api.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, request }) =>
	apiEndpoint(request, async () => {
		requireLearner(locals.user);
		const quizId = parsePublicId(params.quizId, 'quizId');

		return json({ data: await getPublishedQuiz(locals.db, quizId) });
	});
