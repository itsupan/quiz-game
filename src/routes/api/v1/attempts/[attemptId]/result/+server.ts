import { json } from '@sveltejs/kit';

import { apiEndpoint, parsePublicId, requireLearner } from '$lib/features/quiz/api/http.server';
import { getAttemptResult } from '$lib/features/quiz/api/quiz-api.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, request }) =>
	apiEndpoint(request, async () => {
		const user = requireLearner(locals.user);
		const attemptId = parsePublicId(params.attemptId, 'attemptId');

		return json({ data: await getAttemptResult(locals.db, attemptId, user.id, new Date()) });
	});
