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
import { toAttachableDto, toAttachedQuestionDtos } from '$lib/features/quiz/admin/api-dto';
import { requireQuizDetail } from '$lib/features/quiz/admin/api-detail.server';
import {
	attachQuestion,
	getSectionByEnum,
	listAttachableQuestions,
	listAttachedQuestions
} from '$lib/features/quiz/admin/quizzes.server';
import { getQuestionRefByPublicId } from '$lib/features/questions/questions.server';
import type { RequestHandler } from './$types';

const ATTACH_BODY_FIELDS = ['questionId', 'section'] as const;

export const GET: RequestHandler = async ({ locals, params, request }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		const quizId = parsePublicId(params.quizId, 'quizId');
		const { quiz, sections } = await requireQuizDetail(locals.db, quizId);

		if (quiz.selectionMode !== 'FIXED') {
			return json({ data: { attached: [], attachable: {} } });
		}

		const attached = await listAttachedQuestions(locals.db, quiz.id);
		const attachable = await listAttachableQuestions(locals.db, quiz, sections);

		return json({
			data: {
				attached: toAttachedQuestionDtos(attached, sections),
				attachable: toAttachableDto(attachable, sections)
			}
		});
	});

export const POST: RequestHandler = async ({ locals, params, request, url }) =>
	apiEndpoint(request, async () => {
		requireAdmin(locals.user);
		assertSameOrigin(request, url);
		const quizId = parsePublicId(params.quizId, 'quizId');
		const { quiz } = await requireQuizDetail(locals.db, quizId);

		const body = await readJsonObject(request);
		assertKnownFields(body, ATTACH_BODY_FIELDS);

		const rawQuestionId = body.questionId;
		const rawSection = body.section;
		if (typeof rawQuestionId !== 'string') {
			apiProblem(422, 'validation_failed', 'Validation failed', 'questionId is required.', [
				{ field: 'questionId', message: 'questionId is required.' }
			]);
		}
		if (typeof rawSection !== 'string' || !(SECTIONS as readonly string[]).includes(rawSection)) {
			apiProblem(422, 'validation_failed', 'Validation failed', 'section is required.', [
				{ field: 'section', message: `section must be one of: ${SECTIONS.join(', ')}.` }
			]);
		}

		const questionId = parsePublicId(rawQuestionId, 'questionId');
		const section = rawSection as Section;

		const sectionRow = await getSectionByEnum(locals.db, quiz.id, section);
		if (!sectionRow) {
			apiProblem(404, 'section_not_found', 'Section not found', 'This quiz has no such section.');
		}

		const question = await getQuestionRefByPublicId(locals.db, questionId);
		if (!question) {
			apiProblem(404, 'question_not_found', 'Question not found', 'That question does not exist.');
		}

		const written = await attachQuestion(locals.db, quiz, sectionRow.id, question.id);
		if (!written.ok) {
			apiProblem(409, 'attach_conflict', 'Conflict', written.message);
		}

		return json(
			{ data: { questionId, section } },
			{
				status: 201,
				headers: { location: `/api/v1/admin/quizzes/${quizId}/questions/${questionId}` }
			}
		);
	});
