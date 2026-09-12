import { error, fail } from '@sveltejs/kit';

import { recordAudit } from '$lib/features/admin/audit.server';
import { listMediaChoices } from '$lib/features/admin/questions/mediaChoices.server';
import {
	checkMediaSlots,
	getQuestion,
	setQuestionStatus,
	updateQuestion
} from '$lib/features/admin/questions/questions.server';
import { echoValues, parseQuestionForm, publishBlockers } from '$lib/features/admin/validation';
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

	return {
		// `isCorrect` is read here and rendered as the checked radio. This is the one page
		// allowed to know the answer key; every learner-facing route projects
		// `publicQuestionOptionColumns`, which has no such column to leak.
		question,
		options,
		image,
		audio,
		blockers: publishBlockers(question, { image, audio }),
		media: await listMediaChoices(locals.db)
	};
};

export const actions: Actions = {
	update: async ({ locals, params, request }) => {
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

		// Checked before the write so an unknown or mismatched asset is a message beside
		// the picker rather than a foreign-key failure surfacing as a 500.
		const mediaErrors = await checkMediaSlots(locals.db, parsed.value);

		if (Object.keys(mediaErrors).length > 0) {
			return fail(400, {
				errors: mediaErrors,
				values: echoValues(data),
				submitted: {
					options: parsed.value.options.map(({ id, body }) => ({ id, body })),
					correctOption: parsed.value.options.findIndex((option) => option.isCorrect)
				}
			});
		}

		const written = await updateQuestion(locals.db, question.id, parsed.value);

		if (!written.ok) {
			return fail(409, { message: written.message });
		}

		return { ok: true, message: 'Saved.' };
	},

	publish: async ({ locals, params }) => {
		const { question, image, audio } = await load404(locals, params.publicId);
		const blockers = publishBlockers(question, { image, audio });

		if (blockers.length > 0) {
			return fail(400, { message: blockers.join(' ') });
		}

		// "At least one answer key" is the half of the rule SQLite cannot express: a
		// partial unique index forbids a second key but cannot require a first.
		const options = (await getQuestion(locals.db, params.publicId))?.options ?? [];

		if (!options.some((option) => option.isCorrect)) {
			return fail(400, { message: 'Mark one option as the correct answer before publishing.' });
		}

		if (options.length < 2) {
			return fail(400, { message: 'A published question needs at least two options.' });
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
