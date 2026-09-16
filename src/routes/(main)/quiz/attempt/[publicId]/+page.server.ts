import { fail, redirect } from '@sveltejs/kit';

import { parsePublicId, requireLearner } from '$lib/features/quiz/api/http.server';
import {
	activeQuestion,
	redirectForStatus,
	requestedQuestion
} from '$lib/features/quiz/api/navigation.server';
import { toActionFailure, toPageError } from '$lib/features/quiz/api/page-errors.server';
import {
	abandonOwnedAttempt,
	getAttemptWithQuestion,
	getOwnedAttempt,
	submitAttempt,
	writeOwnedAnswer
} from '$lib/features/quiz/api/quiz-api.server';
import type { AttemptQuestion, AttemptState } from '$lib/features/quiz/api/types';
import { isPracticeMode } from '$lib/features/quiz/modes';
import { loadLifetimeXp } from '$lib/features/leaderboard/leaderboard.server';
import type { Actions, PageServerLoad, RequestEvent } from './$types';

/*
 * These call the quiz service directly rather than `fetch('/api/v1/...')`. Each internal
 * fetch re-ran every hook — the session lookup included — and loaded the whole attempt
 * again, so a single answer tap cost around twenty-five sequential D1 round trips.
 * The `/api/v1/attempts` endpoints wrap the same functions, so behavior is unchanged.
 */

function owner({ locals, params }: Pick<RequestEvent, 'locals' | 'params'>) {
	return {
		db: locals.db,
		userId: requireLearner(locals.user).id,
		attemptId: parsePublicId(params.publicId, 'attemptId')
	};
}

export const load: PageServerLoad = async (event) => {
	const { params, url } = event;
	try {
		const { db, userId, attemptId } = owner(event);
		const view = await getAttemptWithQuestion(
			db,
			attemptId,
			(total) => requestedQuestion(total, url.searchParams.get('q')),
			userId,
			new Date()
		);
		const attempt = view.attempt as AttemptState;
		redirectForStatus(attempt);
		const question = view.question as AttemptQuestion;

		if (!question.canAnswer) {
			const next = activeQuestion(attempt);
			if (next !== null && next !== question.number) {
				redirect(303, `/quiz/attempt/${params.publicId}?q=${next}`);
			}
		}

		/*
		 * Only practice shows the level badge, so only practice pays for the query — and it
		 * runs alongside nothing else here, so it adds one aggregate, not a sequential hop.
		 */
		const lifetimeXp = isPracticeMode(attempt.quiz.mode) ? await loadLifetimeXp(db, userId) : 0;

		return {
			attempt,
			question,
			lifetimeXp,
			deadline: attempt.sectionExpiresAt ?? attempt.attemptExpiresAt,
			deadlineKind: attempt.sectionExpiresAt ? ('section' as const) : ('attempt' as const)
		};
	} catch (cause) {
		toPageError(cause);
	}
};

export const actions: Actions = {
	answer: async (event) => {
		const { params, request, url } = event;
		const form = await request.formData();
		const rawOption = form.get('selectedOptionNumber');
		const selectedOptionNumber = rawOption === null || rawOption === '' ? null : Number(rawOption);
		const questionNumber = Number(form.get('questionNumber'));

		if (selectedOptionNumber !== null && !Number.isInteger(selectedOptionNumber)) {
			return fail(422, { message: 'Choose a valid answer option.' });
		}
		if (!Number.isInteger(questionNumber) || questionNumber < 1) {
			return fail(422, { message: 'That question does not exist.' });
		}

		try {
			const { db, userId, attemptId } = owner(event);
			const now = new Date();
			// Untrusted, and clamped server-side; it can only ever move bonus XP, never a score.
			const rawElapsed = form.get('elapsedMs');
			const elapsedMsClaim = typeof rawElapsed === 'string' ? Number(rawElapsed) : null;

			/*
			 * A finishing post that carries no selection has nothing to say about this question.
			 * The options are disabled while a save is in flight, and a disabled control is not
			 * submitted — so an absent value here means "not sent", never "clear my answer", and
			 * writing null would wipe an answer the learner had already saved. Where nothing was
			 * ever picked there is no row to protect and skipping the write scores the same.
			 */
			if (form.get('finish') === 'true' && selectedOptionNumber === null) {
				await submitAttempt(db, attemptId, userId, now);
				redirect(303, `/quiz/attempt/${params.publicId}/result`);
			}

			const { view, verdict } = await writeOwnedAnswer(
				db,
				attemptId,
				questionNumber,
				selectedOptionNumber,
				userId,
				now,
				elapsedMsClaim
			);

			if (form.get('finish') === 'true') {
				await submitAttempt(db, attemptId, userId, now);
				redirect(303, `/quiz/attempt/${params.publicId}/result`);
			}

			const total = view.questions.length;
			const current = requestedQuestion(total, url.searchParams.get('q'));
			const rawNext = form.get('nextQuestion');
			const next = typeof rawNext === 'string' ? requestedQuestion(total, rawNext) : current;

			/*
			 * Practice mode holds on the answered question so the learner sees whether they
			 * got it right, and the client navigates once they have. The branch is on the
			 * server-produced `verdict` — non-null only for `JLPT_PRACTICE` — and never on a
			 * form field, so a crafted post cannot talk an exam sitting out of its redirect.
			 */
			if (verdict) {
				return { ok: true, verdict, next: next === current ? null : next };
			}

			if (next !== current) {
				redirect(303, `/quiz/attempt/${params.publicId}?q=${next}`);
			}

			return { ok: true };
		} catch (cause) {
			return toActionFailure(cause);
		}
	},

	advance: async (event) => {
		const { params } = event;
		try {
			const { db, userId, attemptId } = owner(event);
			const attempt = (await getOwnedAttempt(db, attemptId, userId, new Date())) as AttemptState;
			redirectForStatus(attempt);
			const next = activeQuestion(attempt);
			if (next !== null) redirect(303, `/quiz/attempt/${params.publicId}?q=${next}`);
			return fail(409, { message: 'No quiz section is currently available.' });
		} catch (cause) {
			return toActionFailure(cause);
		}
	},

	submit: async (event) => {
		const { params } = event;
		try {
			const { db, userId, attemptId } = owner(event);
			await submitAttempt(db, attemptId, userId, new Date());
			redirect(303, `/quiz/attempt/${params.publicId}/result`);
		} catch (cause) {
			return toActionFailure(cause);
		}
	},

	exit: async (event) => {
		try {
			const { db, userId, attemptId } = owner(event);
			await abandonOwnedAttempt(db, attemptId, userId, new Date());
			redirect(303, '/home');
		} catch (cause) {
			return toActionFailure(cause);
		}
	}
};
