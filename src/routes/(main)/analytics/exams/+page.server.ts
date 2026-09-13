import { JLPT_LEVELS } from '$lib/domain/enums';
import {
	EXAM_RESULTS,
	type ExamAttemptSummary,
	type ExamResult
} from '$lib/features/analytics/analytics';
import { readApiResponse, toPageError } from '$lib/features/quiz/api/client';
import type { ApiPage } from '$lib/features/quiz/api/types';
import type { JlptLevel } from '$lib/domain/enums';
import type { PageServerLoad } from './$types';

function validated<T extends string>(value: string | null, allowed: readonly T[]): T | null {
	return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : null;
}

export const load: PageServerLoad = async ({ fetch, url }) => {
	const level = validated<JlptLevel>(url.searchParams.get('level'), JLPT_LEVELS);
	const result = validated<ExamResult>(url.searchParams.get('result'), EXAM_RESULTS);

	const query = new URLSearchParams();
	if (level) query.set('level', level);
	if (result) query.set('result', result);

	try {
		const page = await readApiResponse<ApiPage<ExamAttemptSummary[]>>(
			fetch(`/api/v1/me/exam-attempts?${query}`)
		);

		return { exams: page.data, nextCursor: page.page.nextCursor, level, result };
	} catch (cause) {
		toPageError(cause);
	}
};
