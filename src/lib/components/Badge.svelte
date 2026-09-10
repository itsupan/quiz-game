<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = { children: Snippet; tone?: 'neutral' | 'success' | 'warning' | 'danger' };

	let { children, tone = 'neutral' }: Props = $props();

	// Colour never carries the meaning on its own — every badge's text says what it is.
	const tones = {
		neutral: 'border-line-strong bg-white text-muted',
		success: 'border-success bg-success-soft text-success',
		warning: 'border-warning bg-warning-soft text-warning',
		danger: 'border-danger bg-danger-soft text-danger'
	};
</script>

<span
	class="inline-block border px-1.5 py-0.5 text-[11px] font-bold tracking-widest uppercase {tones[
		tone
	]}"
>
	{@render children()}
</span>
