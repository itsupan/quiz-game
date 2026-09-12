import { json } from '@sveltejs/kit';

import { JLPT_LEVELS, QUIZ_MODES, SECTIONS } from '$lib/domain/enums';
import {
	apiEndpoint,
	assertKnownQueryParams,
	parseEnumQuery,
	parseLimit,
	parsePublicId,
	requireLearner
} from '$lib/features/quiz/api/http.server';
import { listPublishedQuizzes } from '$lib/features/quiz/api/quiz-api.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, request, url }) =>
	apiEndpoint(request, async () => {
		requireLearner(locals.user);
		assertKnownQueryParams(url.searchParams, ['level', 'mode', 'section', 'cursor', 'limit']);

		const cursorValue = url.searchParams.get('cursor');
		const cursor = cursorValue === null ? undefined : parsePublicId(cursorValue, 'cursor');
		const page = await listPublishedQuizzes(locals.db, {
			level: parseEnumQuery(url.searchParams.get('level'), JLPT_LEVELS, 'level'),
			mode: parseEnumQuery(url.searchParams.get('mode'), QUIZ_MODES, 'mode'),
			section: parseEnumQuery(url.searchParams.get('section'), SECTIONS, 'section'),
			cursor,
			limit: parseLimit(url.searchParams.get('limit'))
		});

		return json({ data: page.items, page: { nextCursor: page.nextCursor } });
	});
