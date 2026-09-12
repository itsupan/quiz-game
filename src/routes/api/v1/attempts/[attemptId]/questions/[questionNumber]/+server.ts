import { json } from '@sveltejs/kit';

import {
	apiEndpoint,
	parsePublicId,
	parseQuestionNumber,
	requireLearner
} from '$lib/features/quiz/api/http.server';
import { getAttemptQuestion } from '$lib/features/quiz/api/quiz-api.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, request }) =>
	apiEndpoint(request, async () => {
		const user = requireLearner(locals.user);
		const attemptId = parsePublicId(params.attemptId, 'attemptId');
		const questionNumber = parseQuestionNumber(params.questionNumber);

		return json({
			data: await getAttemptQuestion(locals.db, attemptId, questionNumber, user.id, new Date())
		});
	});
