<script lang="ts">
	let { userName, streakDays }: { userName: string; streakDays: number } = $props();

	const cadence = [
		{ id: 'mon', day: 'M', height: '45%', active: false },
		{ id: 'tue', day: 'T', height: '65%', active: false },
		{ id: 'wed', day: 'W', height: '85%', active: false },
		{ id: 'thu', day: 'T', height: '50%', active: false },
		{ id: 'fri', day: 'F', height: '95%', active: true },
		{ id: 'sat', day: 'S', height: '70%', active: false },
		{ id: 'sun', day: 'S', height: '90%', active: true }
	];
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
						d="M12 23c-4.97 0-9-4.03-9-9 0-3.53 2.06-6.66 5.14-8.08C8.84 8.79 10.42 11 12 11c1.5 0 2.25-1.5 1.5-3.5 3.08 1.42 5.5 4.55 5.5 8.5 0 4.97-4.03 9-9 9z"
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
					<span>ACCURACY: <span class="text-brand-red">94.2%</span></span>
					<span class="font-mono text-[11px] text-stone-500">180 / 180 PT</span>
				</div>
			</div>
		</div>
	</div>
</section>
