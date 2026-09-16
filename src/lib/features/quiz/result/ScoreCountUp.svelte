<script lang="ts">
	/**
	 * Counts a final score up from zero.
	 *
	 * Purely presentational — the number is already decided, this only decides how it arrives.
	 * Practice sittings use it; an exam result states its score plainly, because a score
	 * report should not perform.
	 */
	let { value, durationMs = 700 }: { value: number; durationMs?: number } = $props();

	let shown = $state(0);

	$effect(() => {
		const target = value;

		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
			shown = target;
			return;
		}

		let frame: number;
		const startedAt = performance.now();

		const step = (at: number) => {
			const progress = Math.min(1, (at - startedAt) / durationMs);
			// Ease-out cubic: fast first, settling onto the real figure rather than snapping.
			shown = Math.round(target * (1 - Math.pow(1 - progress, 3)));

			if (progress < 1) frame = requestAnimationFrame(step);
		};

		frame = requestAnimationFrame(step);
		return () => cancelAnimationFrame(frame);
	});
</script>

<!--
	The ticking figure is hidden from assistive tech and the final value announced once
	beside it, so a screen reader hears the score rather than every frame on the way to it.
-->
<span aria-hidden="true">{shown}</span>
<span class="visually-hidden">{value}</span>
