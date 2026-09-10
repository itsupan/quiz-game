<script lang="ts">
	import type { Snippet } from 'svelte';

	type Props = {
		children: Snippet;
		tone?: 'info' | 'success' | 'warning' | 'danger';
		/**
		 * Announce the message when it appears. Use for the result of an action the
		 * person just took; leave off for standing explanatory text.
		 */
		alert?: boolean;
	};

	let { children, tone = 'info', alert = false }: Props = $props();

	const tones = {
		info: 'border-line-strong bg-white text-ink',
		success: 'border-success bg-success-soft text-success',
		warning: 'border-warning bg-warning-soft text-warning',
		danger: 'border-danger bg-danger-soft text-danger'
	};
</script>

<p
	class="my-3 border-l-4 px-3 py-2 text-sm font-semibold {tones[tone]}"
	role={alert ? 'alert' : undefined}
>
	{@render children()}
</p>
