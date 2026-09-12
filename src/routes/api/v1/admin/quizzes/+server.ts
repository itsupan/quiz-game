import { json } from '@sveltejs/kit';

import {
	apiEndpoint,
	assertKnownFields,
	assertKnownQueryParams,
	assertNoDuplicateParams,
	assertSameOrigin,
	parseEnumQuery,
	parseLimit,
	parsePageNumber,
	readJsonObject,
	requireAdmin
} from '$lib/features/admin/api/http.server';
import { CONTENT_STATUS, JLPT_LEVELS, QUIZ_MODES, SECTIONS } from '$lib/domain/enums';
import { toQuizListItemDto } from '$lib/features/quiz/admin/api-dto';
import { parseQuizCreateBody, QUIZ_BODY_FIELDS } from '$lib/features/quiz/admin/api-validation';
import { createQuiz, listQuizzes } from '$lib/features/quiz/admin/quizzes.server';
import type { RequestHandler } from './$types';

const QUERY_PARAMS = ['status', 'level', 'mode', 'section', 'sort', 'page', 'limit'] as const;
const SORTS = ['newest', 'oldest'] as const;

export const GET: RequestHandler = async ({ locals, request, url }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		assertKnownQueryParams(url.searchParams, QUERY_PARAMS);
		assertNoDuplicateParams(url.searchParams, QUERY_PARAMS);

		const page = await listQuizzes(locals.db, {
			status: parseEnumQuery(url.searchParams.get('status'), CONTENT_STATUS, 'status'),
			level: parseEnumQuery(url.searchParams.get('level'), JLPT_LEVELS, 'level'),
			mode: parseEnumQuery(url.searchParams.get('mode'), QUIZ_MODES, 'mode'),
			section: parseEnumQuery(url.searchParams.get('section'), SECTIONS, 'section'),
			sort: parseEnumQuery(url.searchParams.get('sort'), SORTS, 'sort'),
			page: parsePageNumber(url.searchParams.get('page')),
			limit: parseLimit(url.searchParams.get('limit'))
		});

		return json({
			data: page.items.map(toQuizListItemDto),
			page: {
				number: page.page,
				size: page.items.length,
				total: page.total,
				totalPages: page.pageCount
			}
		});
	});

export const POST: RequestHandler = async ({ locals, request, url }) =>
	apiEndpoint(request, async () => {
		const user = requireAdmin(locals.user);
		assertSameOrigin(request, url);

		const body = await readJsonObject(request);
		assertKnownFields(body, QUIZ_BODY_FIELDS);
		const input = parseQuizCreateBody(body);

		const publicId = await createQuiz(locals.db, user.id, input);

		return json(
			{ data: { id: publicId } },
			{ status: 201, headers: { location: `/api/v1/admin/quizzes/${publicId}` } }
		);
	});
