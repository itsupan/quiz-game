import { apiProblem } from '$lib/features/admin/api/http.server';
import type { Database } from '$lib/server/db';
import { toQuestionDetailDto } from './api.server';
import { groupPublishBlockers } from './groups-validation';
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

/** The attached group's own readiness, in the shape `questionPublishBlockers` expects. */
export function questionGroupStatus(found: Awaited<ReturnType<typeof requireQuestionDetail>>) {
	const { group, groupImage, groupAudio } = found;
	if (!group) return null;

	return {
		status: group.status,
		blockers: groupPublishBlockers(
			{ format: group.format, body: group.passageText, exampleText: group.exampleText },
			{ image: groupImage, audio: groupAudio }
		)
	};
}

export function questionDetailDto(found: Awaited<ReturnType<typeof requireQuestionDetail>>) {
	const { question, options, image, audio, group } = found;

	return toQuestionDetailDto({
		question,
		options,
		image,
		audio,
		group,
		blockers: questionPublishBlockers(
			question,
			{ image, audio },
			options,
			questionGroupStatus(found)
		)
	});
}
