<script lang="ts">
	import type { Snippet } from 'svelte';

	/**
	 * A labelled form control with its validation message.
	 *
	 * The accessibility wiring lives here rather than at each call site: the control
	 * receives `aria-invalid` and an `aria-describedby` pointing at the error text, so a
	 * screen-reader user hears *why* a field was rejected instead of only that it was.
	 * Getting that wrong at twenty call sites is inevitable; getting it right once is not.
	 */
	type ControlProps = {
		id: string;
		'aria-invalid': 'true' | undefined;
		'aria-describedby': string | undefined;
	};

	let {
		id,
		label,
		error,
		hint,
		required = false,
		control
	}: {
		id: string;
		label: string;
		error?: string;
		hint?: string;
		required?: boolean;
		control: Snippet<[ControlProps]>;
	} = $props();

	const errorId = $derived(`${id}-error`);
	const hintId = $derived(`${id}-hint`);

	const describedBy = $derived(
		[error ? errorId : null, hint ? hintId : null].filter(Boolean).join(' ') || undefined
	);
</script>

<div class="mb-4 flex flex-col gap-1">
	<label for={id} class="text-xs font-bold tracking-widest uppercase">
		{label}
		{#if required}<span class="text-brand-red" aria-hidden="true">*</span>{/if}
	</label>

	{#if hint}
		<p class="m-0 text-xs text-muted" id={hintId}>{hint}</p>
	{/if}

	{@render control({
		id,
		'aria-invalid': error ? 'true' : undefined,
		'aria-describedby': describedBy
	})}

	{#if error}
		<!-- Announced when validation swaps it in after a failed submit. -->
		<p class="m-0 text-xs font-semibold text-danger" id={errorId} role="alert">{error}</p>
	{/if}
</div>
