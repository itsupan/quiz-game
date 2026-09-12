import { json } from '@sveltejs/kit';

import { parseExamAttemptCursor, parseExamResult } from '$lib/features/analytics/api.server';
import { listExamAttempts } from '$lib/features/analytics/analytics.server';
import { JLPT_LEVELS } from '$lib/domain/enums';
import {
	apiEndpoint,
	assertKnownQueryParams,
	assertNoDuplicateParams,
	parseEnumQuery,
	parseLimit,
	requireLearner
} from '$lib/features/quiz/api/http.server';
import type { RequestHandler } from './$types';

const QUERY_PARAMS = ['level', 'result', 'cursor', 'limit'] as const;

export const GET: RequestHandler = async ({ locals, request, url }) =>
	apiEndpoint(request, async () => {
		const learner = requireLearner(locals.user);
		assertKnownQueryParams(url.searchParams, QUERY_PARAMS);
		assertNoDuplicateParams(url.searchParams, QUERY_PARAMS);
		const page = await listExamAttempts(locals.db, learner.id, {
			level: parseEnumQuery(url.searchParams.get('level'), JLPT_LEVELS, 'level'),
			result: parseExamResult(url.searchParams.get('result')),
			cursor: parseExamAttemptCursor(url.searchParams.get('cursor')),
			limit: parseLimit(url.searchParams.get('limit'))
		});

		return json({
			data: page.items,
			page: { nextCursor: page.nextCursor }
		});
	});
