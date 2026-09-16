<script lang="ts">
	import { computeLevel, XP_PER_LEVEL } from '$lib/features/leaderboard/leaderboard';

	/**
	 * The learner's standing, visible while they play.
	 *
	 * Shows lifetime XP as it stood when the sitting began, and deliberately does not tick up
	 * per question: XP is not awarded until the attempt is finalized, so a number climbing here
	 * would be a guess that the result screen then contradicts. The payoff belongs on the
	 * result screen, where the figure is real.
	 *
	 * Hidden below `sm` — the sticky bar already carries a badge, counts, a progress bar, a
	 * navigator, a countdown and three controls, and it overflows on a phone before this.
	 */
	let { lifetimeXp }: { lifetimeXp: number } = $props();

	const level = $derived(computeLevel(lifetimeXp));
	const intoLevel = $derived(lifetimeXp % XP_PER_LEVEL);
	const percent = $derived(Math.round((intoLevel / XP_PER_LEVEL) * 100));
</script>

<div class="hidden shrink-0 flex-col gap-1 sm:flex" data-testid="level-badge">
	<span class="text-[10px] font-black tracking-widest text-stone-500 uppercase">
		Lv {level}
	</span>
	<span
		class="block h-1.5 w-16 bg-stone-200"
		role="progressbar"
		aria-label="Progress to next level"
		aria-valuemin={0}
		aria-valuenow={intoLevel}
		aria-valuemax={XP_PER_LEVEL}
		aria-valuetext={`${intoLevel} of ${XP_PER_LEVEL} XP toward level ${level + 1}`}
	>
		<span class="block h-full bg-brand-red" style:width={`${percent}%`}></span>
	</span>
</div>
