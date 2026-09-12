import { json } from '@sveltejs/kit';

import {
	apiEndpoint,
	assertKnownFields,
	assertSameOrigin,
	parsePublicId,
	readJsonObject,
	requireAdmin
} from '$lib/features/admin/api/http.server';
import { quizDetailDto, requireQuizDetail } from '$lib/features/quiz/admin/api-detail.server';
import { QUIZ_BODY_FIELDS, parseQuizPatchBody } from '$lib/features/quiz/admin/api-validation';
import { updateQuiz } from '$lib/features/quiz/admin/quizzes.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, request }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		const quizId = parsePublicId(params.quizId, 'quizId');
		const found = await requireQuizDetail(locals.db, quizId);

		return json({ data: await quizDetailDto(locals.db, found) });
	});

export const PATCH: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const quizId = parsePublicId(params.quizId, 'quizId');
		const found = await requireQuizDetail(locals.db, quizId);

		const body = await readJsonObject(request);
		assertKnownFields(body, QUIZ_BODY_FIELDS);
		const input = parseQuizPatchBody(
			{
				title: found.quiz.title,
				description: found.quiz.description,
				mode: found.quiz.mode,
				level: found.quiz.level,
				selectionMode: found.quiz.selectionMode,
				icon: found.quiz.icon,
				timeLimitSeconds: found.quiz.timeLimitSeconds,
				showStudyAidsDuringAttempt: found.quiz.showStudyAidsDuringAttempt,
				xpReward: found.quiz.xpReward
			},
			body
		);

		await updateQuiz(locals.db, found.quiz.id, input);
		const updated = await requireQuizDetail(locals.db, quizId);

		return json({ data: await quizDetailDto(locals.db, updated) });
	});
