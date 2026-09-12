import { apiProblem } from '$lib/features/admin/api/http.server';
import type { Database } from '$lib/server/db';
import { toQuizDetailDto } from './api-dto';
import {
	getQuiz,
	listAttachableQuestions,
	listAttachedQuestions,
	quizPublishBlockersFor,
	sectionPublishCounts
} from './quizzes.server';

/**
 * The quiz detail load, shared by the read endpoint, the update endpoint (which returns
 * the updated resource), and the publish/archive endpoints (same reason) — assembled once
 * so all four can never disagree about a quiz's sections, blockers, or attached questions.
 */
export async function requireQuizDetail(db: Database, quizId: string) {
	const found = await getQuiz(db, quizId);
	if (!found) {
		apiProblem(404, 'quiz_not_found', 'Quiz not found', 'That quiz does not exist.');
	}

	return found;
}

export async function quizDetailDto(
	db: Database,
	found: Awaited<ReturnType<typeof requireQuizDetail>>
) {
	const { quiz, sections } = found;
	const counts = await sectionPublishCounts(db, quiz, sections);
	const blockers = await quizPublishBlockersFor(db, quiz, sections);
	const attached = quiz.selectionMode === 'FIXED' ? await listAttachedQuestions(db, quiz.id) : [];
	const attachable =
		quiz.selectionMode === 'FIXED' ? await listAttachableQuestions(db, quiz, sections) : {};

	return toQuizDetailDto({ quiz, sections, counts, attached, attachable, blockers });
}
