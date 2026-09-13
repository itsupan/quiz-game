import type { loadAnalyticsOverview } from '$lib/features/analytics/analytics.server';
import { readApiData } from '$lib/features/quiz/api/client';
import type { PageServerLoad } from './$types';

/**
 * The API serializes exactly what `loadAnalyticsOverview` returns, so its own return type is
 * the single source of truth here rather than a hand-duplicated copy that can drift.
 */
type AnalyticsOverview = Awaited<ReturnType<typeof loadAnalyticsOverview>>;

export const load: PageServerLoad = async ({ fetch }) => {
	const overview = await readApiData<AnalyticsOverview>(
		fetch('/api/v1/me/analytics?period=week&timezone=UTC')
	);

	return { overview };
};
