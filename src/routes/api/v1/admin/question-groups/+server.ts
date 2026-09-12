import { json } from '@sveltejs/kit';

import { CONTENT_STATUS, GROUP_FORMATS, JLPT_LEVELS, SECTIONS } from '$lib/domain/enums';
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
import { recordAudit } from '$lib/features/admin/audit.server';
import {
	GROUP_BODY_FIELDS,
	parseGroupCreateBody,
	toGroupListItemDto
} from '$lib/features/questions/groups-api.server';
import { createGroup, listGroups } from '$lib/features/questions/groups.server';
import type { RequestHandler } from './$types';

const QUERY_PARAMS = ['level', 'section', 'status', 'format', 'page', 'limit'] as const;

export const GET: RequestHandler = async ({ locals, request, url }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		assertKnownQueryParams(url.searchParams, QUERY_PARAMS);
		assertNoDuplicateParams(url.searchParams, QUERY_PARAMS);

		const page = await listGroups(locals.db, {
			level: parseEnumQuery(url.searchParams.get('level'), JLPT_LEVELS, 'level'),
			section: parseEnumQuery(url.searchParams.get('section'), SECTIONS, 'section'),
			status: parseEnumQuery(url.searchParams.get('status'), CONTENT_STATUS, 'status'),
			format: parseEnumQuery(url.searchParams.get('format'), GROUP_FORMATS, 'format'),
			page: parsePageNumber(url.searchParams.get('page')),
			limit: parseLimit(url.searchParams.get('limit'))
		});

		return json({
			data: page.items.map(toGroupListItemDto),
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
		assertKnownFields(body, GROUP_BODY_FIELDS);
		const input = await parseGroupCreateBody(locals.db, body);

		const created = await createGroup(locals.db, user.id, input);

		await recordAudit(locals.db, {
			actorUserId: user.id,
			action: 'QUESTION_GROUP_CREATED',
			entityType: 'question_group',
			entityId: created.id,
			after: input
		});

		return json(
			{ data: { id: created.publicId } },
			{ status: 201, headers: { location: `/api/v1/admin/question-groups/${created.publicId}` } }
		);
	});
