import { expect, test } from '@playwright/test';

import { LEARNER_SESSION, signIn } from './sessions';

test.describe('quiz API v1', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page.context(), LEARNER_SESSION);
	});

	test('completes a quiz through JSON endpoints without leaking answers early', async ({
		page
	}) => {
		const catalogResponse = await page.request.get('/api/v1/quizzes?level=N4&limit=10');
		expect(catalogResponse.status()).toBe(200);
		const catalog = (await catalogResponse.json()) as { data: unknown[] };
		expect(catalog.data.length).toBeGreaterThan(0);

		const quizId = '01JSEEDQZN4EXAM00000000000';
		const overviewResponse = await page.request.get(`/api/v1/quizzes/${quizId}`);
		expect(overviewResponse.status()).toBe(200);

		const idempotencyKey = `playwright-${crypto.randomUUID()}`;
		const startResponse = await page.request.post(`/api/v1/quizzes/${quizId}/attempts`, {
			headers: { 'idempotency-key': idempotencyKey }
		});
		expect(startResponse.status()).toBe(201);
		const started = (await startResponse.json()) as { data: { id: string } };

		const questionResponse = await page.request.get(
			`/api/v1/attempts/${started.data.id}/questions/1`
		);
		expect(questionResponse.status()).toBe(200);
		const questionText = await questionResponse.text();
		expect(questionText).not.toMatch(/correctOption|isCorrect|explanation|transcript/);

		const answerResponse = await page.request.put(`/api/v1/attempts/${started.data.id}/answers/1`, {
			data: { selectedOptionNumber: 1 }
		});
		expect(answerResponse.status()).toBe(200);

		const submitResponse = await page.request.put(`/api/v1/attempts/${started.data.id}/submission`);
		expect(submitResponse.status()).toBe(200);
		const result = (await submitResponse.json()) as {
			data: { attempt: { status: string }; questions: { correctOptionNumber: number }[] };
		};
		expect(result.data.attempt.status).toBe('SUBMITTED');
		expect(result.data.questions[0].correctOptionNumber).toBe(1);

		const replayResponse = await page.request.post(`/api/v1/quizzes/${quizId}/attempts`, {
			headers: { 'idempotency-key': idempotencyKey }
		});
		expect(replayResponse.status()).toBe(200);
		await expect(replayResponse.json()).resolves.toMatchObject({
			data: { id: started.data.id, status: 'SUBMITTED' }
		});
	});

	test('uses JSON errors for authentication and malformed input', async ({ page, browser }) => {
		const anonymous = await browser.newContext();
		const unauthorized = await anonymous.request.get('/api/v1/quizzes');
		expect(unauthorized.status()).toBe(401);
		expect(unauthorized.headers()['content-type']).toContain('application/problem+json');
		await anonymous.close();

		const malformed = await page.request.put('/api/v1/attempts/not-an-id/answers/not-a-question', {
			data: { selectedOptionNumber: 1 }
		});
		expect(malformed.status()).toBe(400);
		await expect(malformed.json()).resolves.toMatchObject({ code: 'invalid_identifier' });
	});

	test('abandons a quiz idempotently without exposing a result', async ({ page }) => {
		const quizId = '01JSEEDQZN4EXAM00000000000';
		const startResponse = await page.request.post(`/api/v1/quizzes/${quizId}/attempts`, {
			headers: { 'idempotency-key': `abandon-${crypto.randomUUID()}` }
		});
		const started = (await startResponse.json()) as { data: { id: string } };
		const abandonmentUrl = `/api/v1/attempts/${started.data.id}/abandonment`;

		for (let attempt = 0; attempt < 2; attempt++) {
			const response = await page.request.put(abandonmentUrl);
			expect(response.status()).toBe(200);
			await expect(response.json()).resolves.toMatchObject({
				data: { id: started.data.id, status: 'ABANDONED' }
			});
		}

		const resultResponse = await page.request.get(`/api/v1/attempts/${started.data.id}/result`);
		expect(resultResponse.status()).toBe(409);
		await expect(resultResponse.json()).resolves.toMatchObject({ code: 'attempt_abandoned' });
	});
});
