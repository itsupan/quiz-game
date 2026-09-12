<script lang="ts">
	import { untrack } from 'svelte';

	import Button from '$lib/components/Button.svelte';
	import Field from '$lib/components/Field.svelte';
	import { JLPT_LEVELS, SECTIONS } from '$lib/domain/enums';

	/**
	 * The question editor, shared by the create and edit pages.
	 *
	 * The answer key is a radio group on purpose. `question_options_one_correct_idx` makes
	 * a second key impossible in the database; a radio group makes it impossible to even
	 * express in the browser, so the only failure left for the validator to describe is
	 * *no* key at all.
	 */
	export type OptionRow = { id: number | null; body: string; isCorrect: boolean };

	export type MediaChoice = { id: number; label: string; kind: 'IMAGE' | 'AUDIO' };

	let {
		action = '',
		submitLabel,
		errors = {},
		values = {},
		initial,
		submitted,
		media = []
	}: {
		action?: string;
		submitLabel: string;
		errors?: Record<string, string>;
		values?: Record<string, string>;
		initial: {
			stem: string;
			explanation: string;
			level: string;
			section: string;
			points: number;
			imageMediaId: number | null;
			audioMediaId: number | null;
			options: OptionRow[];
		};
		/** What the last, rejected submit contained. Takes precedence over `initial`. */
		submitted?: { options: { id: number | null; body: string }[]; correctOption: number };
		media?: MediaChoice[];
	} = $props();

	/**
	 * A rejected submit re-renders with what was typed, not with what was saved.
	 *
	 * Always a string, which is why the media `<option>` values are stringified too:
	 * Svelte matches a `<select>` value against `option.__value` with `is()`, so a
	 * numeric option id would never match and the picker would silently render blank —
	 * submitting nothing and detaching the media on save.
	 */
	const field = (name: string, fallback: string | number | null) => {
		if (values[name] !== undefined) {
			return values[name];
		}
		if (typeof document !== 'undefined') {
			const el = document.getElementById(name) as HTMLInputElement | HTMLSelectElement | null;
			if (el && el.value) {
				return el.value;
			}
		}
		return fallback === null ? '' : String(fallback);
	};

	// Seeded once and then owned by the user's edits. `untrack` says so explicitly: this
	// is a starting value, not a binding that should snap back when the page reloads.
	let rows = $state<OptionRow[]>(
		untrack(() => {
			// A rejected submit re-renders with what was typed, including rows that were
			// added or removed before submitting.
			if (submitted) {
				return submitted.options.map((option, index) => ({
					...option,
					isCorrect: index === submitted.correctOption
				}));
			}

			const initialRows =
				initial.options.length > 0
					? initial.options.map((option) => ({ ...option }))
					: // Four is the JLPT norm, so a new question opens ready to type into.
						Array.from({ length: 4 }, () => ({ id: null, body: '', isCorrect: false }));

			if (typeof document !== 'undefined') {
				const inputs = document.querySelectorAll<HTMLInputElement>('input[name="optionBody"]');
				inputs.forEach((input, index) => {
					if (initialRows[index] && input.value) {
						initialRows[index].body = input.value;
					}
				});
			}

			return initialRows;
		})
	);

	// -1 when nothing is marked. Emphatically NOT defaulted to the first option: that
	// would make every new question silently claim option 1 as its answer key, and the
	// validator's "mark exactly one" branch would be unreachable from the UI.
	let correctIndex = $state(
		untrack(() => {
			if (typeof document !== 'undefined') {
				const checked = document.querySelector<HTMLInputElement>(
					'input[name="correctOption"]:checked'
				);
				if (checked && checked.value !== '') {
					const parsed = Number(checked.value);
					if (Number.isInteger(parsed)) {
						return parsed;
					}
				}
			}
			return rows.findIndex((row) => row.isCorrect);
		})
	);

	// Two-way bound for the same reason the option rows are local state: a one-way
	// `value` is re-asserted on every re-render, hydration included, which silently
	// reverts a choice made before hydration finished.
	let level = $state(untrack(() => field('level', initial.level)));
	let section = $state(untrack(() => field('section', initial.section)));
	let imageMediaId = $state(untrack(() => field('imageMediaId', initial.imageMediaId)));
	let audioMediaId = $state(untrack(() => field('audioMediaId', initial.audioMediaId)));

	const images = $derived(media.filter((asset) => asset.kind === 'IMAGE'));
	const audio = $derived(media.filter((asset) => asset.kind === 'AUDIO'));

	function addRow() {
		rows.push({ id: null, body: '', isCorrect: false });
	}

	function removeRow(index: number) {
		rows.splice(index, 1);

		// The key follows the option it was on; if that option went, nothing is marked.
		if (correctIndex === index) {
			correctIndex = -1;
		} else if (correctIndex > index) {
			correctIndex -= 1;
		}
	}
</script>

<form method="POST" {action}>
	<div class="grid gap-4">
		<section class="border-2 border-ink bg-white p-5">
			<h2>Question</h2>

			<Field id="stem" label="Question text" error={errors.stem} required>
				{#snippet control(props)}
					<textarea {...props} name="stem" required>{field('stem', initial.stem)}</textarea>
				{/snippet}
			</Field>

			<Field
				id="explanation"
				label="Explanation"
				hint="Shown on the result page when a learner reviews a wrong answer."
				error={errors.explanation}
			>
				{#snippet control(props)}
					<textarea {...props} name="explanation"
						>{field('explanation', initial.explanation)}</textarea
					>
				{/snippet}
			</Field>

			<div class="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-x-4">
				<Field id="level" label="Level" error={errors.level} required>
					{#snippet control(props)}
						<select {...props} name="level" bind:value={level}>
							{#each JLPT_LEVELS as level (level)}<option value={level}>{level}</option>{/each}
						</select>
					{/snippet}
				</Field>

				<Field id="section" label="Section" error={errors.section} required>
					{#snippet control(props)}
						<select {...props} name="section" bind:value={section}>
							{#each SECTIONS as section (section)}<option value={section}>{section}</option>{/each}
						</select>
					{/snippet}
				</Field>

				<Field id="points" label="Points" error={errors.points} required>
					{#snippet control(props)}
						<input
							{...props}
							type="number"
							name="points"
							min="1"
							value={field('points', initial.points)}
						/>
					{/snippet}
				</Field>
			</div>
		</section>

		<section class="border-2 border-ink bg-white p-5">
			<h2>Options</h2>
			<p class="mt-[-0.25rem] mb-4 text-xs text-muted">
				Mark exactly one option as the correct answer.
			</p>

			{#if errors.options}
				<p class="mt-1 mb-0 text-xs font-semibold text-danger" role="alert">{errors.options}</p>
			{/if}
			{#if errors.correctOption}
				<p class="mt-1 mb-0 text-xs font-semibold text-danger" role="alert">
					{errors.correctOption}
				</p>
			{/if}

			<fieldset class="m-0 mb-3 border-0 p-0">
				<legend class="visually-hidden">Answer options</legend>

				{#each rows as row, index (index)}
					<div class="mb-2 flex items-start gap-3">
						<input type="hidden" name="optionId" value={row.id ?? ''} />

						<label class="pt-2.5">
							<input
								type="radio"
								name="correctOption"
								value={index}
								checked={correctIndex === index}
								onchange={() => (correctIndex = index)}
							/>
							<span class="visually-hidden">Option {index + 1} is the correct answer</span>
						</label>

						<div class="flex-1">
							<label class="visually-hidden" for="optionBody-{index}">Option {index + 1}</label>
							<input
								id="optionBody-{index}"
								type="text"
								name="optionBody"
								bind:value={rows[index].body}
								aria-invalid={errors[`optionBody.${index}`] ? 'true' : undefined}
								aria-describedby={errors[`optionBody.${index}`]
									? `optionBody-${index}-error`
									: undefined}
							/>
							{#if errors[`optionBody.${index}`]}
								<p
									class="mt-1 mb-0 text-xs font-semibold text-danger"
									id="optionBody-{index}-error"
									role="alert"
								>
									{errors[`optionBody.${index}`]}
								</p>
							{/if}
						</div>

						{#if rows.length > 2}
							<button
								type="button"
								class="min-h-8 cursor-pointer border-2 border-line-strong bg-white px-3 text-xs font-bold tracking-wider text-ink uppercase"
								aria-label="Remove option {index + 1}"
								onclick={() => removeRow(index)}
							>
								Remove
							</button>
						{/if}
					</div>
				{/each}
			</fieldset>

			<Button type="button" variant="ghost" size="sm" onclick={addRow}>Add option</Button>
		</section>

		<section class="border-2 border-ink bg-white p-5">
			<h2>Media</h2>
			<p class="mt-[-0.25rem] mb-4 text-xs text-muted">
				Alt text and transcripts are edited with the file itself, on the Media page, because they
				describe the file rather than this question.
			</p>

			<div class="grid grid-cols-[repeat(auto-fit,minmax(9rem,1fr))] gap-x-4">
				<Field id="imageMediaId" label="Image" error={errors.imageMediaId}>
					{#snippet control(props)}
						<select {...props} name="imageMediaId" bind:value={imageMediaId}>
							<option value="">None</option>
							{#each images as asset (asset.id)}<option value={String(asset.id)}
									>{asset.label}</option
								>{/each}
						</select>
					{/snippet}
				</Field>

				<Field id="audioMediaId" label="Audio" error={errors.audioMediaId}>
					{#snippet control(props)}
						<select {...props} name="audioMediaId" bind:value={audioMediaId}>
							<option value="">None</option>
							{#each audio as asset (asset.id)}<option value={String(asset.id)}
									>{asset.label}</option
								>{/each}
						</select>
					{/snippet}
				</Field>
			</div>
		</section>
	</div>

	<div class="mt-5">
		<Button type="submit" size="md">{submitLabel}</Button>
	</div>
</form>
