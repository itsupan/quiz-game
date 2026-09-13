import { loadDashboardStreak, loadWeeklyActivity } from '$lib/features/dashboard/dashboard.server';
import type { DashboardQuiz } from '$lib/features/dashboard/dashboard';
import { readApiResponse } from '$lib/features/quiz/api/client';
import type { ApiPage, QuizSummary } from '$lib/features/quiz/api/types';
import type { PageServerLoad } from './$types';

/** The catalog endpoint pages results; the dashboard shows the whole catalog, so keep paging. */
async function loadAllQuizzes(fetch: typeof globalThis.fetch): Promise<QuizSummary[]> {
	const quizzes: QuizSummary[] = [];
	let cursor: string | null = null;
	do {
		const params = cursor ? `?limit=50&cursor=${encodeURIComponent(cursor)}` : '?limit=50';
		const page: ApiPage<QuizSummary[]> = await readApiResponse(fetch(`/api/v1/quizzes${params}`));
		quizzes.push(...page.data);
		cursor = page.page.nextCursor;
	} while (cursor !== null);
	return quizzes;
}

export const load: PageServerLoad = async ({ fetch, locals }) => {
	const now = new Date();
	const [apiQuizzes, streakDays, weeklyActivity] = await Promise.all([
		loadAllQuizzes(fetch),
		loadDashboardStreak(locals.db, locals.user!.id, now),
		loadWeeklyActivity(locals.db, locals.user!.id, now)
	]);
	const quizzes: DashboardQuiz[] = apiQuizzes.map(({ id, ...quiz }) => ({
		...quiz,
		publicId: id
	}));

	return { quizzes, streakDays, weeklyActivity };
};
