import { json } from '@sveltejs/kit';

import { parseLeaderboardCursor } from '$lib/features/leaderboard/api.server';
import { listLeaderboard } from '$lib/features/leaderboard/leaderboard.server';
import {
	apiEndpoint,
	assertKnownQueryParams,
	assertNoDuplicateParams,
	parseLimit,
	requireLearner
} from '$lib/features/quiz/api/http.server';
import type { RequestHandler } from './$types';

const QUERY_PARAMS = ['cursor', 'limit'] as const;

export const GET: RequestHandler = async ({ locals, request, url }) =>
	apiEndpoint(request, async () => {
		requireLearner(locals.user);
		assertKnownQueryParams(url.searchParams, QUERY_PARAMS);
		assertNoDuplicateParams(url.searchParams, QUERY_PARAMS);
		const page = await listLeaderboard(
			locals.db,
			{
				cursor: parseLeaderboardCursor(url.searchParams.get('cursor')),
				limit: parseLimit(url.searchParams.get('limit'))
			},
			new Date()
		);

		return json({
			data: page.items,
			page: { nextCursor: page.nextCursor }
		});
	});
