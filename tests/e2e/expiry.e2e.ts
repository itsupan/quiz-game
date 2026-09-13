import { expect, test } from '@playwright/test';
import { LEARNER_SESSION, signIn } from './sessions';

/**
 * Time-limit expiry, on a real clock rather than a faked one.
 *
 * Seeded quiz `01JSEEDQZN5TEST00000000000` gives its first section three seconds and the
 * sitting eight. There is no separate "save" step in this app: an answer is written the
 * moment you move to another question (see `+page.svelte`'s single `?/answer` action,
 * which both PUTs the answer and redirects), so answering the first section's only
 * question and moving on is itself what "saving before the section clock runs out" means.
 * This watches a real final expiry, with no seeded past-dated attempt or test-only
 * application path.
 */
test.describe('timer expiry', () => {
	test.beforeEach(async ({ page }) => {
		await signIn(page.context(), LEARNER_SESSION);
	});

	test('saves what was answered and produces a result once time runs out', async ({ page }) => {
		await page.goto('/quiz/01JSEEDQZN5TEST00000000000');
		await page.getByRole('button', { name: 'Start' }).click();

		await expect(page).toHaveURL(/\/quiz\/attempt\//);
		await expect(page.getByText('Question 1 of 2')).toBeVisible();

		// Answer and move on well within the first section's own three-second clock — this
		// single action both saves the answer and completes the section.
		await page.getByRole('radio', { name: 'ほん' }).check();
		await page.getByRole('button', { name: 'Next' }).click();

		await expect(page.getByText('Question 2 of 2')).toBeVisible();
		await expect(page.getByText('GRAMMAR READING')).toBeVisible();

		// Leave the second question unanswered and let the sitting's own eight-second
		// deadline close and score the whole attempt.
		await page.waitForTimeout(5500);
		await page.reload();

		await expect(page).toHaveURL(/\/result$/);
		await expect(page.getByText('Time ran out')).toBeVisible();
		await expect(page.getByText('1 of 2 correct')).toBeVisible();
	});
});
