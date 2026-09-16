<script lang="ts">
	import { onMount } from 'svelte';

	/**
	 * A short burst of ink over a finished practice run.
	 *
	 * Squares, not confetti: the design system's rule is square by default, and a handful of
	 * absolutely positioned spans with a staggered keyframe costs nothing next to pulling in
	 * an animation library for one moment on one page.
	 *
	 * Decorative, so `aria-hidden`, and it removes itself rather than lingering over the
	 * buttons underneath.
	 */
	const FLECK_COUNT = 14;
	const LIFETIME_MS = 1_700;

	const flecks = Array.from({ length: FLECK_COUNT }, (_, i) => ({
		id: i,
		left: `${8 + (84 / (FLECK_COUNT - 1)) * i}%`,
		delay: `${(i % 5) * 60}ms`,
		drift: `${(i % 2 === 0 ? 1 : -1) * (12 + (i % 4) * 9)}px`,
		size: `${8 + (i % 3) * 4}px`,
		tone: ['var(--color-brand-red)', 'var(--color-ink)', 'var(--color-brown)'][i % 3]
	}));

	let done = $state(false);
	onMount(() => {
		const id = setTimeout(() => (done = true), LIFETIME_MS);
		return () => clearTimeout(id);
	});
</script>

{#if !done}
	<div class="celebration" aria-hidden="true">
		{#each flecks as fleck (fleck.id)}
			<span
				style:left={fleck.left}
				style:animation-delay={fleck.delay}
				style:--drift={fleck.drift}
				style:width={fleck.size}
				style:height={fleck.size}
				style:background={fleck.tone}
			></span>
		{/each}
	</div>
{/if}

<style>
	.celebration {
		position: fixed;
		inset: 0;
		z-index: 40;
		pointer-events: none;
		overflow: hidden;
	}

	.celebration span {
		position: absolute;
		top: -5%;
		display: block;
		opacity: 0;
	}

	/*
	 * Opt-in, like every other motion in this app: someone who asked for less movement gets
	 * a page with none, not a quieter version of this.
	 */
	@media (prefers-reduced-motion: no-preference) {
		.celebration span {
			animation: ink-fall 1.4s cubic-bezier(0.3, 0.7, 0.4, 1) forwards;
		}

		@keyframes ink-fall {
			0% {
				opacity: 0;
				transform: translate3d(0, 0, 0) rotate(0deg);
			}
			12% {
				opacity: 1;
			}
			100% {
				opacity: 0;
				transform: translate3d(var(--drift), 92vh, 0) rotate(220deg);
			}
		}
	}
</style>
