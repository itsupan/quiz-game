import { redirect } from '@sveltejs/kit';

import { QuizApiError, readApiData, toPageError } from '$lib/features/quiz/api/client';
import type { QuizResult } from '$lib/features/quiz/api/types';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params }) => {
	try {
		const result = await readApiData<QuizResult>(
			fetch(`/api/v1/attempts/${params.publicId}/result`)
		);

		return { result };
	} catch (cause) {
		if (cause instanceof QuizApiError) {
			if (cause.code === 'result_not_ready') {
				redirect(303, `/quiz/attempt/${params.publicId}`);
			}
			if (cause.code === 'attempt_abandoned') {
				redirect(303, '/home');
			}
		}
		toPageError(cause);
	}
};
