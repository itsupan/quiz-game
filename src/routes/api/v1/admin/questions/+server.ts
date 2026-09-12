import { json } from '@sveltejs/kit';

import { CONTENT_STATUS, JLPT_LEVELS, SECTIONS } from '$lib/domain/enums';
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
import {
	QUESTION_BODY_FIELDS,
	parseQuestionCreateBody,
	toQuestionListItemDto
} from '$lib/features/questions/api.server';
import { createQuestion, listQuestions } from '$lib/features/questions/questions.server';
import type { RequestHandler } from './$types';

const QUERY_PARAMS = ['level', 'section', 'status', 'page', 'limit'] as const;

export const GET: RequestHandler = async ({ locals, request, url }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		assertKnownQueryParams(url.searchParams, QUERY_PARAMS);
		assertNoDuplicateParams(url.searchParams, QUERY_PARAMS);

		const page = await listQuestions(locals.db, {
			level: parseEnumQuery(url.searchParams.get('level'), JLPT_LEVELS, 'level'),
			section: parseEnumQuery(url.searchParams.get('section'), SECTIONS, 'section'),
			status: parseEnumQuery(url.searchParams.get('status'), CONTENT_STATUS, 'status'),
			page: parsePageNumber(url.searchParams.get('page')),
			limit: parseLimit(url.searchParams.get('limit'))
		});

		return json({
			data: page.items.map(toQuestionListItemDto),
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
		assertKnownFields(body, QUESTION_BODY_FIELDS);
		const input = await parseQuestionCreateBody(locals.db, body);

		const created = await createQuestion(locals.db, user.id, input);
		if (!created.ok) {
			// createQuestion() only fails today on causes checkMediaSlots would have already
			// caught; this branch exists so a future failure path is a 409, not a 500.
			throw new Error(created.message);
		}

		return json(
			{ data: { id: created.value } },
			{ status: 201, headers: { location: `/api/v1/admin/questions/${created.value}` } }
		);
	});
