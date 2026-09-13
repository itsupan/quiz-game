<script lang="ts">
	import { untrack } from 'svelte';
	import { JLPT_LEVELS, SECTIONS } from '$lib/domain/enums';

	type OptionRow = { id: number | null; body: string; isCorrect: boolean };

	type Props = {
		action?: string;
		errors?: Record<string, string>;
		values?: Record<string, string>;
		submitted?: { options: { id: number | null; body: string }[]; correctOption: number };
		media?: { id: number; kind: 'IMAGE' | 'AUDIO'; label: string }[];
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
	};

	let { action, errors = {}, values = {}, submitted, media = [], initial }: Props = $props();

	function field(name: keyof Props['initial'], fallback: string | number | null = '') {
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

	let level = $state(untrack(() => field('level', initial.level)));
	let section = $state(untrack(() => field('section', initial.section)));
	let imageMediaId = $state(
		untrack(() => {
			const val = field('imageMediaId', initial.imageMediaId);
			return val === null ? '' : String(val);
		})
	);
	let audioMediaId = $state(
		untrack(() => {
			const val = field('audioMediaId', initial.audioMediaId);
			return val === null ? '' : String(val);
		})
	);

	const images = $derived(media.filter((asset) => asset.kind === 'IMAGE'));
	const audio = $derived(media.filter((asset) => asset.kind === 'AUDIO'));

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

<form id="edit-question-form" method="POST" {action} class="flex max-w-4xl flex-col gap-8">
	<!-- Top Controls Row -->
	<div class="grid grid-cols-2 gap-6">
		<div>
			<label
				class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
				for="section">QUESTION TYPE</label
			>
			<div class="relative flex items-center border border-ink bg-white">
				<select
					id="section"
					name="section"
					bind:value={section}
					class="w-full appearance-none border-none bg-transparent px-3 py-2 text-sm outline-none"
				>
					{#each SECTIONS as s (s)}
						<option value={s}>{s}</option>
					{/each}
				</select>
				<i
					class="fi fi-rs-angle-down pointer-events-none absolute right-3 text-muted"
					aria-hidden="true"
				></i>
			</div>
			{#if errors.section}
				<p class="mt-1 text-xs text-brand-red">{errors.section}</p>
			{/if}
		</div>

		<div>
			<label class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
				>JLPT LEVEL</label
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
							class="border border-ink bg-white px-3 py-1.5 text-[10px] font-bold tracking-widest text-ink uppercase transition-colors peer-checked:border-brand-red peer-checked:bg-brand-red peer-checked:text-white hover:bg-stone-50"
						>
							{l}
						</div>
					</label>
				{/each}
			</div>
			{#if errors.level}
				<p class="mt-1 text-xs text-brand-red">{errors.level}</p>
			{/if}
		</div>
	</div>

	<!-- Main Text Area (Stimulus / Question Text) -->
	<div>
		<div class="border-l-4 border-brand-red bg-stone-50 p-6">
			<label
				class="mb-4 block text-[10px] font-bold tracking-widest text-ink uppercase"
				for="explanation">PASSAGE / EXPLANATION</label
			>
			<textarea
				id="explanation"
				name="explanation"
				class="min-h-[120px] w-full resize-y border border-ink bg-white p-3 text-sm outline-none"
				placeholder="Add explanation or passage here..."
				>{field('explanation', initial.explanation)}</textarea
			>
			{#if errors.explanation}
				<p class="mt-1 text-xs text-brand-red">{errors.explanation}</p>
			{/if}

			<!-- Hidden Points for compatibility -->
			<input type="hidden" name="points" value={field('points', initial.points)} />

			<div class="mt-4 flex gap-3">
				<div class="relative">
					<select
						name="imageMediaId"
						aria-label="Image"
						bind:value={imageMediaId}
						class="absolute inset-0 w-full cursor-pointer opacity-0"
					>
						<option value="">None</option>
						{#each images as asset (asset.id)}<option value={String(asset.id)}>{asset.label}</option
							>{/each}
					</select>
					<button
						type="button"
						class="flex items-center gap-2 border border-ink bg-white px-3 py-1.5 text-[10px] font-bold tracking-widest text-ink uppercase transition-colors hover:bg-stone-100 {imageMediaId
							? 'border-brand-red text-brand-red'
							: ''}"
					>
						<i class="fi fi-rs-picture" aria-hidden="true"></i>
						{imageMediaId ? 'Change Image' : 'Add Image'}
					</button>
				</div>
				<div class="relative">
					<select
						name="audioMediaId"
						aria-label="Audio"
						bind:value={audioMediaId}
						class="absolute inset-0 w-full cursor-pointer opacity-0"
					>
						<option value="">None</option>
						{#each audio as asset (asset.id)}<option value={String(asset.id)}>{asset.label}</option
							>{/each}
					</select>
					<button
						type="button"
						class="flex items-center gap-2 border border-ink bg-white px-3 py-1.5 text-[10px] font-bold tracking-widest text-ink uppercase transition-colors hover:bg-stone-100 {audioMediaId
							? 'border-brand-red text-brand-red'
							: ''}"
					>
						<i class="fi fi-rs-music-alt" aria-hidden="true"></i>
						{audioMediaId ? 'Change Audio' : 'Link Audio'}
					</button>
				</div>
			</div>
			<div class="mt-2 text-[10px] text-muted">Select media files from your uploaded assets.</div>
		</div>
	</div>

	<!-- Question Text Input -->
	<div>
		<label class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase" for="stem"
			>QUESTION TEXT</label
		>
		<input
			id="stem"
			type="text"
			name="stem"
			required
			value={field('stem', initial.stem)}
			class="w-full border-2 border-ink bg-white px-4 py-3 text-sm transition-colors outline-none focus:border-brand-red"
			aria-invalid={errors.stem ? 'true' : undefined}
			aria-describedby={errors.stem ? 'stem-error' : undefined}
		/>
		{#if errors.stem}
			<p class="mt-1 text-xs text-brand-red" id="stem-error" role="alert">{errors.stem}</p>
		{/if}
	</div>

	<!-- Options -->
	<div>
		<label class="mb-4 block text-[10px] font-bold tracking-widest text-ink uppercase"
			>OPTIONS (SELECT CORRECT)</label
		>

		{#if errors.options}
			<p class="mt-1 mb-4 text-xs font-semibold text-brand-red">{errors.options}</p>
		{/if}
		{#if errors.correctOption}
			<p class="mt-1 mb-4 text-xs font-semibold text-brand-red">{errors.correctOption}</p>
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
							class="w-full border border-ink bg-white px-3 py-2 text-sm transition-colors outline-none focus:border-brand-red {correctIndex ===
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
						<p class="absolute mt-10 text-xs font-semibold text-brand-red">
							{errors[`optionBody.${index}`]}
						</p>
					{/if}
				</div>
			{/each}
		</fieldset>

		<button
			type="button"
			class="mt-6 flex items-center gap-2 text-xs font-bold tracking-widest text-brand-red uppercase transition-colors hover:text-brand-red-dark"
			onclick={addRow}
		>
			<i class="fi fi-rs-plus" aria-hidden="true"></i> ADD OPTION
		</button>
	</div>
</form>
