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

<div class="field">
	<label for={id}>
		{label}
		{#if required}<span class="required" aria-hidden="true">*</span>{/if}
	</label>

	{#if hint}
		<p class="hint" id={hintId}>{hint}</p>
	{/if}

	{@render control({
		id,
		'aria-invalid': error ? 'true' : undefined,
		'aria-describedby': describedBy
	})}

	{#if error}
		<!-- Announced when validation swaps it in after a failed submit. -->
		<p class="error" id={errorId} role="alert">{error}</p>
	{/if}
</div>

<style>
	.field {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		margin-bottom: 1rem;
	}

	label {
		font-size: 0.875rem;
		font-weight: 600;
	}

	.required {
		color: var(--danger);
	}

	.hint {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--ink-muted);
	}

	.error {
		margin: 0;
		font-size: 0.8125rem;
		color: var(--danger);
	}
</style>
