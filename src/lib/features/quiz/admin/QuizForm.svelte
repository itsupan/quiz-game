<script lang="ts">
	import { untrack } from 'svelte';
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

<form
	id="quiz-form"
	method="POST"
	{action}
	class="flex max-w-4xl flex-col gap-6 border border-ink bg-stone-50 p-6"
>
	<!-- Title -->
	<div>
		<label class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase" for="title"
			>Quiz Title</label
		>
		<input
			id="title"
			type="text"
			name="title"
			required
			value={field('title', initial.title)}
			class="w-full border border-ink bg-white px-4 py-3 text-sm transition-colors outline-none focus:border-brand-red"
			placeholder="Enter a descriptive title..."
		/>
		{#if errors.title}
			<p class="mt-1 text-xs text-brand-red">{errors.title}</p>
		{/if}
	</div>

	<!-- Description -->
	<div>
		<label
			class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
			for="description">Description</label
		>
		<textarea
			id="description"
			name="description"
			class="min-h-[100px] w-full resize-y border border-ink bg-white px-4 py-3 text-sm transition-colors outline-none focus:border-brand-red"
			placeholder="Optional summary or instructions for the learner..."
			>{field('description', initial.description)}</textarea
		>
		{#if errors.description}
			<p class="mt-1 text-xs text-brand-red">{errors.description}</p>
		{/if}
	</div>

	<!-- Quick Settings Row -->
	<div class="grid gap-6 md:grid-cols-2">
		<!-- JLPT LEVEL -->
		<div>
			<label class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
				>JLPT LEVEL</label
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

		<!-- Mode -->
		<div>
			<label class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase" for="mode"
				>Quiz Mode</label
			>
			<div class="relative flex items-center border border-ink bg-white">
				<select
					id="mode"
					name="mode"
					bind:value={mode}
					class="w-full appearance-none border-none bg-transparent px-3 py-2 text-sm outline-none"
				>
					{#each QUIZ_MODES as m (m)}
						<option value={m}>{m}</option>
					{/each}
				</select>
				<i
					class="fi fi-rs-angle-down pointer-events-none absolute right-3 text-muted"
					aria-hidden="true"
				></i>
			</div>
			{#if errors.mode}
				<p class="mt-1 text-xs text-brand-red">{errors.mode}</p>
			{/if}
		</div>
	</div>

	<!-- Configuration Row -->
	<div class="grid gap-6 md:grid-cols-3">
		<div>
			<label
				class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
				for="selectionMode">Questions</label
			>
			<div class="relative flex items-center border border-ink bg-white">
				<select
					id="selectionMode"
					name="selectionMode"
					bind:value={selectionMode}
					class="w-full appearance-none border-none bg-transparent px-3 py-2 text-sm outline-none"
				>
					{#each SELECTION_MODES as option (option)}
						<option value={option}>{option}</option>
					{/each}
				</select>
				<i
					class="fi fi-rs-angle-down pointer-events-none absolute right-3 text-muted"
					aria-hidden="true"
				></i>
			</div>
			<p class="mt-1 text-[10px] text-muted">FIXED lists vs. RANDOM draw.</p>
			{#if errors.selectionMode}
				<p class="mt-1 text-xs text-brand-red">{errors.selectionMode}</p>
			{/if}
		</div>

		<div>
			<label
				class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
				for="timeLimitMinutes">Time Limit (Min)</label
			>
			<input
				id="timeLimitMinutes"
				type="number"
				name="timeLimitMinutes"
				min="1"
				value={field('timeLimitMinutes', initialMinutes)}
				class="w-full border border-ink bg-white px-3 py-2 text-sm transition-colors outline-none focus:border-brand-red"
				placeholder="Untimed..."
			/>
			<p class="mt-1 text-[10px] text-muted">Blank means untimed.</p>
			{#if errors.timeLimitMinutes}
				<p class="mt-1 text-xs text-brand-red">{errors.timeLimitMinutes}</p>
			{/if}
		</div>

		<div>
			<label class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase" for="icon"
				>Card Icon</label
			>
			<div class="relative flex items-center border border-ink bg-white">
				<select
					id="icon"
					name="icon"
					bind:value={icon}
					class="w-full appearance-none border-none bg-transparent px-3 py-2 text-sm outline-none"
				>
					{#each QUIZ_ICONS as option (option)}
						<option value={option}>{ICON_LABELS[option]}</option>
					{/each}
				</select>
				<i
					class="fi fi-rs-angle-down pointer-events-none absolute right-3 text-muted"
					aria-hidden="true"
				></i>
			</div>
			<p class="mt-1 text-[10px] text-muted">Shown on the dashboard card.</p>
			{#if errors.icon}
				<p class="mt-1 text-xs text-brand-red">{errors.icon}</p>
			{/if}
		</div>
	</div>

	<div class="flex justify-end pt-4">
		<button
			type="submit"
			class="border border-brand-red bg-brand-red px-8 py-3 text-[10px] font-bold tracking-widest text-white uppercase transition-colors hover:bg-brand-red-dark"
		>
			{submitLabel}
		</button>
	</div>
</form>
