<script lang="ts">
	import { SvelteSet } from 'svelte/reactivity';
	import { COMBO_THRESHOLDS, comboTier } from './game-feel';

	/**
	 * The practice streak, as a stamp.
	 *
	 * Square and hard-shadowed, because the design system's depth cue is the offset, never a
	 * radius. Only `JLPT_PRACTICE` renders it — an exam sitting has no streak to show.
	 */
	let { combo }: { combo: number } = $props();

	const tier = $derived(comboTier(combo));

	/**
	 * Announced only when a threshold is crossed, never on every increment.
	 *
	 * The same discipline the countdown uses for its 10/5/1-minute notices: a live region
	 * that fires on each of twenty questions is noise that drowns out the verdict beside it.
	 */
	let announcement = $state('');
	const announced = new SvelteSet<number>();

	$effect(() => {
		if (combo === 0) {
			announced.clear();
			return;
		}
		if (
			COMBO_THRESHOLDS.includes(combo as (typeof COMBO_THRESHOLDS)[number]) &&
			!announced.has(combo)
		) {
			announced.add(combo);
			announcement = `${combo} in a row.`;
		}
	});
</script>

{#if combo > 0}
	{#key combo}
		<p
			class="combo-stamp m-0 flex shrink-0 items-baseline gap-1 border-2 border-ink px-2 py-0.5 shadow-hard"
			class:tier-1={tier === 1}
			class:tier-2={tier === 2}
			class:tier-3={tier === 3}
			data-testid="combo-meter"
		>
			<span class="font-mono text-sm font-black tabular-nums">{combo}</span>
			<span class="text-[10px] font-black tracking-widest uppercase">streak</span>
		</p>
	{/key}
{/if}

<p class="visually-hidden" aria-live="polite">{announcement}</p>

<style>
	.combo-stamp {
		background: var(--color-paper);
		color: var(--color-ink);
	}

	.combo-stamp.tier-1 {
		background: var(--color-warning-soft);
		color: var(--color-warning);
		border-color: var(--color-warning);
	}

	.combo-stamp.tier-2,
	.combo-stamp.tier-3 {
		background: var(--color-brand-red);
		color: var(--color-paper);
		border-color: var(--color-brand-red);
	}

	/*
	 * Opt-in motion, matching the convention the team page established: the keyframes only
	 * exist when the visitor has not asked for less movement.
	 */
	@media (prefers-reduced-motion: no-preference) {
		.combo-stamp {
			animation: combo-tick 220ms ease-out;
		}

		.combo-stamp.tier-2,
		.combo-stamp.tier-3 {
			animation: combo-pop 320ms cubic-bezier(0.2, 1.4, 0.4, 1);
		}

		@keyframes combo-tick {
			from {
				transform: translateY(2px);
			}
			to {
				transform: none;
			}
		}

		@keyframes combo-pop {
			0% {
				transform: scale(0.85) rotate(-3deg);
			}
			60% {
				transform: scale(1.12) rotate(1.5deg);
			}
			100% {
				transform: none;
			}
		}
	}
</style>
