<!--
	A nav link whose href is already resolved by the caller.

	`svelte/no-navigation-without-resolve` cannot see through a prop, so it would flag
	the one line this component is made of. The rule is turned off for this file in
	eslint.config.js, which keeps it enforced everywhere else.
-->
<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		/** Must already be through resolve(). */
		href: string;
		current?: boolean;
		class?: string;
		onclick?: () => void;
	};

	let { children, href, current = false, class: className = '', onclick }: Props = $props();
</script>

<a {href} class={className} aria-current={current ? 'page' : undefined} {onclick}>
	{@render children()}
</a>
