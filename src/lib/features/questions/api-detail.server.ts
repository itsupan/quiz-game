import { apiProblem } from '$lib/features/admin/api/http.server';
import type { Database } from '$lib/server/db';
import { toQuestionDetailDto } from './api.server';
import { getQuestion } from './questions.server';
import { questionPublishBlockers } from './validation';

/**
 * The question detail load, shared by the read, update and publish/archive endpoints so
 * they can never disagree about a question's options or publish blockers.
 */
export async function requireQuestionDetail(db: Database, questionId: string) {
	const found = await getQuestion(db, questionId);
	if (!found) {
		apiProblem(404, 'question_not_found', 'Question not found', 'That question does not exist.');
	}

	return found;
}

export function questionDetailDto(found: Awaited<ReturnType<typeof requireQuestionDetail>>) {
	const { question, options, image, audio } = found;
	return toQuestionDetailDto({
		question,
		options,
		image,
		audio,
		blockers: questionPublishBlockers(question, { image, audio }, options)
	});
}
