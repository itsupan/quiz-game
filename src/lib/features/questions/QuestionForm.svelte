<script lang="ts">
	import { untrack } from 'svelte';
	import { enhance } from '$app/forms';
	import Button from '$lib/components/Button.svelte';
	import Field from '$lib/components/Field.svelte';
	import { JLPT_LEVELS, SECTIONS } from '$lib/domain/enums';

	type OptionRow = { id: number | null; body: string; isCorrect: boolean };
	type CurrentMedia = { url: string; description: string | null };

	type Props = {
		action?: string;
		errors?: Record<string, string>;
		values?: Record<string, string>;
		submitted?: { options: { id: number | null; body: string }[]; correctOption: number };
		/** The image/audio already attached, when editing — there is no "pick an existing
		 * file" list; a new upload replaces it, and a checkbox detaches it. */
		currentImage?: CurrentMedia | null;
		currentAudio?: CurrentMedia | null;
		/**
		 * Pins level/section when this form is embedded inside a quiz section (see
		 * `QuizQuestionsEditor.svelte`) instead of the standalone question bank pages —
		 * a question authored there is for that section, not a pick from every section.
		 */
		lockedLevel?: string;
		lockedSection?: string;
		initial: {
			stem: string;
			explanation: string;
			level: string;
			section: string;
			points: number;
			options: OptionRow[];
		};
	};

	let {
		action,
		errors = {},
		values = {},
		submitted,
		currentImage = null,
		currentAudio = null,
		lockedLevel,
		lockedSection,
		initial
	}: Props = $props();

	function field(
		name: keyof Props['initial'] | 'imageAltText' | 'audioTranscript',
		fallback: string | number | null = ''
	) {
		return (values[name] ?? fallback) as string;
	}

	let rows = $state<OptionRow[]>(
		untrack(() => {
			if (submitted) {
				return submitted.options.map((option, index) => ({
					...option,
					isCorrect: index === submitted.correctOption
				}));
			}

			const initialRows =
				initial.options.length > 0
					? initial.options.map((option) => ({
							...option
						}))
					: Array.from({ length: 4 }, () => ({ id: null, body: '', isCorrect: false }));

			return initialRows;
		})
	);

	let correctIndex = $state(
		untrack(() => {
			return rows.findIndex((row) => row.isCorrect);
		})
	);

	let level = $state(untrack(() => field('level', lockedLevel ?? initial.level)));
	let section = $state(untrack(() => field('section', lockedSection ?? initial.section)));
	let points = $state(untrack(() => field('points', initial.points)));

	function addRow() {
		rows.push({ id: null, body: '', isCorrect: false });
	}

	function removeRow(index: number) {
		rows.splice(index, 1);
		if (correctIndex === index) {
			correctIndex = -1;
		} else if (correctIndex > index) {
			correctIndex -= 1;
		}
	}

	const optionLabels = ['A.', 'B.', 'C.', 'D.', 'E.', 'F.'];
</script>

<form
	id="edit-question-form"
	method="POST"
	{action}
	enctype="multipart/form-data"
	use:enhance
	class="flex max-w-4xl flex-col gap-8"
>
	<!-- Level / Section -->
	{#if lockedLevel && lockedSection}
		<div class="flex items-center gap-2 border-2 border-line-strong bg-stone-50 px-4 py-3">
			<i class="fi fi-rs-lock text-muted" aria-hidden="true"></i>
			<p class="m-0 text-xs font-bold tracking-widest text-ink uppercase">
				{lockedLevel} · {lockedSection.replace('_', ' ')}
			</p>
			<span class="text-xs text-muted normal-case">— set by this quiz section</span>
			<input type="hidden" name="level" value={lockedLevel} />
			<input type="hidden" name="section" value={lockedSection} />
		</div>
	{:else}
		<div class="grid grid-cols-2 gap-6">
			<Field id="section" label="Section" error={errors.section}>
				{#snippet control(props)}
					<select
						{...props}
						name="section"
						bind:value={section}
						class="w-full appearance-none border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
					>
						{#each SECTIONS as s (s)}
							<option value={s}>{s}</option>
						{/each}
					</select>
				{/snippet}
			</Field>

			<div>
				<span class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
					>JLPT Level</span
				>
				<div class="flex gap-2">
					{#each JLPT_LEVELS as l (l)}
						<label class="cursor-pointer">
							<input
								type="radio"
								name="level"
								value={l}
								bind:group={level}
								class="peer visually-hidden"
							/>
							<div
								class="border-2 border-ink bg-white px-3 py-1.5 text-[10px] font-bold tracking-widest text-ink uppercase transition-colors peer-checked:border-brand-red peer-checked:bg-brand-red peer-checked:text-white hover:bg-stone-50"
							>
								{l}
							</div>
						</label>
					{/each}
				</div>
				{#if errors.level}
					<p class="mt-1 text-xs font-semibold text-danger">{errors.level}</p>
				{/if}
			</div>
		</div>
	{/if}

	<!-- Question Text -->
	<Field id="stem" label="Question text" required error={errors.stem}>
		{#snippet control(props)}
			<input
				{...props}
				type="text"
				name="stem"
				required
				value={field('stem', initial.stem)}
				class="w-full border-2 border-ink bg-white px-4 py-3 text-sm transition-colors outline-none focus:border-brand-red"
				placeholder="Enter the question text..."
			/>
		{/snippet}
	</Field>

	<!-- Passage / explanation -->
	<div class="border-l-4 border-brand-red bg-stone-50 p-6">
		<label
			class="mb-4 block text-[10px] font-bold tracking-widest text-ink uppercase"
			for="explanation">Explanation (shown on review)</label
		>
		<textarea
			id="explanation"
			name="explanation"
			class="min-h-[120px] w-full resize-y border-2 border-ink bg-white p-3 text-sm outline-none focus:border-brand-red"
			placeholder="Shown to the learner after they answer, win or lose..."
			>{field('explanation', initial.explanation)}</textarea
		>
		{#if errors.explanation}
			<p class="mt-1 text-xs font-semibold text-danger">{errors.explanation}</p>
		{/if}
	</div>

	<!-- Points -->
	<div class="grid gap-6 md:grid-cols-3">
		<Field id="points" label="Points" error={errors.points}>
			{#snippet control(props)}
				<input
					{...props}
					type="number"
					name="points"
					min="1"
					value={points}
					class="w-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
				/>
			{/snippet}
		</Field>
	</div>

	<!-- Media: uploaded directly, not picked from an existing list -->
	<div class="grid gap-6 md:grid-cols-2">
		<div class="border-2 border-line-strong p-4">
			<p class="mb-3 text-[10px] font-bold tracking-widest text-ink uppercase">Image</p>

			{#if currentImage}
				<div class="mb-3 flex items-center gap-3">
					<img
						src={currentImage.url}
						alt=""
						class="h-16 w-16 shrink-0 border border-line-strong object-cover"
					/>
					<label class="flex items-center gap-2 text-xs text-muted">
						<input type="checkbox" name="removeImage" />
						Remove this image
					</label>
				</div>
			{/if}

			<Field
				id="imageFile"
				label={currentImage ? 'Replace image' : 'Upload image'}
				error={errors.imageFile}
			>
				{#snippet control(props)}
					<input
						{...props}
						type="file"
						name="imageFile"
						accept="image/png,image/jpeg,image/webp"
						class="w-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
					/>
				{/snippet}
			</Field>

			<Field id="imageAltText" label="Alt text" hint="Required before this question can publish.">
				{#snippet control(props)}
					<input
						{...props}
						type="text"
						name="imageAltText"
						value={field('imageAltText', currentImage?.description ?? '')}
						class="w-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
						placeholder="Describes the image for a screen reader"
					/>
				{/snippet}
			</Field>
		</div>

		<div class="border-2 border-line-strong p-4">
			<p class="mb-3 text-[10px] font-bold tracking-widest text-ink uppercase">Audio</p>

			{#if currentAudio}
				<div class="mb-3 flex items-center gap-3">
					<audio controls src={currentAudio.url} class="h-10 flex-1"></audio>
					<label class="flex items-center gap-2 text-xs text-muted">
						<input type="checkbox" name="removeAudio" />
						Remove this audio
					</label>
				</div>
			{/if}

			<Field
				id="audioFile"
				label={currentAudio ? 'Replace audio' : 'Upload audio'}
				error={errors.audioFile}
			>
				{#snippet control(props)}
					<input
						{...props}
						type="file"
						name="audioFile"
						accept="audio/mpeg,audio/mp4,audio/ogg"
						class="w-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
					/>
				{/snippet}
			</Field>

			<Field
				id="audioTranscript"
				label="Transcript"
				hint="Required before this question can publish."
			>
				{#snippet control(props)}
					<textarea
						{...props}
						name="audioTranscript"
						class="min-h-16 w-full resize-y border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
						placeholder="What is said in the clip"
						>{field('audioTranscript', currentAudio?.description ?? '')}</textarea
					>
				{/snippet}
			</Field>
		</div>
	</div>

	<!-- Options -->
	<div>
		<span class="mb-4 block text-[10px] font-bold tracking-widest text-ink uppercase"
			>Options (select correct)</span
		>

		{#if errors.options}
			<p class="mt-1 mb-4 text-xs font-semibold text-danger">{errors.options}</p>
		{/if}
		{#if errors.correctOption}
			<p class="mt-1 mb-4 text-xs font-semibold text-danger">{errors.correctOption}</p>
		{/if}

		<fieldset class="m-0 space-y-3 border-0 p-0">
			<legend class="visually-hidden">Answer options</legend>
			{#each rows as row, index (index)}
				<div class="flex items-center gap-4">
					<input type="hidden" name="optionId" value={row.id ?? ''} />
					<label class="flex shrink-0 cursor-pointer items-center justify-center">
						<input
							type="radio"
							name="correctOption"
							value={index}
							checked={correctIndex === index}
							onchange={() => (correctIndex = index)}
							class="peer visually-hidden"
							aria-label="Mark option {index + 1} as correct"
						/>
						<div
							class="flex h-5 w-5 items-center justify-center border-2 border-ink bg-white transition-colors peer-checked:border-brand-red peer-checked:bg-brand-red"
						></div>
					</label>

					<span class="w-6 shrink-0 text-sm font-bold text-ink">{optionLabels[index] ?? '-'}</span>

					<div class="flex flex-1 gap-2">
						<input
							type="text"
							name="optionBody"
							aria-label="Option {index + 1}"
							bind:value={rows[index].body}
							placeholder="Add option {optionLabels[index] ?? '...'}"
							class="w-full border-2 border-ink bg-white px-3 py-2 text-sm transition-colors outline-none focus:border-brand-red {correctIndex ===
							index
								? 'border-brand-red bg-red-50/20 text-brand-red'
								: ''}"
							aria-invalid={errors[`optionBody.${index}`] ? 'true' : undefined}
						/>
						{#if rows.length > 2}
							<button
								type="button"
								class="shrink-0 px-2 text-muted hover:text-brand-red"
								aria-label="Remove option {index + 1}"
								onclick={() => removeRow(index)}
							>
								<i class="fi fi-rs-trash" aria-hidden="true"></i>
							</button>
						{/if}
					</div>
					{#if errors[`optionBody.${index}`]}
						<p class="absolute mt-10 text-xs font-semibold text-danger">
							{errors[`optionBody.${index}`]}
						</p>
					{/if}
				</div>
			{/each}
		</fieldset>

		<Button type="button" variant="ghost" size="sm" class="mt-6" onclick={addRow}>
			<i class="fi fi-rs-plus" aria-hidden="true"></i> ADD OPTION
		</Button>
	</div>
</form>
