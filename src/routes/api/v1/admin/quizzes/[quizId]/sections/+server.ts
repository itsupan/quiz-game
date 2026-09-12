import { json } from '@sveltejs/kit';

import {
	apiEndpoint,
	apiProblem,
	assertKnownFields,
	assertSameOrigin,
	parsePublicId,
	readJsonObject,
	requireAdmin
} from '$lib/features/admin/api/http.server';
import { requireQuizDetail } from '$lib/features/quiz/admin/api-detail.server';
import {
	parseQuizSectionCreateBody,
	QUIZ_SECTION_BODY_FIELDS
} from '$lib/features/quiz/admin/api-validation';
import { upsertSection } from '$lib/features/quiz/admin/quizzes.server';
import type { RequestHandler } from './$types';

export const POST: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const quizId = parsePublicId(params.quizId, 'quizId');
		const found = await requireQuizDetail(locals.db, quizId);

		const body = await readJsonObject(request);
		assertKnownFields(body, QUIZ_SECTION_BODY_FIELDS);
		const input = parseQuizSectionCreateBody(body, found.quiz.selectionMode);

		const written = await upsertSection(locals.db, found.quiz.id, null, input);
		if (!written.ok) {
			apiProblem(409, 'section_conflict', 'Conflict', written.message);
		}

		return json(
			{ data: { section: input.section } },
			{
				status: 201,
				headers: { location: `/api/v1/admin/quizzes/${quizId}/sections/${input.section}` }
			}
		);
	});
