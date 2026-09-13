import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';

import OptionList from '$lib/features/quiz/OptionList.svelte';
import '../../src/routes/layout.css';

const options = [
	{ number: 1, body: 'びょういん' },
	{ number: 2, body: 'びよういん' },
	{ number: 3, body: 'びょうえん' }
];

describe('OptionList', () => {
	it('selects an answer when the visible option row is clicked', async () => {
		const screen = render(OptionList, {
			name: 'selectedOptionId',
			options,
			selectedOptionId: null
		});

		await screen.getByRole('radio', { name: 'びよういん' }).click();

		await expect.element(screen.getByRole('radio', { name: 'びよういん' })).toBeChecked();
	});

	it('highlights a row it is clicked, before selectedOptionId ever changes', async () => {
		// Regression test: the live attempt page's `selectedOptionId` prop only updates
		// after the answer round-trips through the server, so this highlight must come from
		// the radio's own native `:checked` state, not from the `selectedOptionId` prop.
		const screen = render(OptionList, {
			name: 'selectedOptionId',
			options,
			selectedOptionId: null
		});

		await screen.getByRole('radio', { name: 'びよういん' }).click();

		const radio = await screen.getByRole('radio', { name: 'びよういん' }).element();
		const row = radio.closest('label') as HTMLLabelElement;

		expect(row).not.toBeNull();
		// `transition-colors` animates the change, so poll rather than reading the color
		// synchronously right after the click.
		await expect.poll(() => getComputedStyle(row).borderColor).toBe('rgb(182, 37, 31)');
	});

	it('gives the selected row a persistent red treatment', async () => {
		const screen = render(OptionList, {
			name: 'selectedOptionId',
			options,
			selectedOptionId: 1
		});
		const radio = await screen.getByRole('radio', { name: 'びょういん' }).element();
		const row = radio.closest('label');

		expect(row).not.toBeNull();
		expect(getComputedStyle(row as HTMLLabelElement).borderColor).toBe('rgb(182, 37, 31)');
		expect(getComputedStyle(row as HTMLLabelElement).backgroundColor).toBe('rgb(254, 243, 242)');
	});

	it('marks the correct option green in review mode, even when it was the one picked', async () => {
		const screen = render(OptionList, {
			name: 'selectedOptionId',
			options,
			selectedOptionId: 1,
			correctOptionNumber: 1
		});
		const radio = await screen.getByRole('radio', { name: 'びょういん' }).element();
		const row = radio.closest('label');

		expect(row).not.toBeNull();
		expect(getComputedStyle(row as HTMLLabelElement).borderColor).toBe('rgb(6, 118, 71)');
	});

	it('marks a wrong pick red and the real answer green in review mode', async () => {
		const screen = render(OptionList, {
			name: 'selectedOptionId',
			options,
			selectedOptionId: 1,
			correctOptionNumber: 2
		});
		const pickedRow = (await screen.getByRole('radio', { name: 'びょういん' }).element()).closest(
			'label'
		);
		const correctRow = (await screen.getByRole('radio', { name: 'びよういん' }).element()).closest(
			'label'
		);

		expect(getComputedStyle(pickedRow as HTMLLabelElement).borderColor).toBe('rgb(182, 37, 31)');
		expect(getComputedStyle(correctRow as HTMLLabelElement).borderColor).toBe('rgb(6, 118, 71)');
	});

	it('disables every answer while media is not ready', async () => {
		const screen = render(OptionList, {
			name: 'selectedOptionId',
			options,
			selectedOptionId: null,
			disabled: true
		});

		const radios = screen.getByRole('radio').elements() as HTMLInputElement[];

		expect(radios).toHaveLength(options.length);
		expect(radios.every((radio) => radio.matches(':disabled'))).toBe(true);
	});
});
