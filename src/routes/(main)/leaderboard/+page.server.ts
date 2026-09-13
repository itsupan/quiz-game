import type { LeaderboardEntry } from '$lib/features/leaderboard/leaderboard';
import { readApiResponse } from '$lib/features/quiz/api/client';
import type { ApiPage } from '$lib/features/quiz/api/types';
import type { PageServerLoad } from './$types';

const PAGE_SIZE = 20;

export const load: PageServerLoad = async ({ fetch }) => {
	const response = await readApiResponse<ApiPage<LeaderboardEntry[]>>(
		fetch(`/api/v1/leaderboard?limit=${PAGE_SIZE}`)
	);

	return { entries: response.data, nextCursor: response.page.nextCursor };
};
