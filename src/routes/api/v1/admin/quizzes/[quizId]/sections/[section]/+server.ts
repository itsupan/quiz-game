import { json } from '@sveltejs/kit';

import { SECTIONS, type Section } from '$lib/domain/enums';
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
	parseQuizSectionPatchBody,
	QUIZ_SECTION_BODY_FIELDS
} from '$lib/features/quiz/admin/api-validation';
import {
	deleteSection,
	getSectionByEnum,
	upsertSection
} from '$lib/features/quiz/admin/quizzes.server';
import type { RequestHandler } from './$types';

function parseSection(value: string): Section {
	if (!(SECTIONS as readonly string[]).includes(value)) {
		apiProblem(
			400,
			'invalid_identifier',
			'Invalid identifier',
			`section must be one of: ${SECTIONS.join(', ')}.`
		);
	}

	return value as Section;
}

async function requireSectionRow(locals: App.Locals, quizId: number, section: Section) {
	const found = await getSectionByEnum(locals.db, quizId, section);
	if (!found) {
		apiProblem(404, 'section_not_found', 'Section not found', 'This quiz has no such section.');
	}

	return found;
}

export const PATCH: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const quizId = parsePublicId(params.quizId, 'quizId');
		const section = parseSection(params.section);
		const found = await requireQuizDetail(locals.db, quizId);
		const current = await requireSectionRow(locals, found.quiz.id, section);

		const body = await readJsonObject(request);
		const patchFields = QUIZ_SECTION_BODY_FIELDS.filter((field) => field !== 'section');
		assertKnownFields(body, patchFields);
		const input = parseQuizSectionPatchBody(current, body, section, found.quiz.selectionMode);

		const written = await upsertSection(locals.db, found.quiz.id, current.id, input);
		if (!written.ok) {
			apiProblem(409, 'section_conflict', 'Conflict', written.message);
		}

		return json({
			data: {
				section: input.section,
				position: input.position,
				timeLimitSeconds: input.timeLimitSeconds,
				drawCount: input.drawCount
			}
		});
	});

export const DELETE: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const quizId = parsePublicId(params.quizId, 'quizId');
		const section = parseSection(params.section);
		const found = await requireQuizDetail(locals.db, quizId);
		const current = await requireSectionRow(locals, found.quiz.id, section);

		const removed = await deleteSection(locals.db, found.quiz.id, current.id);
		if (!removed.ok) {
			apiProblem(409, 'section_in_use', 'Conflict', removed.message);
		}

		return new Response(null, { status: 204 });
	});
