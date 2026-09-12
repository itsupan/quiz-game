import { loadDashboard } from '$lib/features/dashboard/dashboard.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return loadDashboard(locals.db, locals.user!.id, new Date());
};
