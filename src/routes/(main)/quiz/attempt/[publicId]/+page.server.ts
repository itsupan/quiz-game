import { error, fail, redirect } from '@sveltejs/kit';

import {
	enforceDeadline,
	finalizeAttempt,
	loadAttempt,
	saveAnswer
} from '$lib/features/quiz/attempts.server';
import { sectionOpen } from '$lib/features/quiz/timing';
import type { AttemptView } from '$lib/features/quiz/attempts.server';
import type { Actions, PageServerLoad } from './$types';

/**
 * Loads the attempt and settles its clock before anything else happens — the one
 * chokepoint every route below calls first, on every load and every action.
 */
async function openAttempt(locals: App.Locals, publicId: string, now: Date) {
	const view = await loadAttempt(locals.db, publicId, locals.user!.id);

	if (!view) {
		error(404, 'That attempt does not exist.');
	}

	const status = await enforceDeadline(locals.db, view, now);

	if (status !== 'IN_PROGRESS') {
		redirect(303, `/quiz/attempt/${publicId}/result`);
	}

	return view;
}

function requestedIndex(view: AttemptView, value: string | null) {
	const requested = Number(value ?? '1');

	return Math.min(
		Math.max(1, Number.isFinite(requested) ? Math.trunc(requested) : 1),
		view.questions.length
	);
}

/** Finds the first later question whose section still accepts answers. */
function nextOpenQuestion(view: AttemptView, currentIndex: number, now: Date) {
	const next = view.questions.findIndex(
		(question, index) =>
			index >= currentIndex && sectionOpen(now, view.sectionDeadlines, question.section)
	);

	return next === -1 ? null : next + 1;
}

/**
 * A section deadline never leaves the learner stranded on a form the server refuses.
 * Move to the next open section, or close the sitting when every section's time is gone.
 */
async function movePastClosedSection(
	locals: App.Locals,
	view: AttemptView,
	currentIndex: number,
	now: Date
): Promise<never> {
	const nextIndex = nextOpenQuestion(view, currentIndex, now);

	if (nextIndex !== null) {
		redirect(303, `/quiz/attempt/${view.attempt.publicId}?q=${nextIndex}`);
	}

	await finalizeAttempt(locals.db, view.attempt.id, 'EXPIRED', now);
	redirect(303, `/quiz/attempt/${view.attempt.publicId}/result`);
}

export const load: PageServerLoad = async ({ locals, params, url }) => {
	const now = new Date();
	const view = await openAttempt(locals, params.publicId, now);
	const index = requestedIndex(view, url.searchParams.get('q'));
	const question = view.questions[index - 1];

	if (!sectionOpen(now, view.sectionDeadlines, question.section)) {
		return movePastClosedSection(locals, view, index, now);
	}

	const deadline =
		view.sectionDeadlines.find((entry) => entry.section === question.section)?.deadline ??
		view.attempt.expiresAt;
	const deadlineKind =
		deadline !== null &&
		view.attempt.expiresAt !== null &&
		deadline.getTime() < view.attempt.expiresAt.getTime()
			? 'section'
			: 'attempt';

	return {
		quiz: view.quiz,
		deadline: deadline?.toISOString() ?? null,
		deadlineKind,
		index,
		total: view.questions.length,
		answeredCount: view.questions.filter((question) => question.selectedOptionId !== null).length,
		question,
		revealStudyAids: view.attempt.showStudyAidsDuringAttempt
	};
};

export const actions: Actions = {
	answer: async ({ locals, params, request, url }) => {
		const now = new Date();
		const view = await openAttempt(locals, params.publicId, now);

		const data = await request.formData();
		const attemptQuestionId = Number(data.get('attemptQuestionId'));
		const rawOption = data.get('selectedOptionId');
		const selectedOptionId = rawOption === null || rawOption === '' ? null : Number(rawOption);
		const currentIndex = requestedIndex(view, url.searchParams.get('q'));
		const nextIndex = Number(data.get('nextIndex') ?? currentIndex);
		const submittedQuestion = view.questions.find(
			(question) => question.attemptQuestionId === attemptQuestionId
		);

		if (
			submittedQuestion &&
			!sectionOpen(now, view.sectionDeadlines, submittedQuestion.section) &&
			nextIndex > currentIndex
		) {
			return movePastClosedSection(locals, view, currentIndex, now);
		}

		const written = await saveAnswer(locals.db, view, attemptQuestionId, selectedOptionId, now);

		if (!written.ok) {
			return fail(409, { message: written.message });
		}

		if (nextIndex !== currentIndex) {
			redirect(303, `/quiz/attempt/${params.publicId}?q=${nextIndex}`);
		}

		return { ok: true, message: 'Saved.' };
	},

	advance: async ({ locals, params, url }) => {
		const now = new Date();
		const view = await openAttempt(locals, params.publicId, now);
		const currentIndex = requestedIndex(view, url.searchParams.get('q'));
		const question = view.questions[currentIndex - 1];

		if (sectionOpen(now, view.sectionDeadlines, question.section)) {
			redirect(303, `/quiz/attempt/${params.publicId}?q=${currentIndex}`);
		}

		return movePastClosedSection(locals, view, currentIndex, now);
	},

	submit: async ({ locals, params }) => {
		const now = new Date();
		const view = await openAttempt(locals, params.publicId, now);

		await finalizeAttempt(locals.db, view.attempt.id, 'SUBMITTED', now);

		redirect(303, `/quiz/attempt/${params.publicId}/result`);
	}
};
