<script lang="ts">
	import type { TeamMember } from './team';

	type Props = {
		member: TeamMember;
		eager?: boolean;
	};

	let { member, eager = false }: Props = $props();

	function moveLayers(event: PointerEvent) {
		if (
			event.pointerType === 'touch' ||
			window.matchMedia('(prefers-reduced-motion: reduce)').matches
		) {
			return;
		}

		const portrait = event.currentTarget as HTMLElement;
		const bounds = portrait.getBoundingClientRect();
		const horizontal = (event.clientX - bounds.left) / bounds.width - 0.5;
		const vertical = (event.clientY - bounds.top) / bounds.height - 0.5;
		portrait.style.setProperty('--depth-x', `${horizontal * 8}px`);
		portrait.style.setProperty('--depth-y', `${vertical * 6}px`);
	}

	function resetLayers(event: PointerEvent) {
		const portrait = event.currentTarget as HTMLElement;
		portrait.style.removeProperty('--depth-x');
		portrait.style.removeProperty('--depth-y');
	}
</script>

<div
	class="portrait"
	role="img"
	aria-label={`AI-stylized portrait of ${member.name} in black, paper-white and red armor. ${member.motifDescription}`}
	onpointermove={moveLayers}
	onpointerleave={resetLayers}
>
	<div class="artwork" data-ink-reveal aria-hidden="true">
		<img
			class="layer background"
			src="/team/dojo-stage-background.webp"
			alt=""
			loading={eager ? 'eager' : 'lazy'}
			width="1024"
			height="1536"
		/>
		<span class="number">{member.mark}</span>
		<img
			class="layer body"
			src={member.imageUrl}
			alt=""
			loading={eager ? 'eager' : 'lazy'}
			fetchpriority={eager ? 'high' : 'auto'}
			width="1024"
			height="1536"
		/>
		<img
			class="layer brush"
			src="/team/dojo-foreground-ink.webp"
			alt=""
			loading={eager ? 'eager' : 'lazy'}
			width="1024"
			height="1536"
		/>
		<span class="kanji">守 · 創 · 続</span>
	</div>
</div>

<style>
	.portrait {
		--depth-x: 0px;
		--depth-y: 0px;
		position: relative;
		height: 100%;
		min-height: 34rem;
		overflow: hidden;
		border: 2px solid var(--color-ink);
		background: #eee7da;
		box-shadow: var(--shadow-hard-lg);
		contain: layout paint;
	}

	.artwork {
		position: absolute;
		inset: 0;
		overflow: hidden;
	}

	.layer {
		position: absolute;
		inset: 0;
		width: 100%;
		height: 100%;
		pointer-events: none;
	}

	.background {
		object-fit: cover;
		transform: translate3d(calc(var(--depth-x) * -0.35), calc(var(--depth-y) * -0.35), 0)
			scale(1.02);
	}

	.body {
		object-fit: contain;
		object-position: center bottom;
		z-index: 2;
		filter: drop-shadow(0.85rem 1rem 0 rgb(32 33 33 / 18%));
		transform: translate3d(var(--depth-x), var(--depth-y), 0);
	}

	.brush {
		z-index: 3;
		object-fit: cover;
		opacity: 0.64;
	}

	.number {
		position: absolute;
		top: -1rem;
		left: -0.2rem;
		z-index: 1;
		font-size: clamp(8rem, 18vw, 16rem);
		font-weight: 900;
		line-height: 1;
		letter-spacing: -0.1em;
		color: rgb(32 33 33 / 13%);
	}

	.kanji {
		position: absolute;
		top: 0.65rem;
		right: 0.65rem;
		z-index: 4;
		font-family: 'Yu Mincho', 'Hiragino Mincho ProN', serif;
		font-size: 0.75rem;
		font-weight: 700;
		line-height: 1;
		letter-spacing: 0.28em;
		color: var(--color-ink);
		writing-mode: vertical-rl;
	}

	@media (prefers-reduced-motion: no-preference) {
		.artwork {
			transition: clip-path 720ms cubic-bezier(0.22, 1, 0.36, 1);
		}

		:global(.motion-ready) :global([data-reveal]:not(.revealed)) .artwork {
			clip-path: polygon(0 0, 0 0, 10% 100%, 0 100%);
		}

		.background,
		.body {
			transition: transform 220ms ease-out;
			will-change: transform;
		}
	}

	@media (max-width: 900px) {
		.portrait {
			height: min(70svh, 43rem);
			min-height: 30rem;
		}
	}

	@media (max-width: 640px) {
		.portrait {
			height: 31rem;
			min-height: 0;
		}
	}
</style>
