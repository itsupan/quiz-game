import { json } from '@sveltejs/kit';

import {
	apiEndpoint,
	assertKnownQueryParams,
	requireAdmin
} from '$lib/features/admin/api/http.server';
import { listAuditLogs } from '$lib/features/admin/audit.server';
import { getOverview } from '$lib/features/admin/overview.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, request, url }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		assertKnownQueryParams(url.searchParams, []);

		const [overview, activity] = await Promise.all([
			getOverview(locals.db),
			listAuditLogs(locals.db, { page: 1, limit: 5 })
		]);

		return json({
			data: {
				students: {
					total: overview.users.total - overview.users.admins,
					suspendedAccounts: overview.users.suspended
				},
				quizzes: {
					total: overview.quizzes.total,
					active: overview.quizzes.published,
					draft: overview.quizzes.draft
				},
				questions: overview.questions,
				attempts: overview.attempts,
				recentActivity: activity.items.map((entry) => ({
					action: entry.action,
					actor: entry.actorId ? { id: entry.actorId, displayName: entry.actorName } : null,
					entity: {
						id: entry.entityPublicId,
						type: entry.entityType,
						label: entry.entityLabel
					},
					createdAt: entry.createdAt.toISOString()
				})),
				health: { status: 'OPERATIONAL', database: 'CONNECTED' }
			}
		});
	});
