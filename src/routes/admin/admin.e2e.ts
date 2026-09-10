import { expect, test, type Browser, type Page } from '@playwright/test';

import { ADMIN_SESSION, LEARNER_SESSION, signIn } from '../../../e2e/sessions';

/**
 * The dashboard end to end, against a real worker and a real D1 database.
 *
 * Identity comes from a real session row seeded by `seeds/e2e-sessions.sql` — the same
 * table, the same hashed-token lookup and the same `validateSession` call a signed-in
 * person goes through. There is no test-only authentication path in the application.
 */
async function signInAsLearner({ page }: { page: Page }) {
	await signIn(page.context(), LEARNER_SESSION);
}

/**
 * What a learner actually sees on the public listing.
 *
 * It has to be a learner's own session: an administrator visiting /home is redirected
 * to /admin, so asserting the listing from the admin's page would only ever prove the
 * redirect fired. Returns the titles currently listed.
 */
async function learnerHomeTitles(browser: Browser, title: string) {
	const context = await browser.newContext();

	await signIn(context, LEARNER_SESSION);

	const learnerPage = await context.newPage();

	await learnerPage.goto('/home');

	const count = await learnerPage.getByRole('listitem').filter({ hasText: title }).count();

	await context.close();

	return count;
}

test.describe('admin authorization', () => {
	test.beforeEach(signInAsLearner);

	for (const path of ['/admin', '/admin/quizzes', '/admin/questions', '/admin/questions/new']) {
		test(`refuses a signed-in learner at ${path}`, async ({ page }) => {
			const response = await page.goto(path);

			// 403, not a redirect to sign in: they ARE signed in, so signing in again
			// would change nothing.
			expect(response?.status()).toBe(403);
		});
	}

	test('refuses a learner posting straight to an action, not just visiting a page', async ({
		page
	}) => {
		// SvelteKit runs a form action BEFORE the loads of its page, so a guard in
		// /admin/+layout.server.ts would not have seen this request until the quiz was
		// already archived. The gate is in hooks.server.ts for exactly this reason.
		// `page.request` shares the browser context's cookies; the standalone `request`
		// fixture has its own jar and would arrive as the default administrator.
		const response = await page.request.post('/admin/quizzes?/archive', {
			headers: { origin: 'http://localhost:4173' },
			form: { publicId: '01JSEEDQZN4EXAM00000000000' },
			maxRedirects: 0
		});

		expect(response.status()).toBe(403);

		// And the quiz it aimed at is untouched — a 403 returned after the write would
		// look identical from here.
		await page.goto('/home');
		await expect(
			page.getByRole('listitem').filter({ hasText: 'JLPT N4 模擬本試験' })
		).toBeVisible();
	});
});

test.describe('as an administrator', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page.context(), ADMIN_SESSION);
	});

	test('shows the seeded content on the overview', async ({ page }) => {
		await page.goto('/admin');

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overview');

		// At least the seeded content. Not an exact count: local D1 persists between runs,
		// and these tests create rows.
		await expect(page.getByTestId('total-quizzes')).toHaveText(/^\d+$/);
		expect(Number(await page.getByTestId('total-quizzes').innerText())).toBeGreaterThanOrEqual(3);
		expect(Number(await page.getByTestId('total-questions').innerText())).toBeGreaterThanOrEqual(
			13
		);
	});

	test('refuses a question with no answer key, then accepts one with exactly one', async ({
		page
	}) => {
		await page.goto('/admin/questions/new');

		const stem = `テスト問題 ${Date.now()}`;

		await page.getByLabel('Question text').fill(stem);
		await page.getByLabel('Option 1', { exact: true }).fill('せいかい');
		await page.getByLabel('Option 2', { exact: true }).fill('ふせいかい');
		await page.getByLabel('Option 3', { exact: true }).fill('まちがい');
		await page.getByLabel('Option 4', { exact: true }).fill('ちがう');

		// No radio selected: the one failure the partial unique index cannot catch.
		await page.getByRole('button', { name: 'Create question' }).click();

		await expect(page.getByRole('alert')).toContainText('correct answer');
		await expect(page).toHaveURL(/\/admin\/questions\/new/);

		await page.getByLabel('Option 1 is the correct answer').check();
		await page.getByRole('button', { name: 'Create question' }).click();

		// Redirected to the edit page, which means the row exists.
		await expect(page).toHaveURL(/\/admin\/questions\/[0-9A-HJKMNP-TV-Z]{26}$/);
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit question');

		await page.goto('/admin/questions');
		await expect(page.getByRole('link', { name: stem })).toBeVisible();
	});

	test('creates questions as drafts, and the status filter separates them', async ({ page }) => {
		const stem = `下書き問題 ${Date.now()}`;

		await page.goto('/admin/questions/new');
		await page.getByLabel('Question text').fill(stem);
		await page.getByLabel('Option 1', { exact: true }).fill('あ');
		await page.getByLabel('Option 2', { exact: true }).fill('い');
		await page.getByLabel('Option 3', { exact: true }).fill('う');
		await page.getByLabel('Option 4', { exact: true }).fill('え');
		await page.getByLabel('Option 1 is the correct answer').check();
		await page.getByRole('button', { name: 'Create question' }).click();

		// New content is never published by accident; publishing is its own act.
		await expect(page.getByText('draft')).toBeVisible();

		await page.goto('/admin/questions?status=DRAFT');
		await expect(page.getByRole('link', { name: stem })).toBeVisible();

		await page.goto('/admin/questions?status=PUBLISHED');
		await expect(page.getByRole('link', { name: stem })).toHaveCount(0);
	});

	test('moves the answer key and drops a row in one save', async ({ page }) => {
		// The riskiest write in the dashboard. `question_options_one_correct_idx` is
		// checked per statement, so the old key must be cleared before the new one is set,
		// and `question_options_position_idx` is unique per (question, position), so the
		// surviving rows have to be parked before they are renumbered. Both only fail
		// against a real database.
		const stem = `並べ替え ${Date.now()}`;

		await page.goto('/admin/questions/new');
		await page.getByLabel('Question text').fill(stem);
		await page.getByLabel('Option 1', { exact: true }).fill('いち');
		await page.getByLabel('Option 2', { exact: true }).fill('に');
		await page.getByLabel('Option 3', { exact: true }).fill('さん');
		await page.getByLabel('Option 4', { exact: true }).fill('よん');
		await page.getByLabel('Option 1 is the correct answer').check();
		await page.getByRole('button', { name: 'Create question' }).click();

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit question');

		// Move the key off row 1, then delete row 1 entirely: every surviving option
		// changes position and the key changes row, in a single submit.
		await page.getByLabel('Option 3 is the correct answer').check();
		await page.getByRole('button', { name: 'Remove option 1' }).click();
		await page.getByRole('button', { name: 'Save changes' }).click();

		await expect(page.getByRole('alert')).toContainText('Saved.');

		await page.reload();

		await expect(page.getByLabel('Option 1', { exact: true })).toHaveValue('に');
		await expect(page.getByLabel('Option 2', { exact: true })).toHaveValue('さん');
		await expect(page.getByLabel('Option 3', { exact: true })).toHaveValue('よん');
		await expect(page.getByLabel('Option 2 is the correct answer')).toBeChecked();
		await expect(page.getByLabel('Option 1 is the correct answer')).not.toBeChecked();
	});

	test('creates a quiz, adds a section, and only then allows publishing', async ({ page }) => {
		await page.goto('/admin/quizzes/new');

		const title = `テストクイズ ${Date.now()}`;

		await page.getByLabel('Title').fill(title);
		await page.getByLabel('Mode').selectOption('MOCK_TEST');
		await page.getByLabel('Time limit (minutes)').fill('');

		// A mock test with no clock is a misconfiguration, so it is refused.
		await page.getByRole('button', { name: 'Create quiz' }).click();
		await expect(page.getByRole('alert')).toContainText('time limit');

		await page.getByLabel('Time limit (minutes)').fill('90');
		await page.getByRole('button', { name: 'Create quiz' }).click();

		await expect(page.getByRole('heading', { level: 1 })).toHaveText(title);
		await expect(page.getByTestId('no-sections')).toBeVisible();
		await expect(page.getByRole('list', { name: 'Blocking publication' })).toContainText(
			'at least one section'
		);

		await page.getByRole('combobox', { name: 'Section', exact: true }).selectOption('LISTENING');
		await page.getByLabel('Position').fill('1');
		await page.getByRole('button', { name: 'Add section' }).click();

		await expect(page.getByRole('alert')).toContainText('Section saved.');
		await expect(page.getByRole('rowheader', { name: 'LISTENING' })).toBeVisible();

		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByRole('alert')).toContainText('Published.');
	});

	test('asks before archiving, and archiving takes the quiz off the homepage', async ({
		page,
		browser
	}) => {
		// Self-contained: the seed is applied with ON CONFLICT DO NOTHING, so archiving a
		// seeded quiz would leave it archived and break this test on the next run.
		const title = `アーカイブ確認 ${Date.now()}`;

		await page.goto('/admin/quizzes/new');
		await page.getByLabel('Title').fill(title);
		await page.getByLabel('Mode').selectOption('JLPT_PRACTICE');
		await page.getByRole('button', { name: 'Create quiz' }).click();

		await page.getByRole('combobox', { name: 'Section', exact: true }).selectOption('VOCAB_KANJI');
		await page.getByRole('button', { name: 'Add section' }).click();
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByRole('alert')).toContainText('Published.');

		expect(await learnerHomeTitles(browser, title)).toBe(1);

		await page.getByRole('button', { name: 'Archive' }).click();

		// A real dialog element, not a blocking window.confirm.
		const dialog = page.getByRole('dialog');
		await expect(dialog).toBeVisible();
		await expect(dialog).toContainText('disappears from the homepage');

		await dialog.getByRole('button', { name: 'Archive quiz' }).click();
		await expect(page.getByRole('alert')).toContainText('Archived.');

		expect(await learnerHomeTitles(browser, title)).toBe(0);
	});

	test('cancelling the confirmation changes nothing', async ({ page }) => {
		await page.goto('/admin/quizzes?level=N3');

		const row = page.getByRole('row').filter({ hasText: 'JLPT N3 模擬試験' });

		await row.getByRole('button', { name: 'Archive' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Cancel' }).click();

		await expect(page.getByRole('dialog')).toBeHidden();
		await expect(row).toContainText('published');
	});

	test('refuses a media file the allowlist does not cover', async ({ page }) => {
		await page.goto('/admin/media');

		await page.getByRole('button', { name: 'File', exact: true }).setInputFiles({
			name: 'notes.pdf',
			mimeType: 'application/pdf',
			buffer: Buffer.from('%PDF-1.4')
		});
		await page.getByRole('button', { name: 'Upload' }).click();

		await expect(page.getByRole('alert')).toContainText('file type is not accepted');
	});

	test('uploads an image and serves it back through the worker', async ({ page }) => {
		await page.goto('/admin/media');

		// A one-pixel PNG, the smallest thing that is genuinely a PNG.
		const png = Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
			'base64'
		);

		await page.getByRole('button', { name: 'File', exact: true }).setInputFiles({
			name: 'timetable.png',
			mimeType: 'image/png',
			buffer: png
		});
		await page.getByLabel('Alt text (images)').fill('駅の時刻表');
		await page.getByRole('button', { name: 'Upload' }).click();

		await expect(page.getByRole('alert')).toContainText('Uploaded timetable.png');

		const image = page.getByAltText('駅の時刻表').first();
		await expect(image).toBeVisible();

		// The bytes come back through the worker, from the private bucket.
		const src = await image.getAttribute('src');
		const served = await page.request.get(src as string);

		expect(served.status()).toBe(200);
		expect(served.headers()['content-type']).toBe('image/png');
		expect((await served.body()).byteLength).toBe(png.byteLength);
	});

	test('blocks publishing a question whose image has no alt text, and unblocks it once described', async ({
		page
	}) => {
		const filename = `undescribed-${Date.now()}.png`;
		const png = Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
			'base64'
		);

		await page.goto('/admin/media');
		await page.getByRole('button', { name: 'File', exact: true }).setInputFiles({
			name: filename,
			mimeType: 'image/png',
			buffer: png
		});
		// Deliberately no alt text.
		await page.getByRole('button', { name: 'Upload' }).click();
		await expect(page.getByRole('alert')).toContainText(`Uploaded ${filename}`);

		await page.goto('/admin/questions/new');
		await page.getByLabel('Question text').fill(`画像問題 ${Date.now()}`);
		await page.getByLabel('Option 1', { exact: true }).fill('あ');
		await page.getByLabel('Option 2', { exact: true }).fill('い');
		await page.getByLabel('Option 3', { exact: true }).fill('う');
		await page.getByLabel('Option 4', { exact: true }).fill('え');
		await page.getByLabel('Option 1 is the correct answer').check();
		// The picker says so before it is attached, not only after publishing fails.
		await page.getByLabel('Image').selectOption({ label: `${filename} — not yet described` });
		await page.getByRole('button', { name: 'Create question' }).click();

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit question');

		const questionUrl = page.url();

		await expect(page.getByRole('list', { name: 'Blocking publication' })).toContainText(
			'needs alt text'
		);

		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByRole('alert')).toContainText('needs alt text');
		await expect(page.getByText('draft')).toBeVisible();

		// Describing the file once clears it for every question that uses it.
		await page.goto('/admin/media');
		const card = page.getByRole('listitem').filter({ hasText: filename });
		await card.getByLabel('Alt text').fill('駅の時刻表');
		await card.getByRole('button', { name: 'Save description' }).click();
		await expect(page.getByRole('alert')).toContainText('Description saved.');

		await page.goto(questionUrl);
		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByRole('alert')).toContainText('Published.');
	});

	test('refuses to delete a file a question still uses', async ({ page }) => {
		const filename = `inuse-${Date.now()}.png`;
		const png = Buffer.from(
			'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
			'base64'
		);

		await page.goto('/admin/media');
		await page.getByRole('button', { name: 'File', exact: true }).setInputFiles({
			name: filename,
			mimeType: 'image/png',
			buffer: png
		});
		await page.getByLabel('Alt text (images)').fill('使用中の画像');
		await page.getByRole('button', { name: 'Upload' }).click();

		await page.goto('/admin/questions/new');
		await page.getByLabel('Question text').fill(`使用中 ${Date.now()}`);
		await page.getByLabel('Option 1', { exact: true }).fill('あ');
		await page.getByLabel('Option 2', { exact: true }).fill('い');
		await page.getByLabel('Option 3', { exact: true }).fill('う');
		await page.getByLabel('Option 4', { exact: true }).fill('え');
		await page.getByLabel('Option 1 is the correct answer').check();
		await page.getByLabel('Image').selectOption({ label: filename });
		await page.getByRole('button', { name: 'Create question' }).click();
		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit question');

		await page.goto('/admin/media');
		const card = page.getByRole('listitem').filter({ hasText: filename });

		await card.getByRole('button', { name: 'Delete' }).click();
		await page.getByRole('dialog').getByRole('button', { name: 'Delete permanently' }).click();

		// ON DELETE RESTRICT would have raised a raw constraint failure; this is the
		// sentence that replaces it.
		await expect(page.getByRole('alert')).toContainText('used by 1 question');
		await expect(card).toBeVisible();
	});

	test("keeps a question's media attached when it is saved unchanged", async ({ page }) => {
		// Regression: the media <select> was given a string value while its options carried
		// numbers, so Svelte matched nothing, the picker rendered blank, and every save
		// silently detached the file.
		const filename = `keepme-${Date.now()}.png`;

		await page.goto('/admin/media');
		await page.getByRole('button', { name: 'File', exact: true }).setInputFiles({
			name: filename,
			mimeType: 'image/png',
			buffer: Buffer.from(
				'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
				'base64'
			)
		});
		await page.getByLabel('Alt text (images)').fill('残る画像');
		await page.getByRole('button', { name: 'Upload' }).click();

		await page.goto('/admin/questions/new');
		await page.getByLabel('Question text').fill(`添付維持 ${Date.now()}`);
		for (const [index, body] of ['あ', 'い', 'う', 'え'].entries()) {
			await page.getByLabel(`Option ${index + 1}`, { exact: true }).fill(body);
		}
		await page.getByLabel('Option 1 is the correct answer').check();
		await page.getByLabel('Image').selectOption({ label: filename });
		await page.getByRole('button', { name: 'Create question' }).click();

		await expect(page.getByRole('heading', { level: 1 })).toHaveText('Edit question');

		// The picker must come back already showing the attachment...
		await expect(page.getByLabel('Image')).not.toHaveValue('');

		// ...and saving without touching it must not clear it.
		await page.getByRole('button', { name: 'Save changes' }).click();
		await expect(page.getByRole('alert')).toContainText('Saved.');

		await page.reload();
		await expect(page.getByLabel('Image')).not.toHaveValue('');
		await expect(page.getByRole('list', { name: 'Blocking publication' })).toHaveCount(0);
	});

	test("refuses to edit another question's options", async ({ page }) => {
		// Option ids arrive in hidden inputs. Unscoped, a POST to question A carrying
		// question B's ids rewrote B and wiped A.
		const victimStem = `被害 ${Date.now()}`;

		await page.goto('/admin/questions/new');
		await page.getByLabel('Question text').fill(victimStem);
		for (const [index, body] of ['ひとつ', 'ふたつ', 'みっつ', 'よっつ'].entries()) {
			await page.getByLabel(`Option ${index + 1}`, { exact: true }).fill(body);
		}
		await page.getByLabel('Option 1 is the correct answer').check();
		await page.getByRole('button', { name: 'Create question' }).click();

		const victimUrl = page.url();
		const victimOptionIds = await page
			.locator('input[name="optionId"]')
			.evaluateAll((inputs) => inputs.map((input) => (input as HTMLInputElement).value));

		const attackerStem = `攻撃 ${Date.now()}`;
		await page.goto('/admin/questions/new');
		await page.getByLabel('Question text').fill(attackerStem);
		for (const [index, body] of ['a', 'b', 'c', 'd'].entries()) {
			await page.getByLabel(`Option ${index + 1}`, { exact: true }).fill(body);
		}
		await page.getByLabel('Option 1 is the correct answer').check();
		await page.getByRole('button', { name: 'Create question' }).click();

		const attackerUrl = page.url();

		// Post the victim's option ids to the attacker's update action.
		const body = new URLSearchParams();
		body.set('stem', attackerStem);
		body.set('level', 'N4');
		body.set('section', 'VOCAB_KANJI');
		body.set('points', '1');
		body.set('correctOption', '0');
		for (const id of victimOptionIds) {
			body.append('optionId', id);
			body.append('optionBody', 'PWNED');
		}

		const response = await page.request.post(`${attackerUrl}?/update`, {
			headers: {
				'content-type': 'application/x-www-form-urlencoded',
				// Without a matching origin SvelteKit rejects the POST as CSRF before any
				// action runs, and this test would pass without proving anything.
				origin: 'http://localhost:4173'
			},
			data: body.toString()
		});

		expect(response.status(), 'the action must actually run, not be refused as CSRF').toBe(200);

		await page.goto(victimUrl);

		// The victim is untouched: same four options, same answer key.
		await expect(page.getByLabel('Option 1', { exact: true })).toHaveValue('ひとつ');
		await expect(page.getByLabel('Option 4', { exact: true })).toHaveValue('よっつ');
		await expect(page.getByLabel('Option 1 is the correct answer')).toBeChecked();

		// And the attacker's own question keeps its options rather than being emptied by
		// the delete that clears anything not in the submitted id list.
		await page.goto(attackerUrl);
		await expect(page.getByLabel('Option 1', { exact: true })).toHaveValue('a');
		await expect(page.getByLabel('Option 4', { exact: true })).toHaveValue('d');
	});

	test('will not publish a random quiz whose sections draw nothing, and lets it be fixed', async ({
		page
	}) => {
		// Draw counts are validated against the quiz's mode when a section is added, so a
		// quiz built as FIXED and switched to RANDOM used to publish while drawing zero.
		const title = `抽選なし ${Date.now()}`;

		await page.goto('/admin/quizzes/new');
		await page.getByLabel('Title').fill(title);
		await page.getByLabel('Mode').selectOption('JLPT_PRACTICE');
		await page.getByRole('button', { name: 'Create quiz' }).click();

		await page.getByRole('combobox', { name: 'Section', exact: true }).selectOption('VOCAB_KANJI');
		await page.getByRole('button', { name: 'Add section' }).click();

		await page.getByRole('combobox', { name: 'Questions', exact: true }).selectOption('RANDOM');
		await page.getByRole('button', { name: 'Save details' }).click();

		await expect(page.getByRole('list', { name: 'Blocking publication' })).toContainText(
			'needs a draw count'
		);

		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByRole('alert')).toContainText('needs a draw count');

		// The row is editable, so the missing number can actually be supplied.
		await page.getByLabel('Questions drawn for VOCAB_KANJI').fill('5');
		await page.getByRole('button', { name: 'Save', exact: true }).click();
		await expect(page.getByRole('alert')).toContainText('Section saved.');

		await page.getByRole('button', { name: 'Publish' }).click();
		await expect(page.getByRole('alert')).toContainText('Published.');
	});
});
