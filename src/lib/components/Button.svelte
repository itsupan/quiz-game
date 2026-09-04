<script lang="ts">
	import { resolve } from '$app/paths';
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		variant?: 'primary' | 'secondary';
		type?: 'button' | 'submit' | 'reset';
		href?: '/' | '/login' | '/signup';
		disabled?: boolean;
		ariaLabel?: string;
		class?: string;
	};

	let {
		children,
		variant = 'primary',
		type = 'button',
		href,
		disabled = false,
		ariaLabel,
		class: className = ''
	}: Props = $props();

	const base =
		'relative inline-flex min-h-16 w-full cursor-pointer items-center justify-center border-2 font-[inherit] text-base font-semibold no-underline shadow-[4px_4px_0_var(--ink)] transition-[transform,box-shadow,background] duration-150 hover:-translate-x-0.5 hover:-translate-y-0.5 hover:shadow-[6px_6px_0_var(--ink)] active:translate-x-0.5 active:translate-y-0.5 active:shadow-[2px_2px_0_var(--ink)] focus-visible:outline-3 focus-visible:outline-offset-4 focus-visible:outline-red-300 disabled:pointer-events-none disabled:cursor-not-allowed disabled:opacity-55 sm:min-h-19 sm:text-lg';
	const variants = {
		primary: 'border-[var(--red)] bg-[var(--red)] text-white',
		secondary: 'border-[var(--ink)] bg-[var(--paper)] text-[var(--ink)]'
	};
	const classes = $derived(`${base} ${variants[variant]} ${className}`);
</script>

{#if href}
	<a class={classes} href={resolve(href)} aria-label={ariaLabel} aria-disabled={disabled}>
		<span class="inline-flex items-center justify-center gap-3">{@render children()}</span>
	</a>
{:else}
	<button class={classes} {type} {disabled} aria-label={ariaLabel}>
		<span class="inline-flex items-center justify-center gap-3">{@render children()}</span>
	</button>
{/if}
