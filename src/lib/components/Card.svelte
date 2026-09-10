<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		/** Lifts the card off the page with the hard offset shadow. */
		raised?: boolean;
		class?: string;
	};

	let { children, raised = false, class: className = '' }: Props = $props();
</script>

<div class="border-2 border-ink bg-white {raised ? 'shadow-hard' : ''} {className}">
	{@render children()}
</div>
