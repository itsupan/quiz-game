import { redirect } from '@sveltejs/kit';

import { readApiData, toActionFailure, toPageError } from '$lib/features/quiz/api/client';
import type { AttemptStatus, QuizOverview } from '$lib/features/quiz/api/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params }) => {
	try {
		const quiz = await readApiData<QuizOverview>(fetch(`/api/v1/quizzes/${params.publicId}`));
		return { quiz, idempotencyKey: `quiz-ui-${crypto.randomUUID()}` };
	} catch (cause) {
		toPageError(cause);
	}
};

export const actions: Actions = {
	start: async ({ fetch, params, request }) => {
		const form = await request.formData();
		const suppliedKey = form.get('idempotencyKey');
		const idempotencyKey =
			typeof suppliedKey === 'string' && suppliedKey.length >= 8
				? suppliedKey
				: `quiz-ui-${crypto.randomUUID()}`;

		try {
			const started = await readApiData<{
				id: string;
				status: AttemptStatus;
				links: { self: string };
			}>(
				fetch(`/api/v1/quizzes/${params.publicId}/attempts`, {
					method: 'POST',
					headers: { 'idempotency-key': idempotencyKey }
				})
			);

			redirect(
				303,
				started.status === 'IN_PROGRESS'
					? `/quiz/attempt/${started.id}`
					: `/quiz/attempt/${started.id}/result`
			);
		} catch (cause) {
			return toActionFailure(cause);
		}
	}
};
