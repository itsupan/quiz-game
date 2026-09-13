import { fail, redirect } from '@sveltejs/kit';

import { readApiData, toActionFailure, toPageError } from '$lib/features/quiz/api/client';
import {
	activeQuestion,
	getAttempt,
	redirectForStatus,
	requestedQuestion
} from '$lib/features/quiz/api/navigation.server';
import type { AttemptQuestion } from '$lib/features/quiz/api/types';
import type { Actions, PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ fetch, params, url }) => {
	try {
		const attempt = await getAttempt(fetch, params.publicId);
		redirectForStatus(attempt);

		const number = requestedQuestion(attempt.progress.total, url.searchParams.get('q'));
		const question = await readApiData<AttemptQuestion>(
			fetch(`/api/v1/attempts/${params.publicId}/questions/${number}`)
		);

		if (!question.canAnswer) {
			const next = activeQuestion(attempt);
			if (next !== null && next !== number) {
				redirect(303, `/quiz/attempt/${params.publicId}?q=${next}`);
			}
		}

		return {
			attempt,
			question,
			deadline: attempt.sectionExpiresAt ?? attempt.attemptExpiresAt,
			deadlineKind: attempt.sectionExpiresAt ? ('section' as const) : ('attempt' as const)
		};
	} catch (cause) {
		toPageError(cause);
	}
};

export const actions: Actions = {
	answer: async ({ fetch, params, request, url }) => {
		const form = await request.formData();
		const rawOption = form.get('selectedOptionNumber');
		const selectedOptionNumber = rawOption === null || rawOption === '' ? null : Number(rawOption);

		if (selectedOptionNumber !== null && !Number.isInteger(selectedOptionNumber)) {
			return fail(422, { message: 'Choose a valid answer option.' });
		}

		try {
			const updated = await readApiData<AttemptQuestion>(
				fetch(`/api/v1/attempts/${params.publicId}/answers/${form.get('questionNumber')}`, {
					method: 'PUT',
					headers: { 'content-type': 'application/json' },
					body: JSON.stringify({ selectedOptionNumber })
				})
			);

			if (form.get('finish') === 'true') {
				await readApiData(
					fetch(`/api/v1/attempts/${params.publicId}/submission`, { method: 'PUT' })
				);
				redirect(303, `/quiz/attempt/${params.publicId}/result`);
			}

			const total = updated.progress.total;
			const current = requestedQuestion(total, url.searchParams.get('q'));
			const rawNext = form.get('nextQuestion');
			const next = typeof rawNext === 'string' ? requestedQuestion(total, rawNext) : current;
			if (next !== current) {
				redirect(303, `/quiz/attempt/${params.publicId}?q=${next}`);
			}

			return { ok: true };
		} catch (cause) {
			return toActionFailure(cause);
		}
	},

	advance: async ({ fetch, params }) => {
		try {
			const attempt = await getAttempt(fetch, params.publicId);
			redirectForStatus(attempt);
			const next = activeQuestion(attempt);
			if (next !== null) redirect(303, `/quiz/attempt/${params.publicId}?q=${next}`);
			return fail(409, { message: 'No quiz section is currently available.' });
		} catch (cause) {
			return toActionFailure(cause);
		}
	},

	submit: async ({ fetch, params }) => {
		try {
			await readApiData(fetch(`/api/v1/attempts/${params.publicId}/submission`, { method: 'PUT' }));
			redirect(303, `/quiz/attempt/${params.publicId}/result`);
		} catch (cause) {
			return toActionFailure(cause);
		}
	},

	exit: async ({ fetch, params }) => {
		try {
			await readApiData(
				fetch(`/api/v1/attempts/${params.publicId}/abandonment`, { method: 'PUT' })
			);
			redirect(303, '/home');
		} catch (cause) {
			return toActionFailure(cause);
		}
	}
};
