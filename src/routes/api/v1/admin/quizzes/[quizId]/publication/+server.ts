import { json } from '@sveltejs/kit';

import {
	apiEndpoint,
	apiProblem,
	assertSameOrigin,
	parsePublicId,
	requireAdmin
} from '$lib/features/admin/api/http.server';
import { recordAudit } from '$lib/features/admin/audit.server';
import { quizDetailDto, requireQuizDetail } from '$lib/features/quiz/admin/api-detail.server';
import { quizPublishBlockersFor, setQuizStatus } from '$lib/features/quiz/admin/quizzes.server';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		const user = requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const quizId = parsePublicId(params.quizId, 'quizId');
		const found = await requireQuizDetail(locals.db, quizId);
		const blockers = await quizPublishBlockersFor(locals.db, found.quiz, found.sections);

		if (blockers.length > 0) {
			apiProblem(
				409,
				'publish_blocked',
				'Cannot publish',
				'This quiz is not ready to publish.',
				blockers.map((message) => ({ field: 'quiz', message }))
			);
		}

		await setQuizStatus(locals.db, found.quiz, 'PUBLISHED');
		await recordAudit(locals.db, {
			actorUserId: user.id,
			action: 'QUIZ_PUBLISHED',
			entityType: 'quiz',
			entityId: found.quiz.id,
			before: { status: found.quiz.status },
			after: { status: 'PUBLISHED' }
		});

		const updated = await requireQuizDetail(locals.db, quizId);
		return json({ data: await quizDetailDto(locals.db, updated) });
	});

export const DELETE: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		const user = requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const quizId = parsePublicId(params.quizId, 'quizId');
		const found = await requireQuizDetail(locals.db, quizId);

		await setQuizStatus(locals.db, found.quiz, 'ARCHIVED');
		await recordAudit(locals.db, {
			actorUserId: user.id,
			action: 'QUIZ_ARCHIVED',
			entityType: 'quiz',
			entityId: found.quiz.id,
			before: { status: found.quiz.status },
			after: { status: 'ARCHIVED' }
		});

		const updated = await requireQuizDetail(locals.db, quizId);
		return json({ data: await quizDetailDto(locals.db, updated) });
	});
