import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { expect, test } from '@playwright/test';

import { ADMIN_SESSION, LEARNER_SESSION, signIn } from './sessions';

const SAMPLE_IMAGE = fileURLToPath(
	new URL('../../seeds/fixtures/sample-image.png', import.meta.url)
);

test.describe('admin API v1 — authorization', () => {
	test('anonymous requests are rejected with 401', async ({ browser }) => {
		const anonymous = await browser.newContext();
		const response = await anonymous.request.get('/api/v1/admin/quizzes');
		expect(response.status()).toBe(401);
		expect(response.headers()['content-type']).toContain('application/problem+json');
		await expect(response.json()).resolves.toMatchObject({ code: 'authentication_required' });
		await anonymous.close();
	});

	test('a signed-in learner is rejected with 403', async ({ browser }) => {
		const learner = await browser.newContext();
		await signIn(learner, LEARNER_SESSION);
		const response = await learner.request.get('/api/v1/admin/quizzes');
		expect(response.status()).toBe(403);
		await expect(response.json()).resolves.toMatchObject({ code: 'admin_access_required' });
		await learner.close();
	});

	test('an active administrator is admitted, with cache-control and a request id', async ({
		browser
	}) => {
		const admin = await browser.newContext();
		await signIn(admin, ADMIN_SESSION);
		const response = await admin.request.get('/api/v1/admin/quizzes');
		expect(response.status()).toBe(200);
		expect(response.headers()['cache-control']).toContain('no-store');
		expect(response.headers()['x-request-id']).toBeTruthy();
		await admin.close();
	});

	test('a mutation from a foreign origin is rejected as cross-origin, not CSRF-bypassed', async ({
		browser
	}) => {
		const admin = await browser.newContext();
		await signIn(admin, ADMIN_SESSION);
		const response = await admin.request.post('/api/v1/admin/quizzes', {
			headers: { origin: 'https://evil.example' },
			data: { title: 'x', mode: 'JLPT_PRACTICE', level: 'N4', selectionMode: 'FIXED' }
		});
		expect(response.status()).toBe(403);
		await expect(response.json()).resolves.toMatchObject({ code: 'cross_origin_request' });
		await admin.close();
	});
});

test.describe('admin API v1 — quiz lifecycle', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page.context(), ADMIN_SESSION);
	});

	test('creates, sections, attaches, publishes and archives a quiz end to end', async ({
		page
	}) => {
		const created = await page.request.post('/api/v1/admin/quizzes', {
			data: {
				title: 'E2E draft quiz',
				mode: 'JLPT_PRACTICE',
				level: 'N4',
				selectionMode: 'FIXED',
				timeLimitSeconds: null
			}
		});
		expect(created.status()).toBe(201);
		expect(created.headers()['location']).toBeTruthy();
		const { data: createdQuiz } = (await created.json()) as { data: { id: string } };
		const quizId = createdQuiz.id;

		// Cannot publish an empty quiz.
		const blockedPublish = await page.request.put(`/api/v1/admin/quizzes/${quizId}/publication`);
		expect(blockedPublish.status()).toBe(409);
		await expect(blockedPublish.json()).resolves.toMatchObject({ code: 'publish_blocked' });

		const section = await page.request.post(`/api/v1/admin/quizzes/${quizId}/sections`, {
			data: { section: 'VOCAB_KANJI', position: 1, timeLimitSeconds: null, drawCount: null }
		});
		expect(section.status()).toBe(201);

		// This quiz is FIXED, so a section cannot declare a draw count.
		const badSection = await page.request.post(`/api/v1/admin/quizzes/${quizId}/sections`, {
			data: { section: 'LISTENING', position: 2, drawCount: 5 }
		});
		expect(badSection.status()).toBe(422);

		// Attach one of the seeded, published N4 VOCAB_KANJI questions.
		const attach = await page.request.post(`/api/v1/admin/quizzes/${quizId}/questions`, {
			data: { questionId: '01JSEEDQ000100000000000000', section: 'VOCAB_KANJI' }
		});
		expect(attach.status()).toBe(201);

		// Duplicate attach is a conflict.
		const duplicateAttach = await page.request.post(`/api/v1/admin/quizzes/${quizId}/questions`, {
			data: { questionId: '01JSEEDQ000100000000000000', section: 'VOCAB_KANJI' }
		});
		expect(duplicateAttach.status()).toBe(409);

		const detail = await page.request.get(`/api/v1/admin/quizzes/${quizId}`);
		expect(detail.status()).toBe(200);
		const detailBody = (await detail.json()) as {
			data: { attached: { questionId: string }[]; blockers: string[] };
		};
		expect(detailBody.data.attached).toHaveLength(1);
		expect(detailBody.data.blockers).toEqual([]);

		const published = await page.request.put(`/api/v1/admin/quizzes/${quizId}/publication`);
		expect(published.status()).toBe(200);
		await expect(published.json()).resolves.toMatchObject({ data: { status: 'PUBLISHED' } });

		const detach = await page.request.delete(
			`/api/v1/admin/quizzes/${quizId}/questions/01JSEEDQ000100000000000000`
		);
		expect(detach.status()).toBe(204);

		const detachAgain = await page.request.delete(
			`/api/v1/admin/quizzes/${quizId}/questions/01JSEEDQ000100000000000000`
		);
		expect(detachAgain.status()).toBe(404);

		const archived = await page.request.delete(`/api/v1/admin/quizzes/${quizId}/publication`);
		expect(archived.status()).toBe(200);
		await expect(archived.json()).resolves.toMatchObject({ data: { status: 'ARCHIVED' } });
	});

	test('rejects an update field the schema does not recognize', async ({ page }) => {
		const created = await page.request.post('/api/v1/admin/quizzes', {
			data: { title: 'x', mode: 'JLPT_PRACTICE', level: 'N4', selectionMode: 'FIXED' }
		});
		const { data } = (await created.json()) as { data: { id: string } };

		const response = await page.request.patch(`/api/v1/admin/quizzes/${data.id}`, {
			data: { bogusField: 1 }
		});
		expect(response.status()).toBe(422);
		await expect(response.json()).resolves.toMatchObject({ code: 'validation_failed' });
	});

	test('malformed identifiers and JSON are rejected before touching the database', async ({
		page
	}) => {
		const badId = await page.request.get('/api/v1/admin/quizzes/not-a-ulid');
		expect(badId.status()).toBe(400);
		await expect(badId.json()).resolves.toMatchObject({ code: 'invalid_identifier' });

		const badJson = await page.request.post('/api/v1/admin/quizzes', {
			headers: { 'content-type': 'application/json' },
			data: Buffer.from('{not valid json')
		});
		expect(badJson.status()).toBe(400);
		await expect(badJson.json()).resolves.toMatchObject({ code: 'invalid_json' });

		// text/plain is itself one of the form-like content types SvelteKit's own built-in
		// CSRF guard gates on the Origin header, so a matching one is needed here too, to
		// reach our own content-type check (415) instead of SvelteKit's guard (403).
		const wrongContentType = await page.request.post('/api/v1/admin/quizzes', {
			headers: { 'content-type': 'text/plain', origin: 'http://localhost:4173' },
			data: 'title=x'
		});
		expect(wrongContentType.status()).toBe(415);
	});
});

test.describe('admin API v1 — question lifecycle', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page.context(), ADMIN_SESSION);
	});

	test('creates, updates, publishes and archives a question', async ({ page }) => {
		const created = await page.request.post('/api/v1/admin/questions', {
			data: {
				stem: 'E2E question stem',
				level: 'N4',
				section: 'VOCAB_KANJI',
				options: [
					{ body: 'A', isCorrect: true },
					{ body: 'B', isCorrect: false }
				]
			}
		});
		expect(created.status()).toBe(201);
		const { data: createdQuestion } = (await created.json()) as { data: { id: string } };
		const questionId = createdQuestion.id;

		const updated = await page.request.patch(`/api/v1/admin/questions/${questionId}`, {
			data: { points: 5 }
		});
		expect(updated.status()).toBe(200);
		await expect(updated.json()).resolves.toMatchObject({ data: { points: 5 } });

		const detail = await page.request.get(`/api/v1/admin/questions/${questionId}`);
		const detailBody = (await detail.json()) as { data: { options: { body: string }[] } };
		expect(detailBody.data.options).toHaveLength(2); // preserved: the patch never touched options

		const published = await page.request.put(`/api/v1/admin/questions/${questionId}/publication`);
		expect(published.status()).toBe(200);
		await expect(published.json()).resolves.toMatchObject({ data: { status: 'PUBLISHED' } });

		const archived = await page.request.delete(`/api/v1/admin/questions/${questionId}/publication`);
		expect(archived.status()).toBe(200);
		await expect(archived.json()).resolves.toMatchObject({ data: { status: 'ARCHIVED' } });
	});

	test('rejects a question with fewer than two options', async ({ page }) => {
		const response = await page.request.post('/api/v1/admin/questions', {
			data: {
				stem: 'x',
				level: 'N4',
				section: 'VOCAB_KANJI',
				options: [{ body: 'A', isCorrect: true }]
			}
		});
		expect(response.status()).toBe(422);
	});
});

test.describe('admin API v1 — media lifecycle', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page.context(), ADMIN_SESSION);
	});

	test('uploads, reads, updates and deletes an image', async ({ page }) => {
		const uploaded = await page.request.post('/api/v1/admin/media', {
			// SvelteKit's own built-in CSRF guard gates every form-like content type
			// (multipart/form-data included) on the Origin header matching the request's
			// own origin — the same thing `tests/e2e/admin.e2e.ts` already works around for
			// its own form-action CSRF coverage. A real browser's `fetch` sends this
			// automatically; Playwright's API request context does not.
			headers: { origin: 'http://localhost:4173' },
			multipart: {
				file: { name: 'sample.png', mimeType: 'image/png', buffer: readFileSync(SAMPLE_IMAGE) },
				altText: 'a red square'
			}
		});
		expect(uploaded.status()).toBe(201);
		expect(uploaded.headers()['location']).toBeTruthy();
		const { data: asset } = (await uploaded.json()) as { data: { id: string; kind: string } };
		expect(asset.kind).toBe('IMAGE');

		const patched = await page.request.patch(`/api/v1/admin/media/${asset.id}`, {
			data: { altText: 'updated alt text' }
		});
		expect(patched.status()).toBe(200);
		await expect(patched.json()).resolves.toMatchObject({ data: { altText: 'updated alt text' } });

		// Setting the field that belongs to the OTHER kind is a validation failure.
		const wrongField = await page.request.patch(`/api/v1/admin/media/${asset.id}`, {
			data: { transcript: 'nope' }
		});
		expect(wrongField.status()).toBe(422);

		const deleted = await page.request.delete(`/api/v1/admin/media/${asset.id}`);
		expect(deleted.status()).toBe(204);

		const goneNow = await page.request.get(`/api/v1/admin/media/${asset.id}`);
		expect(goneNow.status()).toBe(404);
	});

	test('rejects SVG uploads with 415 and empty files with 422', async ({ page }) => {
		const origin = { origin: 'http://localhost:4173' };
		const svg = await page.request.post('/api/v1/admin/media', {
			headers: origin,
			multipart: {
				file: { name: 'x.svg', mimeType: 'image/svg+xml', buffer: Buffer.from('<svg/>') }
			}
		});
		expect(svg.status()).toBe(415);

		const empty = await page.request.post('/api/v1/admin/media', {
			headers: origin,
			multipart: { file: { name: 'x.png', mimeType: 'image/png', buffer: Buffer.alloc(0) } }
		});
		expect(empty.status()).toBe(422);
	});

	test('refuses to delete media still referenced by a question', async ({ page }) => {
		// Seeded asset 1 is attached to seeded question 1.
		const response = await page.request.delete('/api/v1/admin/media/01JSEEDASSETPNG00000000000');
		expect(response.status()).toBe(409);
		await expect(response.json()).resolves.toMatchObject({ code: 'media_in_use' });
	});
});
