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

<!--
	Native <button> elements rather than the shared Button component: the trigger needs a
	`bind:this` DOM reference so proceed() can re-click it, which keeps its formaction,
	name and value.
-->
<button
	bind:this={trigger}
	class="min-h-8 cursor-pointer border-2 border-danger bg-danger-soft px-3 text-xs font-bold tracking-wider text-danger uppercase"
	type="submit"
	{formaction}
	{name}
	{value}
	onclick={intercept}
>
	{label}
</button>

<dialog
	bind:this={dialog}
	aria-labelledby={headingId}
	class="max-w-[26rem] border-2 border-ink p-5 text-ink shadow-hard"
>
	<h2 id={headingId} class="text-lg font-black tracking-tight uppercase">{title}</h2>
	<p class="mt-0 mb-5 text-sm text-muted">{message}</p>
	<div class="flex justify-end gap-2">
		<button
			type="button"
			class="min-h-8 cursor-pointer border-2 border-line-strong bg-white px-3 text-xs font-bold tracking-wider text-ink uppercase"
			onclick={() => dialog.close()}>Cancel</button
		>
		<button
			type="button"
			class="min-h-8 cursor-pointer border-2 border-danger bg-danger-soft px-3 text-xs font-bold tracking-wider text-danger uppercase"
			onclick={proceed}>{confirmLabel}</button
		>
	</div>
</dialog>

<style>
	/*
	 * The one scoped rule left in the app: ::backdrop is a pseudo-element, so no utility
	 * class can reach it.
	 */
	dialog::backdrop {
		background: rgb(32 33 33 / 55%);
	}
</style>
