import { json } from '@sveltejs/kit';

import {
	apiEndpoint,
	assertSameOrigin,
	parsePublicId,
	requireLearner
} from '$lib/features/quiz/api/http.server';
import { submitAttempt } from '$lib/features/quiz/api/quiz-api.server';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		assertSameOrigin(request, url);
		const user = requireLearner(locals.user);
		const attemptId = parsePublicId(params.attemptId, 'attemptId');
		const result = await submitAttempt(locals.db, attemptId, user.id, new Date());
		const location = `/api/v1/attempts/${attemptId}/result`;

		return json({ data: result }, { headers: { location } });
	});
