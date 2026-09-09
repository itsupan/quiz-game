<script lang="ts">
	/**
	 * A submit button that asks first.
	 *
	 * This is a UI affordance, not a security control — the real ones are the POST, the
	 * admin guard on every `/admin` route, and archiving rather than deleting. Its job is
	 * to stop a misplaced click, and it is deliberately not `confirm()`: that blocks the
	 * whole page, cannot be styled or translated, and is hostile to screen readers and to
	 * browser automation alike.
	 *
	 * With JavaScript off the click handler never runs and the button submits directly,
	 * which is the correct fallback: the confirmation is the enhancement, not the action.
	 */
	let {
		label,
		title,
		message,
		confirmLabel = label,
		formaction,
		name,
		value
	}: {
		label: string;
		title: string;
		message: string;
		confirmLabel?: string;
		formaction?: string;
		name?: string;
		value?: string;
	} = $props();

	// A title can contain spaces, so it cannot double as an element id.
	const headingId = $props.id();

	let dialog: HTMLDialogElement;
	let trigger: HTMLButtonElement;
	let confirmed = false;

	function intercept(event: MouseEvent) {
		if (confirmed) {
			// Second pass, dispatched by proceed() below. Let the form submit, and re-arm:
			// `use:enhance` re-renders in place without remounting, so a submit the server
			// refuses would otherwise leave the next click unguarded.
			confirmed = false;

			return;
		}

		event.preventDefault();
		dialog.showModal();
	}

	function proceed() {
		confirmed = true;
		dialog.close();
		// Re-clicking the original button keeps its formaction, name and value, which a
		// requestSubmit() on the form would drop.
		trigger.click();
	}
</script>

<button
	bind:this={trigger}
	class="danger"
	type="submit"
	{formaction}
	{name}
	{value}
	onclick={intercept}
>
	{label}
</button>

<dialog bind:this={dialog} aria-labelledby={headingId}>
	<h2 id={headingId}>{title}</h2>
	<p>{message}</p>
	<div class="actions">
		<button type="button" class="quiet" onclick={() => dialog.close()}>Cancel</button>
		<button type="button" class="danger" onclick={proceed}>{confirmLabel}</button>
	</div>
</dialog>

<style>
	button {
		padding: 0.4375rem 0.75rem;
		border-radius: var(--radius-sm);
		border: 1px solid transparent;
		font-size: 0.875rem;
		font-weight: 550;
	}

	.danger {
		background: var(--danger-soft);
		border-color: color-mix(in srgb, var(--danger) 30%, transparent);
		color: var(--danger);
	}

	.quiet {
		background: var(--surface);
		border-color: var(--line-strong);
	}

	dialog {
		max-width: 26rem;
		padding: 1.25rem;
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
		color: var(--ink);
	}

	dialog::backdrop {
		background: rgb(16 24 40 / 45%);
	}

	dialog p {
		margin: 0 0 1.25rem;
		color: var(--ink-muted);
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}
</style>
