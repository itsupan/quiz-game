import { error, fail } from '@sveltejs/kit';

import type { ApiEnvelope, ApiProblem } from './types';

export class QuizApiError extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		detail: string
	) {
		super(detail);
		this.name = 'QuizApiError';
	}
}

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export async function readApiResponse<T>(
	responseOrPending: Response | Promise<Response>
): Promise<T> {
	const response = await responseOrPending;
	let body: unknown;
	try {
		body = await response.json();
	} catch {
		throw new QuizApiError(
			response.status || 500,
			'invalid_response',
			'The server response was invalid.'
		);
	}

	if (!response.ok) {
		const problem = isRecord(body) ? (body as Partial<ApiProblem>) : {};
		throw new QuizApiError(
			response.status,
			typeof problem.code === 'string' ? problem.code : 'request_failed',
			typeof problem.detail === 'string' ? problem.detail : 'The request could not be completed.'
		);
	}

	if (!isRecord(body)) {
		throw new QuizApiError(500, 'invalid_response', 'The server response was invalid.');
	}

	return body as T;
}

export async function readApiData<T>(responseOrPending: Response | Promise<Response>): Promise<T> {
	const body = await readApiResponse<ApiEnvelope<T>>(responseOrPending);
	if (!('data' in body)) {
		throw new QuizApiError(500, 'invalid_response', 'The server response was invalid.');
	}

	return body.data;
}

/** Translates a caught `QuizApiError` into a `load`-function error; rethrows anything else. */
export function toPageError(cause: unknown): never {
	if (cause instanceof QuizApiError) {
		error(cause.status, cause.message);
	}
	throw cause;
}

/** Translates a caught `QuizApiError` into a form action failure; rethrows anything else. */
export function toActionFailure(cause: unknown) {
	if (cause instanceof QuizApiError) {
		return fail(cause.status, { message: cause.message });
	}
	throw cause;
}
