<script lang="ts">
	import type { WeeklyActivity } from './dashboard';

	let {
		userName,
		streakDays,
		weeklyActivity
	}: { userName: string; streakDays: number; weeklyActivity: WeeklyActivity } = $props();

	/** A day with no practice still gets a sliver of bar — an empty track reads as broken, not as zero. */
	const MIN_BAR_HEIGHT_PERCENT = 6;

	const maxQuestionCount = $derived(
		Math.max(1, ...weeklyActivity.days.map((day) => day.questionCount))
	);
	const cadence = $derived(
		weeklyActivity.days.map((day, index) => ({
			id: index,
			day: day.day,
			height: `${Math.max(MIN_BAR_HEIGHT_PERCENT, (day.questionCount / maxQuestionCount) * 100)}%`,
			active: day.isToday
		}))
	);
</script>

<section aria-labelledby="overview-heading">
	<div class="mb-6 flex items-center gap-2">
		<span class="inline-block h-8 w-1.5 bg-brand-red" aria-hidden="true"></span>
		<h2
			id="overview-heading"
			class="text-2xl font-black tracking-tight text-ink uppercase sm:text-3xl"
		>
			Overview
		</h2>
	</div>

	<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
		<div
			class="relative flex min-h-[220px] flex-col justify-between border-2 border-ink bg-white p-6 sm:p-8"
		>
			<div
				class="absolute top-0 right-0 flex h-12 w-12 items-center justify-center bg-brand-red text-white"
				aria-label="Active Streak Badge"
			>
				<svg class="h-6 w-6 fill-current" viewBox="0 0 24 24" aria-hidden="true">
					<path
						fill-rule="evenodd"
						d="M12.963 2.286a.75.75 0 0 0-1.071-.136 9.742 9.742 0 0 0-3.539 6.176 7.547 7.547 0 0 1-1.705-1.715.75.75 0 0 0-1.152-.082A9 9 0 1 0 15.68 4.534a7.46 7.46 0 0 1-2.717-2.248ZM15.75 14.25a3.75 3.75 0 1 1-7.313-1.172c.628.465 1.35.81 2.133 1a5.99 5.99 0 0 1 1.925-3.545 3.75 3.75 0 0 1 3.255 3.717Z"
						clip-rule="evenodd"
					></path>
				</svg>
			</div>

			<div>
				<h3 class="text-2xl font-extrabold tracking-tight text-ink sm:text-3xl">
					Welcome back, {userName}.
				</h3>
				<p class="mt-2 max-w-md text-sm leading-relaxed font-medium text-stone-600 sm:text-base">
					Your focus is sharp. Continue your structural learning path today.
				</p>
			</div>

			<div class="mt-8 flex items-baseline gap-2.5">
				<span
					class="text-6xl leading-none font-black tracking-tight text-brand-red sm:text-7xl"
					data-testid="streak-days"
				>
					{streakDays}
				</span>
				<span class="pb-1 text-xs font-black tracking-widest text-ink uppercase">DAY STREAK</span>
			</div>
		</div>

		<div class="border border-ink bg-white p-1.5">
			<div class="flex h-full min-h-[208px] flex-col justify-between border border-ink p-6">
				<div class="flex items-center justify-between border-b border-stone-200 pb-3">
					<span
						class="border-b-2 border-brand-red pb-0.5 text-xs font-black tracking-widest text-brand-red uppercase"
						>ACTIVE METRIC</span
					>
					<span class="font-mono text-[10px] tracking-wider text-stone-500 uppercase">
						WEEKLY CADENCE
					</span>
				</div>

				<div class="py-4">
					<div class="grid h-20 grid-cols-7 items-end gap-2 pt-2">
						{#each cadence as item (item.id)}
							<div class="flex h-full flex-col items-center justify-end gap-1.5">
								<div
									class="w-full transition-all {item.active ? 'bg-brand-red' : 'bg-ink'}"
									style:height={item.height}
								></div>
								<span class="font-mono text-[10px] font-bold text-stone-600">{item.day}</span>
							</div>
						{/each}
					</div>
				</div>

				<div
					class="flex items-center justify-between border-t border-stone-100 pt-3 text-xs font-bold tracking-wider text-ink uppercase"
				>
					<span>
						ACCURACY:
						<span class="text-brand-red">
							{weeklyActivity.accuracyPercentage === null
								? '—'
								: `${weeklyActivity.accuracyPercentage}%`}
						</span>
					</span>
					<span class="font-mono text-[11px] text-stone-500">
						{weeklyActivity.points.earned} / {weeklyActivity.points.max} PT
					</span>
				</div>
			</div>
		</div>
	</div>
</section>
