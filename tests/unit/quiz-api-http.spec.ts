import { describe, expect, it, vi } from 'vitest';

import {
	apiEndpoint,
	assertSameOrigin,
	parseAnswerBody,
	parseIdempotencyKey,
	readJsonObject,
	requireLearner
} from '$lib/features/quiz/api/http.server';
import type { AuthUser } from '$lib/server/auth/types';

const learner: AuthUser = {
	id: 1,
	publicId: '01JSEEDACCTUSER0000000000',
	email: 'learner@example.com',
	displayName: 'Learner',
	role: 'USER',
	status: 'ACTIVE'
};

describe('quiz API HTTP boundary', () => {
	it('returns an RFC 9457 response for unauthenticated requests', async () => {
		const request = new Request('https://quiz.example/api/v1/quizzes');
		const response = await apiEndpoint(request, () => {
			requireLearner(null);
			return new Response();
		});

		expect(response.status).toBe(401);
		expect(response.headers.get('content-type')).toBe('application/problem+json');
		await expect(response.json()).resolves.toMatchObject({
			type: 'urn:quiz-game:problem:authentication_required',
			code: 'authentication_required',
			status: 401
		});
	});

	it('accepts an active learner and rejects administrator use of learner endpoints', async () => {
		expect(requireLearner(learner)).toBe(learner);

		const request = new Request('https://quiz.example/api/v1/quizzes');
		const response = await apiEndpoint(request, () => {
			requireLearner({ ...learner, role: 'ADMIN' });
			return new Response();
		});
		expect(response.status).toBe(403);
	});

	it('rejects a cross-origin mutation', async () => {
		const request = new Request('https://quiz.example/api/v1/attempts/1/submission', {
			method: 'PUT',
			headers: { origin: 'https://evil.example' }
		});
		const response = await apiEndpoint(request, () => {
			assertSameOrigin(request, new URL(request.url));
			return new Response();
		});

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toMatchObject({ code: 'cross_origin_request' });
	});

	it('requires JSON and validates the complete answer body', async () => {
		const textRequest = new Request('https://quiz.example/api/v1/answers/1', {
			method: 'PUT',
			body: 'selectedOptionNumber=1',
			headers: { 'content-type': 'text/plain' }
		});
		const response = await apiEndpoint(textRequest, async () => {
			await readJsonObject(textRequest);
			return new Response();
		});

		expect(response.status).toBe(415);
		expect(parseAnswerBody({ selectedOptionNumber: 2 })).toBe(2);
		expect(parseAnswerBody({ selectedOptionNumber: null })).toBeNull();
	});

	it('requires a retry key with a bounded visible value', async () => {
		const valid = new Request('https://quiz.example/api/v1/attempts', {
			headers: { 'idempotency-key': 'attempt-123' }
		});
		expect(parseIdempotencyKey(valid)).toBe('attempt-123');

		const invalid = new Request('https://quiz.example/api/v1/attempts');
		const response = await apiEndpoint(invalid, () => {
			parseIdempotencyKey(invalid);
			return new Response();
		});
		expect(response.status).toBe(400);
	});

	it('returns a correlation id without exposing unexpected error details', async () => {
		const logged = vi.spyOn(console, 'error').mockImplementation(() => undefined);
		try {
			const request = new Request('https://quiz.example/api/v1/quizzes');
			const response = await apiEndpoint(request, () => {
				throw new Error('secret SQL and binding details');
			});
			const body = await response.text();

			expect(response.status).toBe(500);
			expect(response.headers.get('x-request-id')).toBeTruthy();
			expect(body).not.toContain('secret SQL');
			expect(logged).toHaveBeenCalledOnce();
		} finally {
			logged.mockRestore();
		}
	});
});
