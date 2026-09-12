import { json } from '@sveltejs/kit';

import { JLPT_LEVELS, USER_ROLES, USER_STATUS } from '$lib/domain/enums';
import {
	apiEndpoint,
	apiProblem,
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
	parseProvisionedUserBody,
	toUserDto,
	USER_CREATE_FIELDS
} from '$lib/features/admin/users/api.server';
import { createProvisionedUser, listUsers } from '$lib/features/admin/users/users.server';
import type { RequestHandler } from './$types';

const QUERY_PARAMS = ['search', 'level', 'role', 'status', 'page', 'limit'] as const;

export const GET: RequestHandler = async ({ locals, request, url }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		assertKnownQueryParams(url.searchParams, QUERY_PARAMS);
		assertNoDuplicateParams(url.searchParams, QUERY_PARAMS);

		const search = url.searchParams.get('search')?.trim() || undefined;
		const page = await listUsers(locals.db, {
			search,
			level: parseEnumQuery(url.searchParams.get('level'), JLPT_LEVELS, 'level'),
			role: parseEnumQuery(url.searchParams.get('role'), USER_ROLES, 'role'),
			status: parseEnumQuery(url.searchParams.get('status'), USER_STATUS, 'status'),
			page: parsePageNumber(url.searchParams.get('page')),
			limit: parseLimit(url.searchParams.get('limit'))
		});

		return json({
			data: page.items.map(toUserDto),
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
		const actor = requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const body = await readJsonObject(request);
		assertKnownFields(body, USER_CREATE_FIELDS);
		const input = parseProvisionedUserBody(body);
		const result = await createProvisionedUser(locals.db, input);

		if (!result.ok) {
			apiProblem(409, 'email_conflict', 'Email already exists', result.message);
		}

		await recordAudit(locals.db, {
			actorUserId: actor.id,
			action: 'USER_CREATED',
			entityType: 'user',
			entityId: result.value.id,
			after: input
		});

		return json(
			{ data: { id: result.value.publicId } },
			{
				status: 201,
				headers: { location: `/api/v1/admin/users/${result.value.publicId}` }
			}
		);
	});
