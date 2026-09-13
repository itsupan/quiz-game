import { error, fail } from '@sveltejs/kit';

import { recordAudit } from '$lib/features/admin/audit.server';
import { requireMediaBucket } from '$lib/features/media/media.server';
import { resolveQuestionMedia } from '$lib/features/questions/question-media.server';
import {
	getQuestion,
	listQuizzesForQuestion,
	setQuestionStatus,
	updateQuestion
} from '$lib/features/questions/questions.server';
import {
	echoValues,
	parseQuestionForm,
	questionPublishBlockers
} from '$lib/features/questions/validation';
import type { Actions, PageServerLoad } from './$types';

async function load404(locals: App.Locals, publicId: string) {
	const found = await getQuestion(locals.db, publicId);

	if (!found) {
		error(404, 'That question does not exist.');
	}

	return found;
}

export const load: PageServerLoad = async ({ locals, params }) => {
	const { question, options, image, audio } = await load404(locals, params.publicId);
	const usedInQuizzes = await listQuizzesForQuestion(locals.db, question.id);

	return {
		// `isCorrect` is read here and rendered as the checked radio. This is the one page
		// allowed to know the answer key; every learner-facing route projects
		// `publicQuestionOptionColumns`, which has no such column to leak.
		question,
		options,
		image,
		audio,
		usedInQuizzes,
		blockers: questionPublishBlockers(question, { image, audio })
	};
};

export const actions: Actions = {
	update: async ({ locals, params, platform, request }) => {
		const { question } = await load404(locals, params.publicId);
		const data = await request.formData();
		const parsed = parseQuestionForm(data);

		if (!parsed.ok) {
			return fail(400, {
				errors: parsed.errors,
				values: parsed.values,
				submitted: parsed.submitted
			});
		}

		const media = await resolveQuestionMedia(
			locals.db,
			requireMediaBucket(platform),
			locals.user?.id ?? null,
			data,
			{ imageMediaId: question.imageMediaId, audioMediaId: question.audioMediaId }
		);

		if (!media.ok) {
			return fail(400, {
				errors: media.errors,
				values: echoValues(data),
				submitted: {
					options: parsed.value.options.map(({ id, body }) => ({ id, body })),
					correctOption: parsed.value.options.findIndex((option) => option.isCorrect)
				}
			});
		}

		const written = await updateQuestion(locals.db, question.id, {
			...parsed.value,
			...media.value
		});

		if (!written.ok) {
			return fail(409, { message: written.message });
		}

		return { ok: true, message: 'Saved.' };
	},

	publish: async ({ locals, params }) => {
		const { question, options, image, audio } = await load404(locals, params.publicId);
		const blockers = questionPublishBlockers(question, { image, audio }, options);

		if (blockers.length > 0) {
			return fail(400, { message: blockers.join(' ') });
		}

		await setQuestionStatus(locals.db, question.id, 'PUBLISHED');
		await recordAudit(locals.db, {
			actorUserId: locals.user?.id ?? null,
			action: 'QUESTION_PUBLISHED',
			entityType: 'question',
			entityId: question.id,
			before: { status: question.status },
			after: { status: 'PUBLISHED' }
		});

		return { ok: true, message: 'Published.' };
	},

	archive: async ({ locals, params }) => {
		const { question } = await load404(locals, params.publicId);

		await setQuestionStatus(locals.db, question.id, 'ARCHIVED');
		await recordAudit(locals.db, {
			actorUserId: locals.user?.id ?? null,
			action: 'QUESTION_ARCHIVED',
			entityType: 'question',
			entityId: question.id,
			before: { status: question.status },
			after: { status: 'ARCHIVED' }
		});

		return { ok: true, message: 'Archived.' };
	}
};
