<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
		/** `lg` is the full-width auth-page button; `md` is the default everywhere else. */
		size?: 'sm' | 'md' | 'lg';
		type?: 'button' | 'submit' | 'reset';
		href?: string;
		disabled?: boolean;
		/** Submit this button to a named form action instead of the form's own. */
		formaction?: string;
		name?: string;
		value?: string;
		ariaLabel?: string;
		onclick?: () => void;
		class?: string;
	};

	let {
		children,
		variant = 'primary',
		size = 'md',
		type = 'button',
		href,
		disabled = false,
		formaction,
		name,
		value,
		ariaLabel,
		onclick,
		class: className = ''
	}: Props = $props();

	// Square and hard-shadowed; the depth cue is the offset, never a radius.
	const base =
		'relative inline-flex cursor-pointer items-center justify-center border-2 font-[inherit] font-semibold no-underline motion-reduce:transition-[transform,box-shadow,background] motion-reduce:duration-150 motion-reduce:hover:-translate-x-0.5 motion-reduce:hover:-translate-y-0.5 motion-reduce:active:translate-x-0.5 motion-reduce:active:translate-y-0.5 motion-safe:transition-all motion-safe:duration-200 motion-safe:ease-out motion-safe:hover:-translate-y-1 motion-safe:active:translate-y-1 motion-safe:active:shadow-none focus-visible:outline-3 focus-visible:outline-offset-4 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55';

	const sizes = {
		sm: 'min-h-8 px-3 text-xs tracking-wider uppercase shadow-[2px_2px_0_var(--color-ink)] hover:shadow-[4px_4px_0_var(--color-ink)]',
		md: 'min-h-10 px-4 text-sm tracking-wider uppercase shadow-hard hover:shadow-hard-lg',
		lg: 'min-h-16 w-full px-6 text-base shadow-hard hover:shadow-hard-lg sm:min-h-19 sm:text-lg'
	};

	const variants = {
		primary: 'border-brand-red bg-brand-red text-white',
		secondary: 'border-ink bg-paper text-ink',
		ghost:
			'border-line-strong bg-white text-ink shadow-none hover:translate-x-0 hover:translate-y-0 hover:shadow-none',
		danger: 'border-danger bg-danger-soft text-danger'
	};

	const classes = $derived(`${base} ${sizes[size]} ${variants[variant]} ${className}`);
</script>

{#if href}
	<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
	<a class={classes} {href} aria-label={ariaLabel} aria-disabled={disabled}>
		<span class="inline-flex items-center justify-center gap-3">{@render children()}</span>
	</a>
{:else}
	<button
		class={classes}
		{type}
		{disabled}
		{formaction}
		{name}
		{value}
		aria-label={ariaLabel}
		{onclick}
	>
		<span class="inline-flex items-center justify-center gap-3">{@render children()}</span>
	</button>
{/if}
