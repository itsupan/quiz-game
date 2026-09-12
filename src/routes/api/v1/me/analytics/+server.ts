import { json } from '@sveltejs/kit';

import { parsePeriod, parseTimezone } from '$lib/features/analytics/api.server';
import { loadAnalyticsOverview } from '$lib/features/analytics/analytics.server';
import {
	apiEndpoint,
	assertKnownQueryParams,
	assertNoDuplicateParams,
	requireLearner
} from '$lib/features/quiz/api/http.server';
import type { RequestHandler } from './$types';

const QUERY_PARAMS = ['period', 'timezone'] as const;

export const GET: RequestHandler = async ({ locals, request, url }) =>
	apiEndpoint(request, async () => {
		const learner = requireLearner(locals.user);
		assertKnownQueryParams(url.searchParams, QUERY_PARAMS);
		assertNoDuplicateParams(url.searchParams, QUERY_PARAMS);
		parsePeriod(url.searchParams.get('period'));
		const timezone = parseTimezone(url.searchParams.get('timezone'));
		const overview = await loadAnalyticsOverview(locals.db, learner.id, new Date(), timezone);

		return json({
			data: overview,
			links: {
				self: `/api/v1/me/analytics?period=week&timezone=${encodeURIComponent(timezone)}`,
				exams: '/api/v1/me/exam-attempts'
			}
		});
	});
