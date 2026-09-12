import {
	apiEndpoint,
	apiProblem,
	assertSameOrigin,
	parsePublicId,
	requireAdmin
} from '$lib/features/admin/api/http.server';
import { requireQuizDetail } from '$lib/features/quiz/admin/api-detail.server';
import { detachQuestion, findAttachedQuestion } from '$lib/features/quiz/admin/quizzes.server';
import { getQuestionRefByPublicId } from '$lib/features/questions/questions.server';
import type { RequestHandler } from './$types';

export const DELETE: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const quizId = parsePublicId(params.quizId, 'quizId');
		const questionId = parsePublicId(params.questionId, 'questionId');
		const { quiz } = await requireQuizDetail(locals.db, quizId);

		const question = await getQuestionRefByPublicId(locals.db, questionId);
		if (!question) {
			apiProblem(404, 'question_not_found', 'Question not found', 'That question does not exist.');
		}

		const attached = await findAttachedQuestion(locals.db, quiz.id, question.id);
		if (!attached) {
			apiProblem(404, 'not_attached', 'Not attached', 'That question is not on this paper.');
		}

		const removed = await detachQuestion(locals.db, quiz.id, attached.id);
		if (!removed.ok) {
			apiProblem(409, 'detach_conflict', 'Conflict', removed.message);
		}

		return new Response(null, { status: 204 });
	});
