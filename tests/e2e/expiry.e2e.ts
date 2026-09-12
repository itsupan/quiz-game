import { expect, test } from '@playwright/test';
import { LEARNER_SESSION, signIn } from './sessions';

/**
 * Time-limit expiry, on a real clock rather than a faked one.
 *
 * Seeded quiz `01JSEEDQZN5TEST00000000000` gives its first section three seconds and the
 * sitting eight. This watches a real section advance and a real final expiry, with no
 * seeded past-dated attempt or test-only application path.
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

		// Save the first section's answer before its own shorter clock runs out.
		await page.getByRole('radio', { name: 'ほん' }).check();
		await page.getByRole('button', { name: 'Save answer' }).click();
		await expect(page.getByText('Saved.')).toBeVisible();

		// The section countdown posts to the advance action. It must move to the next open
		// section rather than trapping the learner on a form the server refuses to save.
		await expect(page.getByText('Question 2 of 2')).toBeVisible({ timeout: 5000 });
		await expect(page.getByText('GRAMMAR_READING')).toBeVisible();

		// The quiz's own eight-second deadline still closes and scores the whole sitting.
		await page.waitForTimeout(5500);
		await page.reload();

		await expect(page).toHaveURL(/\/result$/);
		await expect(page.getByText('Time ran out')).toBeVisible();
		await expect(page.getByText('1 / 2 correct (1 of 2)')).toBeVisible();
	});
});
