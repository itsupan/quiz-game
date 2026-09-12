<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		/** Lifts the card off the page with the hard offset shadow. */
		raised?: boolean;
		class?: string;
		/** Add a stagger delay for lists of cards */
		delay?: 'none' | 'sm' | 'md' | 'lg';
	};

	let { children, raised = false, delay = 'none', class: className = '' }: Props = $props();

	const delays = {
		none: '',
		sm: '[animation-delay:100ms]',
		md: '[animation-delay:200ms]',
		lg: '[animation-delay:300ms]'
	};
</script>

<div
	class="group relative z-0 animate-fade-up overflow-hidden opacity-0 transition-all duration-300 ease-out before:absolute before:inset-[-150%] before:z-[-2] before:animate-[spin_4s_linear_infinite] before:bg-[conic-gradient(from_90deg_at_50%_50%,var(--color-ink)_0%,#facc15_50%,var(--color-ink)_100%)] before:content-[''] after:absolute after:inset-[2px] after:z-[-1] after:bg-white after:content-[''] hover:-translate-y-1 hover:shadow-hard-lg {delays[
		delay
	]} {raised ? 'shadow-hard' : ''} {className}"
>
	{@render children()}
</div>
