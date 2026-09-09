<script lang="ts">
	import { untrack } from 'svelte';

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
	const field = (name: string, fallback: string | number | null) =>
		values[name] ?? (fallback === null ? '' : String(fallback));

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

			return initial.options.length > 0
				? initial.options.map((option) => ({ ...option }))
				: // Four is the JLPT norm, so a new question opens ready to type into.
					Array.from({ length: 4 }, () => ({ id: null, body: '', isCorrect: false }));
		})
	);

	// -1 when nothing is marked. Emphatically NOT defaulted to the first option: that
	// would make every new question silently claim option 1 as its answer key, and the
	// validator's "mark exactly one" branch would be unreachable from the UI.
	let correctIndex = $state(rows.findIndex((row) => row.isCorrect));

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
	<div class="grid">
		<section>
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

			<div class="row">
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

		<section>
			<h2>Options</h2>
			<p class="hint">Mark exactly one option as the correct answer.</p>

			{#if errors.options}
				<p class="error" role="alert">{errors.options}</p>
			{/if}
			{#if errors.correctOption}
				<p class="error" role="alert">{errors.correctOption}</p>
			{/if}

			<fieldset>
				<legend class="visually-hidden">Answer options</legend>

				{#each rows as row, index (index)}
					<div class="option">
						<input type="hidden" name="optionId" value={row.id ?? ''} />

						<label class="key">
							<input
								type="radio"
								name="correctOption"
								value={index}
								checked={correctIndex === index}
								onchange={() => (correctIndex = index)}
							/>
							<span class="visually-hidden">Option {index + 1} is the correct answer</span>
						</label>

						<div class="body">
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
								<p class="error" id="optionBody-{index}-error" role="alert">
									{errors[`optionBody.${index}`]}
								</p>
							{/if}
						</div>

						{#if rows.length > 2}
							<button
								type="button"
								class="remove"
								aria-label="Remove option {index + 1}"
								onclick={() => removeRow(index)}
							>
								Remove
							</button>
						{/if}
					</div>
				{/each}
			</fieldset>

			<button type="button" class="quiet" onclick={addRow}>Add option</button>
		</section>

		<section>
			<h2>Media</h2>
			<p class="hint">
				Alt text and transcripts are edited with the file itself, on the Media page, because they
				describe the file rather than this question.
			</p>

			<div class="row">
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

	<div class="submit">
		<button type="submit" class="primary">{submitLabel}</button>
	</div>
</form>

<style>
	.grid {
		display: grid;
		gap: 1rem;
	}

	section {
		padding: 1.25rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}

	h2 {
		margin-top: 0;
	}

	.hint {
		margin: -0.25rem 0 1rem;
		font-size: 0.8125rem;
		color: var(--ink-muted);
	}

	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(9rem, 1fr));
		gap: 0 1rem;
	}

	fieldset {
		border: 0;
		margin: 0 0 0.75rem;
		padding: 0;
	}

	.option {
		display: flex;
		align-items: flex-start;
		gap: 0.75rem;
		margin-bottom: 0.5rem;
	}

	.key {
		padding-top: 0.625rem;
	}

	.body {
		flex: 1;
	}

	.error {
		margin: 0.25rem 0 0;
		font-size: 0.8125rem;
		color: var(--danger);
	}

	.remove,
	.quiet {
		padding: 0.4375rem 0.75rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: 0.875rem;
	}

	.submit {
		margin-top: 1.25rem;
	}

	.primary {
		padding: 0.5625rem 1rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 0.9375rem;
		font-weight: 600;
	}
</style>
