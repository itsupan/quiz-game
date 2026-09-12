import { json } from '@sveltejs/kit';

import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '$lib/server/db/schema';
import {
	apiEndpoint,
	assertKnownQueryParams,
	assertNoDuplicateParams,
	parseEnumQuery,
	parseLimit,
	parsePageNumber,
	requireAdmin
} from '$lib/features/admin/api/http.server';
import { listAuditLogs } from '$lib/features/admin/audit.server';
import type { RequestHandler } from './$types';

const QUERY_PARAMS = ['action', 'entityType', 'page', 'limit'] as const;

export const GET: RequestHandler = async ({ locals, request, url }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		assertKnownQueryParams(url.searchParams, QUERY_PARAMS);
		assertNoDuplicateParams(url.searchParams, QUERY_PARAMS);

		const page = await listAuditLogs(locals.db, {
			action: parseEnumQuery(url.searchParams.get('action'), AUDIT_ACTIONS, 'action'),
			entityType: parseEnumQuery(
				url.searchParams.get('entityType'),
				AUDIT_ENTITY_TYPES,
				'entityType'
			),
			page: parsePageNumber(url.searchParams.get('page')),
			limit: parseLimit(url.searchParams.get('limit'))
		});

		return json({
			data: page.items.map((entry) => ({
				action: entry.action,
				actor: entry.actorId ? { id: entry.actorId, displayName: entry.actorName } : null,
				entity: {
					id: entry.entityPublicId,
					type: entry.entityType,
					label: entry.entityLabel
				},
				before: entry.before,
				after: entry.after,
				createdAt: entry.createdAt.toISOString()
			})),
			page: {
				number: page.page,
				size: page.items.length,
				total: page.total,
				totalPages: page.pageCount
			}
		});
	});
