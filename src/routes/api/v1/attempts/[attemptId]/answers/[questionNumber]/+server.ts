import { json } from '@sveltejs/kit';

import {
	apiEndpoint,
	assertSameOrigin,
	parseAnswerBody,
	parsePublicId,
	parseQuestionNumber,
	readJsonObject,
	requireLearner
} from '$lib/features/quiz/api/http.server';
import { putAttemptAnswer } from '$lib/features/quiz/api/quiz-api.server';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		assertSameOrigin(request, url);
		const user = requireLearner(locals.user);
		const attemptId = parsePublicId(params.attemptId, 'attemptId');
		const questionNumber = parseQuestionNumber(params.questionNumber);
		const selectedOptionNumber = parseAnswerBody(await readJsonObject(request));

		return json({
			data: await putAttemptAnswer(
				locals.db,
				attemptId,
				questionNumber,
				selectedOptionNumber,
				user.id,
				new Date()
			)
		});
	});
