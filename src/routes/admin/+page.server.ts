import { getOverview } from '$lib/features/admin/overview.server';
import type { PageServerLoad } from './$types';

/** The dashboard's headline numbers. `/admin/+layout.server.ts` has already authorized. */
export const load: PageServerLoad = async ({ locals }) => {
	return { overview: await getOverview(locals.db) };
};
