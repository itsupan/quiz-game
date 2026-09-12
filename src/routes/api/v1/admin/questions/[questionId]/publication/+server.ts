import { json } from '@sveltejs/kit';

import {
	apiEndpoint,
	apiProblem,
	assertSameOrigin,
	parsePublicId,
	requireAdmin
} from '$lib/features/admin/api/http.server';
import { recordAudit } from '$lib/features/admin/audit.server';
import {
	questionDetailDto,
	requireQuestionDetail
} from '$lib/features/questions/api-detail.server';
import { setQuestionStatus } from '$lib/features/questions/questions.server';
import { questionPublishBlockers } from '$lib/features/questions/validation';
import type { RequestHandler } from './$types';

export const PUT: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		const user = requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const questionId = parsePublicId(params.questionId, 'questionId');
		const found = await requireQuestionDetail(locals.db, questionId);
		const blockers = questionPublishBlockers(
			found.question,
			{ image: found.image, audio: found.audio },
			found.options
		);

		if (blockers.length > 0) {
			apiProblem(
				409,
				'publish_blocked',
				'Cannot publish',
				'This question is not ready to publish.',
				blockers.map((message) => ({ field: 'question', message }))
			);
		}

		await setQuestionStatus(locals.db, found.question.id, 'PUBLISHED');
		await recordAudit(locals.db, {
			actorUserId: user.id,
			action: 'QUESTION_PUBLISHED',
			entityType: 'question',
			entityId: found.question.id,
			before: { status: found.question.status },
			after: { status: 'PUBLISHED' }
		});

		const updated = await requireQuestionDetail(locals.db, questionId);
		return json({ data: questionDetailDto(updated) });
	});

export const DELETE: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		const user = requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const questionId = parsePublicId(params.questionId, 'questionId');
		const found = await requireQuestionDetail(locals.db, questionId);

		await setQuestionStatus(locals.db, found.question.id, 'ARCHIVED');
		await recordAudit(locals.db, {
			actorUserId: user.id,
			action: 'QUESTION_ARCHIVED',
			entityType: 'question',
			entityId: found.question.id,
			before: { status: found.question.status },
			after: { status: 'ARCHIVED' }
		});

		const updated = await requireQuestionDetail(locals.db, questionId);
		return json({ data: questionDetailDto(updated) });
	});
