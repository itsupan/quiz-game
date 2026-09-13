import { redirect } from '@sveltejs/kit';

import { readApiData } from './client';
import type { AttemptState } from './types';

/** Clamps a requested question number into range, defaulting to the first question. */
export function requestedQuestion(total: number, value: string | null): number {
	const requested = Number(value ?? '1');
	return Math.min(Math.max(1, Number.isFinite(requested) ? Math.trunc(requested) : 1), total);
}

/** The question number of the attempt's currently open section, if any. */
export function activeQuestion(attempt: AttemptState): number | null {
	if (!attempt.activeSection) return null;
	return (
		attempt.questions.find((question) => question.section === attempt.activeSection)?.number ?? null
	);
}

/** Sends a settled attempt to wherever it belongs instead of the live question view. */
export function redirectForStatus(attempt: AttemptState): void {
	if (attempt.status === 'SUBMITTED' || attempt.status === 'EXPIRED') {
		redirect(303, `/quiz/attempt/${attempt.id}/result`);
	}
	if (attempt.status === 'ABANDONED') {
		redirect(303, '/home');
	}
}

export async function getAttempt(fetcher: typeof fetch, publicId: string): Promise<AttemptState> {
	return readApiData<AttemptState>(fetcher(`/api/v1/attempts/${publicId}`));
}
