import { fail, redirect } from '@sveltejs/kit';

import { listMediaChoices } from '$lib/features/questions/media-choices.server';
import { checkMediaSlots, createQuestion } from '$lib/features/questions/questions.server';
import { echoValues, parseQuestionForm } from '$lib/features/questions/validation';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ locals }) => {
	return { media: await listMediaChoices(locals.db) };
};

export const actions: Actions = {
	default: async ({ locals, request }) => {
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

		const created = await createQuestion(locals.db, locals.user?.id ?? null, parsed.value);

		if (!created.ok) {
			return fail(400, { message: created.message });
		}

		// A new question starts as a DRAFT, so publishing is a separate, deliberate act
		// on the edit page where the accessibility checks can run.
		redirect(303, `/admin/questions/${created.value}`);
	}
};
