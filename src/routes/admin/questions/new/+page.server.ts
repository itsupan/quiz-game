import { fail, redirect } from '@sveltejs/kit';

import { requireMediaBucket } from '$lib/features/media/media.server';
import { resolveQuestionMedia } from '$lib/features/questions/question-media.server';
import { createQuestion } from '$lib/features/questions/questions.server';
import { echoValues, parseQuestionForm } from '$lib/features/questions/validation';
import type { Actions } from './$types';

export const actions: Actions = {
	default: async ({ locals, platform, request }) => {
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
			{ imageMediaId: null, audioMediaId: null }
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

		const created = await createQuestion(locals.db, locals.user?.id ?? null, {
			...parsed.value,
			...media.value
		});

		if (!created.ok) {
			return fail(400, { message: created.message });
		}

		// A new question starts as a DRAFT, so publishing is a separate, deliberate act
		// on the edit page where the accessibility checks can run.
		redirect(303, `/admin/questions/${created.value}`);
	}
};
