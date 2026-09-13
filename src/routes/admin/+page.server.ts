import { getOverview } from '$lib/features/admin/overview.server';
import { listAuditLogs } from '$lib/features/admin/audit.server';
import type { PageServerLoad } from './$types';

/** The dashboard's headline numbers and recent activity. `/admin/+layout.server.ts` has already authorized. */
export const load: PageServerLoad = async ({ locals }) => {
	const overview = await getOverview(locals.db);
	const recentActivity = await listAuditLogs(locals.db, { limit: 4 });
	return { overview, recentActivity: recentActivity.items };
};
