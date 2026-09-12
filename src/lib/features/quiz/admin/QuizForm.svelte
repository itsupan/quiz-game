<script lang="ts">
	import { untrack } from 'svelte';

	import Button from '$lib/components/Button.svelte';
	import Field from '$lib/components/Field.svelte';
	import { JLPT_LEVELS, QUIZ_ICONS, QUIZ_MODES, SELECTION_MODES } from '$lib/domain/enums';

	/** Human-readable labels for the `QUIZ_ICONS` presets, in the same order. */
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

	/**
	 * Quiz details, shared by the create and edit pages.
	 *
	 * Time limits are entered in minutes and stored in seconds. The schema is in seconds
	 * because the server computes `expires_at` from it; nobody configures a 6900-second
	 * exam.
	 */
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

	/**
	 * The selects are two-way bound rather than given a one-way `value`.
	 *
	 * A one-way `value={...}` is re-asserted whenever the component re-renders — including
	 * during hydration — so a choice made in the moment between the server HTML arriving
	 * and hydration finishing is silently reverted. Seeded once from the props, then owned
	 * by the person filling the form in.
	 */
	let mode = $state(untrack(() => field('mode', initial.mode)));
	let level = $state(untrack(() => field('level', initial.level)));
	let selectionMode = $state(untrack(() => field('selectionMode', initial.selectionMode)));
	let icon = $state(untrack(() => field('icon', initial.icon)));
</script>

<form method="POST" {action}>
	<section class="mb-5 border-2 border-ink bg-white p-5">
		<Field id="title" label="Title" error={errors.title} required>
			{#snippet control(props)}
				<input {...props} type="text" name="title" value={field('title', initial.title)} required />
			{/snippet}
		</Field>

		<Field id="description" label="Description" error={errors.description}>
			{#snippet control(props)}
				<textarea {...props} name="description"
					>{field('description', initial.description)}</textarea
				>
			{/snippet}
		</Field>

		<div class="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-x-4">
			<Field id="mode" label="Mode" error={errors.mode} required>
				{#snippet control(props)}
					<select {...props} name="mode" bind:value={mode}>
						{#each QUIZ_MODES as mode (mode)}<option value={mode}>{mode}</option>{/each}
					</select>
				{/snippet}
			</Field>

			<Field id="level" label="JLPT level" error={errors.level} required>
				{#snippet control(props)}
					<select {...props} name="level" bind:value={level}>
						{#each JLPT_LEVELS as level (level)}<option value={level}>{level}</option>{/each}
					</select>
				{/snippet}
			</Field>

			<Field
				id="selectionMode"
				label="Questions"
				hint="FIXED serves a set list; RANDOM draws from the bank."
				error={errors.selectionMode}
				required
			>
				{#snippet control(props)}
					<select {...props} name="selectionMode" bind:value={selectionMode}>
						{#each SELECTION_MODES as option (option)}<option value={option}>{option}</option
							>{/each}
					</select>
				{/snippet}
			</Field>

			<Field
				id="timeLimitMinutes"
				label="Time limit (minutes)"
				hint="Required for a mock test or full exam. Blank means untimed."
				error={errors.timeLimitMinutes}
			>
				{#snippet control(props)}
					<input
						{...props}
						type="number"
						name="timeLimitMinutes"
						min="1"
						value={field('timeLimitMinutes', initialMinutes)}
					/>
				{/snippet}
			</Field>

			<Field
				id="icon"
				label="Card icon"
				hint="Shown on the dashboard quiz card."
				error={errors.icon}
				required
			>
				{#snippet control(props)}
					<select {...props} name="icon" bind:value={icon}>
						{#each QUIZ_ICONS as option (option)}
							<option value={option}>{ICON_LABELS[option]}</option>
						{/each}
					</select>
				{/snippet}
			</Field>
		</div>
	</section>

	<Button type="submit" size="md">{submitLabel}</Button>
</form>
