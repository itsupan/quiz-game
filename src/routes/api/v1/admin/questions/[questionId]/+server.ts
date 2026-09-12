import { json } from '@sveltejs/kit';

import {
	apiEndpoint,
	assertKnownFields,
	assertSameOrigin,
	apiProblem,
	parsePublicId,
	readJsonObject,
	requireAdmin
} from '$lib/features/admin/api/http.server';
import {
	questionDetailDto,
	requireQuestionDetail
} from '$lib/features/questions/api-detail.server';
import {
	QUESTION_BODY_FIELDS,
	currentQuestionFrom,
	parseQuestionPatchBody
} from '$lib/features/questions/api.server';
import { updateQuestion } from '$lib/features/questions/questions.server';
import type { RequestHandler } from './$types';

export const GET: RequestHandler = async ({ locals, params, request }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		const questionId = parsePublicId(params.questionId, 'questionId');
		const found = await requireQuestionDetail(locals.db, questionId);

		return json({ data: questionDetailDto(found) });
	});

export const PATCH: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const questionId = parsePublicId(params.questionId, 'questionId');
		const found = await requireQuestionDetail(locals.db, questionId);

		const body = await readJsonObject(request);
		assertKnownFields(body, QUESTION_BODY_FIELDS);
		const input = await parseQuestionPatchBody(
			locals.db,
			currentQuestionFrom(found.question, found.image, found.audio),
			found.options,
			body
		);

		const written = await updateQuestion(locals.db, found.question.id, input);
		if (!written.ok) {
			apiProblem(409, 'update_conflict', 'Conflict', written.message);
		}

		const updated = await requireQuestionDetail(locals.db, questionId);
		return json({ data: questionDetailDto(updated) });
	});
