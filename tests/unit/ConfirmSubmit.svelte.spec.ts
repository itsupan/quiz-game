import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';

import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';

describe('ConfirmSubmit', () => {
	it('can open programmatically and target another form', async () => {
		const screen = render(ConfirmSubmit, {
			label: 'Submit attempt',
			title: 'Submit this attempt?',
			message: 'Anything left blank is scored as unanswered.',
			confirmLabel: 'Submit attempt',
			form: 'active-answer-form',
			formaction: '?/answer',
			name: 'finish',
			value: 'true',
			open: true
		});
		const dialog = screen.getByRole('dialog');
		const trigger = screen.getByRole('button', { name: 'Submit attempt' }).first();

		await expect.element(dialog).toBeVisible();
		await expect.element(trigger).toHaveAttribute('form', 'active-answer-form');
		await expect.element(trigger).toHaveAttribute('formaction', '?/answer');

		await screen.getByRole('button', { name: 'Cancel' }).click();

		const dialogElement = (await screen.getByText('Submit this attempt?').element()).closest(
			'dialog'
		) as HTMLDialogElement;
		expect(dialogElement.open).toBe(false);
	});
});
