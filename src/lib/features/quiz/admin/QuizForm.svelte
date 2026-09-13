<script lang="ts">
	import { untrack } from 'svelte';
	import Button from '$lib/components/Button.svelte';
	import Field from '$lib/components/Field.svelte';
	import { JLPT_LEVELS, QUIZ_ICONS, QUIZ_MODES, SELECTION_MODES } from '$lib/domain/enums';

	const ICON_LABELS: Record<(typeof QUIZ_ICONS)[number], string> = {
		book: 'Book',
		flask: 'Flask',
		calculator: 'Calculator',
		headphones: 'Headphones',
		microphone: 'Microphone',
		brain: 'Brain',
		pencil: 'Pencil',
		'graduation-cap': 'Graduation cap',
		trophy: 'Trophy'
	};

	let {
		action = '',
		submitLabel,
		errors = {},
		values = {},
		initial
	}: {
		action?: string;
		submitLabel: string;
		errors?: Record<string, string>;
		values?: Record<string, string>;
		initial: {
			title: string;
			description: string;
			mode: string;
			level: string;
			selectionMode: string;
			icon: string;
			timeLimitSeconds: number | null;
		};
	} = $props();

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

	const initialMinutes = $derived(
		initial.timeLimitSeconds === null ? null : Math.round(initial.timeLimitSeconds / 60)
	);

	let mode = $state(untrack(() => field('mode', initial.mode)));
	let level = $state(untrack(() => field('level', initial.level)));
	let selectionMode = $state(untrack(() => field('selectionMode', initial.selectionMode)));
	let icon = $state(untrack(() => field('icon', initial.icon)));
</script>

<form id="quiz-form" method="POST" {action} class="flex max-w-4xl flex-col gap-6">
	<Field id="title" label="Quiz title" required error={errors.title}>
		{#snippet control(props)}
			<input
				{...props}
				type="text"
				name="title"
				required
				value={field('title', initial.title)}
				class="w-full border-2 border-ink bg-white px-4 py-3 text-sm transition-colors outline-none focus:border-brand-red"
				placeholder="Enter a descriptive title..."
			/>
		{/snippet}
	</Field>

	<Field id="description" label="Description" error={errors.description}>
		{#snippet control(props)}
			<textarea
				{...props}
				name="description"
				class="min-h-[100px] w-full resize-y border-2 border-ink bg-white px-4 py-3 text-sm transition-colors outline-none focus:border-brand-red"
				placeholder="Optional summary or instructions for the learner..."
				>{field('description', initial.description)}</textarea
			>
		{/snippet}
	</Field>

	<!-- Quick Settings Row -->
	<div class="grid gap-6 md:grid-cols-2">
		<div>
			<span class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
				>JLPT level</span
			>
			<div class="flex flex-wrap gap-2">
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

		<Field id="mode" label="Quiz mode" error={errors.mode}>
			{#snippet control(props)}
				<select
					{...props}
					name="mode"
					bind:value={mode}
					class="w-full appearance-none border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
				>
					{#each QUIZ_MODES as m (m)}
						<option value={m}>{m}</option>
					{/each}
				</select>
			{/snippet}
		</Field>
	</div>

	<!-- Configuration Row -->
	<div class="grid gap-6 md:grid-cols-3">
		<Field
			id="selectionMode"
			label="Questions"
			hint="FIXED lists vs. RANDOM draw."
			error={errors.selectionMode}
		>
			{#snippet control(props)}
				<select
					{...props}
					name="selectionMode"
					bind:value={selectionMode}
					class="w-full appearance-none border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
				>
					{#each SELECTION_MODES as option (option)}
						<option value={option}>{option}</option>
					{/each}
				</select>
			{/snippet}
		</Field>

		<Field
			id="timeLimitMinutes"
			label="Time limit (min)"
			hint="Blank means untimed."
			error={errors.timeLimitMinutes}
		>
			{#snippet control(props)}
				<input
					{...props}
					type="number"
					name="timeLimitMinutes"
					min="1"
					value={field('timeLimitMinutes', initialMinutes)}
					class="w-full border-2 border-ink bg-white px-3 py-2 text-sm transition-colors outline-none focus:border-brand-red"
					placeholder="Untimed..."
				/>
			{/snippet}
		</Field>

		<Field id="icon" label="Card icon" hint="Shown on the dashboard card." error={errors.icon}>
			{#snippet control(props)}
				<select
					{...props}
					name="icon"
					bind:value={icon}
					class="w-full appearance-none border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
				>
					{#each QUIZ_ICONS as option (option)}
						<option value={option}>{ICON_LABELS[option]}</option>
					{/each}
				</select>
			{/snippet}
		</Field>
	</div>

	<div class="flex justify-end pt-4">
		<Button type="submit" variant="primary" size="md">{submitLabel}</Button>
	</div>
</form>
