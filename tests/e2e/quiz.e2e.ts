import { expect, test } from '@playwright/test';
import { LEARNER_SESSION, signIn } from './sessions';

/**
 * The whole learner-facing quiz flow, against a real worker and a real D1 database, on
 * the seeded N4 full exam — three sections, an image question and a listening question.
 *
 * Identity is a real seeded session, the same as every other e2e suite in this repo:
 * there is no test-only authentication or scoring path.
 */
test.describe('taking a quiz', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page.context(), LEARNER_SESSION);
	});

	test('the overview shows mode, level, sections and time limit before starting', async ({
		page
	}) => {
		await page.goto('/quiz/01JSEEDQZN4EXAM00000000000');

		await expect(page.getByText('FULL_EXAM', { exact: true })).toBeVisible();
		await expect(page.getByText('N4', { exact: true }).first()).toBeVisible();
		await expect(page.getByText('115 min')).toBeVisible();

		// The three sections, in the paper's own order, each with its own limit.
		const rows = page.getByRole('row');
		await expect(rows.filter({ hasText: 'VOCAB_KANJI' })).toContainText('25 min');
		await expect(rows.filter({ hasText: 'GRAMMAR_READING' })).toContainText('55 min');
		await expect(rows.filter({ hasText: 'LISTENING' })).toContainText('35 min');

		await expect(page.getByText(/cannot be paused/i)).toBeVisible();
		await expect(page.getByRole('button', { name: 'Start' })).toBeVisible();
	});

	test('keeps listening answers locked until the audio can play', async ({ page }) => {
		await page.goto('/quiz/01JSEEDQZN4EXAM00000000000');
		await page.getByRole('button', { name: 'Start' }).click();
		await expect(page).toHaveURL(/\/quiz\/attempt\//);
		const attemptUrl = page.url();

		let releaseAudio = () => {};
		const heldAudio = new Promise<void>((resolve) => {
			releaseAudio = resolve;
		});

		await page.route('**/media/01JSEEDASSETMP300000000000', async (route) => {
			await heldAudio;
			await route.continue();
		});

		await page.goto(`${attemptUrl}?q=5`, { waitUntil: 'domcontentloaded' });

		const answer = page.getByRole('radio', { name: '家に 帰る' });
		await expect(answer).toBeDisabled();

		releaseAudio();
		await expect(answer).toBeEnabled();
	});

	test('completes an attempt with media questions and produces a labelled estimate', async ({
		page
	}) => {
		await page.goto('/quiz/01JSEEDQZN4EXAM00000000000');
		await page.getByRole('button', { name: 'Start' }).click();

		await expect(page).toHaveURL(/\/quiz\/attempt\//);
		await expect(page.getByText('Question 1 of 5')).toBeVisible();

		// The initial payload for a fresh attempt must not carry an answer key.
		expect(await page.content()).not.toMatch(/is_?correct/i);

		// Q1: 病院 — びょういん is correct.
		await page.getByRole('radio', { name: 'びょういん', exact: true }).check();
		await page.getByRole('button', { name: 'Next' }).click();
		await expect(page.getByText('1 answered')).toBeVisible();

		// Q2: left unanswered on purpose, to exercise the skip path.
		await page.getByRole('button', { name: 'Next' }).click();

		// Q3: the image question. Real alt text, real bytes from /media/[publicId].
		const image = page.getByRole('img', { name: '赤い正方形のサンプル画像。' });
		await expect(image).toBeVisible();
		const imageSrc = await image.getAttribute('src');
		const imageResponse = await page.request.get(new URL(imageSrc!, page.url()).href);
		expect(imageResponse.status()).toBe(200);
		expect(imageResponse.headers()['content-type']).toBe('image/png');

		await page.getByRole('radio', { name: '赤', exact: true }).check();
		await page.getByRole('button', { name: 'Next' }).click();

		// Q4: grammar, correct.
		await page.getByRole('radio', { name: 'なりました' }).check();
		await page.getByRole('button', { name: 'Next' }).click();

		// Q5: the listening question. Audio renders, replay works, and — the acceptance
		// criterion this exists for — the transcript is nowhere in the page while the
		// attempt is still open.
		const audio = page.locator('audio');
		await expect(audio).toBeVisible();
		await expect(page.getByRole('button', { name: 'Replay from the start' })).toBeVisible();
		expect(await page.content()).not.toContain('会議を終わります');

		const audioSrc = await audio.getAttribute('src');
		const rangeResponse = await page.request.get(new URL(audioSrc!, page.url()).href, {
			headers: { range: 'bytes=0-100' }
		});
		expect(rangeResponse.status()).toBe(206);
		expect(rangeResponse.headers()['content-range']).toMatch(/^bytes 0-100\/\d+$/);

		// Answer wrong on purpose, to see it reviewed after submission.
		await page.getByRole('radio', { name: '家に 帰る' }).check();
		await page.getByRole('button', { name: 'Save answer' }).click();

		await page.getByRole('button', { name: 'Submit attempt' }).click();
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await dialog.getByRole('button', { name: 'Submit attempt' }).click();

		await expect(page).toHaveURL(/\/result$/);
		await expect(page.getByText('3 / 5 correct (3 of 5)')).toBeVisible();
		await expect(page.getByText(/estimate, not an exam result/i)).toBeVisible();

		// Review: the transcript is now available, behind its own <details> disclosure —
		// collapsed by default is correct, not a bug, so open it before asserting the text.
		await page.getByText('Transcript', { exact: true }).click();
		await expect(page.getByText('会議を終わります')).toBeVisible();
		await expect(page.getByText('You chose 家に 帰る.')).toBeVisible();
		await expect(page.getByText('You left this one unanswered.')).toBeVisible();
	});
});
