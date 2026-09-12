import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';

import QuestionForm from '$lib/features/questions/QuestionForm.svelte';

const initial = {
	stem: 'この漢字の読み方はどれですか。「病院」',
	explanation: '',
	level: 'N4',
	section: 'VOCAB_KANJI',
	points: 1,
	imageMediaId: null,
	audioMediaId: null,
	options: [
		{ id: 1, body: 'びょういん', isCorrect: true },
		{ id: 2, body: 'びよういん', isCorrect: false },
		{ id: 3, body: 'へいいん', isCorrect: false }
	]
};

const props = (overrides: Partial<Parameters<typeof QuestionForm>[1]> = {}) => ({
	submitLabel: 'Save changes',
	initial,
	...overrides
});

describe('QuestionForm', () => {
	it('renders one row per option, with the answer key selected', async () => {
		const screen = render(QuestionForm, props());

		await expect
			.element(screen.getByLabelText('Option 1', { exact: true }))
			.toHaveValue('びょういん');

		const keys = screen.getByRole('radio').elements();

		expect(keys).toHaveLength(3);
		expect(keys.filter((key) => (key as HTMLInputElement).checked)).toHaveLength(1);
	});

	it('cannot express two answer keys at once', async () => {
		// One radio group, so the browser itself enforces what
		// `question_options_one_correct_idx` enforces in SQLite. There is no UI state in
		// which two options are marked.
		const screen = render(QuestionForm, props());
		const keys = screen.getByRole('radio').elements() as HTMLInputElement[];

		await screen.getByRole('radio').nth(2).click();

		expect(keys.map((key) => key.checked)).toEqual([false, false, true]);
	});

	it('shows a validation message beside the field it belongs to', async () => {
		const screen = render(
			QuestionForm,
			props({ errors: { stem: 'Enter the question text.' }, values: { stem: '' } })
		);

		const stem = screen.getByLabelText(/question text/i);

		await expect.element(stem).toHaveAttribute('aria-invalid', 'true');
		await expect.element(screen.getByText('Enter the question text.')).toBeInTheDocument();

		// The message is not merely near the input, it is named as its description, which
		// is what a screen reader announces.
		const describedBy = (await stem.element()).getAttribute('aria-describedby');
		expect(describedBy).toBeTruthy();
		expect(document.getElementById(describedBy as string)?.textContent).toContain(
			'Enter the question text.'
		);
	});

	it('reports a blank option against that row, not the question', async () => {
		const screen = render(
			QuestionForm,
			props({ errors: { 'optionBody.1': 'Enter this option.' } })
		);

		await expect
			.element(screen.getByLabelText('Option 2', { exact: true }))
			.toHaveAttribute('aria-invalid', 'true');
		await expect
			.element(screen.getByLabelText('Option 1', { exact: true }))
			.not.toHaveAttribute('aria-invalid');
	});

	it('adds an option row', async () => {
		const screen = render(QuestionForm, props());

		await screen.getByRole('button', { name: 'Add option' }).click();

		expect(screen.getByRole('radio').elements()).toHaveLength(4);
		await expect.element(screen.getByLabelText('Option 4', { exact: true })).toBeInTheDocument();
	});

	it('renumbers the remaining rows when one is removed', async () => {
		const screen = render(QuestionForm, props());

		await screen.getByRole('button', { name: 'Remove option 1' }).click();

		// Positions are the row order at submit time, so the labels have to renumber or
		// the error keys the server sends back would point at the wrong row.
		const bodies = screen.getByRole('textbox').elements() as HTMLInputElement[];

		expect(bodies.map((input) => input.value)).toContain('びよういん');
		await expect
			.element(screen.getByLabelText('Option 2', { exact: true }))
			.toHaveValue('へいいん');
	});

	it('keeps the answer key on its option when an earlier row is removed', async () => {
		const screen = render(
			QuestionForm,
			props({
				initial: {
					...initial,
					options: [
						{ id: 1, body: 'first', isCorrect: false },
						{ id: 2, body: 'second', isCorrect: true },
						{ id: 3, body: 'third', isCorrect: false }
					]
				}
			})
		);

		await screen.getByRole('button', { name: 'Remove option 1' }).click();

		const keys = screen.getByRole('radio').elements() as HTMLInputElement[];

		expect(keys.map((key) => key.checked)).toEqual([true, false]);
	});

	it('offers only three rows and no remove button when two options remain', async () => {
		const screen = render(
			QuestionForm,
			props({
				initial: {
					...initial,
					options: [
						{ id: 1, body: 'first', isCorrect: true },
						{ id: 2, body: 'second', isCorrect: false }
					]
				}
			})
		);

		// Two is the floor the validator enforces, so the UI stops offering removal there
		// rather than letting a submit fail.
		expect(screen.getByRole('button', { name: /^Remove option/ }).elements()).toHaveLength(0);
	});

	it('starts a new question with four empty options', async () => {
		const screen = render(QuestionForm, props({ initial: { ...initial, options: [] } }));

		expect(screen.getByRole('radio').elements()).toHaveLength(4);
	});
});

describe('QuestionForm after a rejected submit', () => {
	it('re-renders the options that were typed, not the ones that were saved', async () => {
		const screen = render(
			QuestionForm,
			props({
				errors: { stem: 'Enter the question text.' },
				submitted: {
					options: [
						{ id: 1, body: 'edited first' },
						{ id: 2, body: 'edited second' },
						{ id: null, body: 'a row they added' }
					],
					correctOption: 2
				}
			})
		);

		await expect
			.element(screen.getByLabelText('Option 3', { exact: true }))
			.toHaveValue('a row they added');

		const keys = screen.getByRole('radio').elements() as HTMLInputElement[];

		expect(keys.map((key) => key.checked)).toEqual([false, false, true]);
	});

	it('leaves nothing marked when the submit had no answer key', async () => {
		const screen = render(
			QuestionForm,
			props({
				errors: { correctOption: 'Mark exactly one option as the correct answer.' },
				submitted: {
					options: [
						{ id: null, body: 'a' },
						{ id: null, body: 'b' }
					],
					correctOption: -1
				}
			})
		);

		const keys = screen.getByRole('radio').elements() as HTMLInputElement[];

		expect(keys.some((key) => key.checked)).toBe(false);
	});
});

describe('QuestionForm media pickers', () => {
	const media = [
		{ id: 7, kind: 'IMAGE' as const, label: 'timetable.png' },
		{ id: 9, kind: 'AUDIO' as const, label: 'clip.mp3' }
	];

	it('preselects the media already attached to the question', async () => {
		// Regression: the select value is a string and the option values were numbers, so
		// Svelte's strict comparison matched nothing, the picker rendered blank, and
		// saving an unchanged question detached its media.
		const screen = render(
			QuestionForm,
			props({ media, initial: { ...initial, imageMediaId: 7, audioMediaId: 9 } })
		);

		await expect.element(screen.getByLabelText('Image')).toHaveValue('7');
		await expect.element(screen.getByLabelText('Audio')).toHaveValue('9');
	});

	it('selects nothing when no media is attached', async () => {
		const screen = render(QuestionForm, props({ media }));

		await expect.element(screen.getByLabelText('Image')).toHaveValue('');
	});

	it('keeps the chosen media after a rejected submit', async () => {
		const screen = render(
			QuestionForm,
			props({
				media,
				errors: { stem: 'Enter the question text.' },
				values: { imageMediaId: '7' },
				initial: { ...initial, imageMediaId: null }
			})
		);

		await expect.element(screen.getByLabelText('Image')).toHaveValue('7');
	});

	it('offers each asset only in the picker for its kind', async () => {
		const screen = render(QuestionForm, props({ media }));

		const image = (await screen.getByLabelText('Image').element()) as unknown as HTMLSelectElement;
		const audio = (await screen.getByLabelText('Audio').element()) as unknown as HTMLSelectElement;

		expect([...image.options].map((option) => option.textContent)).toEqual([
			'None',
			'timetable.png'
		]);
		expect([...audio.options].map((option) => option.textContent)).toEqual(['None', 'clip.mp3']);
	});
});
