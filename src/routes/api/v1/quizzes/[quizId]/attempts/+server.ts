import { json } from '@sveltejs/kit';

import {
	apiEndpoint,
	assertSameOrigin,
	parseIdempotencyKey,
	parsePublicId,
	requireLearner
} from '$lib/features/quiz/api/http.server';
import { createAttempt } from '$lib/features/quiz/api/quiz-api.server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		assertSameOrigin(request, url);
		const user = requireLearner(locals.user);
		const quizId = parsePublicId(params.quizId, 'quizId');
		const idempotencyKey = parseIdempotencyKey(request);
		const started = await createAttempt(locals.db, quizId, user.id, idempotencyKey, new Date());
		const location = `/api/v1/attempts/${started.attemptId}`;

		return json(
			{ data: { id: started.attemptId, status: 'IN_PROGRESS', links: { self: location } } },
			{ status: started.created ? 201 : 200, headers: { location } }
		);
	});
