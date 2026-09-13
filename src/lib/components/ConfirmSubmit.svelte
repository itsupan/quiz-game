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
		form,
		name,
		value,
		disabled = false,
		triggerVariant = 'danger',
		open = $bindable(false)
	}: {
		label: string;
		title: string;
		message: string;
		confirmLabel?: string;
		formaction?: string;
		form?: string;
		name?: string;
		value?: string;
		disabled?: boolean;
		triggerVariant?: 'danger' | 'ghost';
		open?: boolean;
	} = $props();

	// A title can contain spaces, so it cannot double as an element id.
	const headingId = $props.id();

	let dialog: HTMLDialogElement;
	let trigger: HTMLButtonElement;
	let confirmed = false;
	const triggerClasses = $derived(
		`min-h-8 cursor-pointer border-2 px-3 text-xs font-bold tracking-wider uppercase transition-colors focus-visible:outline-3 focus-visible:outline-offset-4 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 ${
			triggerVariant === 'ghost'
				? 'border-line-strong bg-white text-muted hover:border-danger hover:text-danger'
				: 'border-danger bg-danger-soft text-danger'
		}`
	);

	$effect(() => {
		if (!dialog) return;

		if (open && !dialog.open) {
			dialog.showModal();
		} else if (!open && dialog.open) {
			dialog.close();
		}
	});

	function intercept(event: MouseEvent) {
		if (confirmed) {
			// Second pass, dispatched by proceed() below. Let the form submit, and re-arm:
			// `use:enhance` re-renders in place without remounting, so a submit the server
			// refuses would otherwise leave the next click unguarded.
			confirmed = false;

			return;
		}

		event.preventDefault();
		open = true;
	}

	function close() {
		open = false;
		dialog.close();
	}

	function proceed() {
		confirmed = true;
		close();
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
	class={triggerClasses}
	type="submit"
	{disabled}
	{formaction}
	{form}
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
	onclose={() => (open = false)}
>
	<h2 id={headingId} class="text-lg font-black tracking-tight uppercase">{title}</h2>
	<p class="mt-0 mb-5 text-sm text-muted">{message}</p>
	<div class="flex justify-end gap-2">
		<button
			type="button"
			class="min-h-8 cursor-pointer border-2 border-line-strong bg-white px-3 text-xs font-bold tracking-wider text-ink uppercase"
			onclick={close}>Cancel</button
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
	 * class can reach it, and a native <dialog>'s own centering needs restating here too —
	 * something upstream in the cascade zeroes out the `margin: auto` the UA stylesheet
	 * relies on to center a `showModal()` dialog, which otherwise pins it to the
	 * top-left corner instead of the middle of the screen.
	 */
	dialog {
		margin: auto;
		opacity: 0;
		scale: 0.95;
		translate: 0 8px;
		transition:
			opacity 180ms ease,
			scale 180ms ease,
			translate 180ms ease,
			overlay 180ms allow-discrete,
			display 180ms allow-discrete;
	}

	dialog[open] {
		opacity: 1;
		scale: 1;
		translate: 0 0;
	}

	@starting-style {
		dialog[open] {
			opacity: 0;
			scale: 0.95;
			translate: 0 8px;
		}
	}

	dialog::backdrop {
		background: rgb(32 33 33 / 55%);
		opacity: 0;
		transition:
			opacity 180ms ease,
			overlay 180ms allow-discrete,
			display 180ms allow-discrete;
	}

	dialog[open]::backdrop {
		opacity: 1;
	}

	@starting-style {
		dialog[open]::backdrop {
			opacity: 0;
		}
	}
</style>
