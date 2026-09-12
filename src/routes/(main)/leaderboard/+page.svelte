<script lang="ts">
	// Mock Data
	const topScorers = [
		{ rank: 2, name: 'EMI TANAKA', level: 42, score: 14250, avatar: 'ET' },
		{ rank: 1, name: 'KENJI SATO', level: '50 MAX', score: 18900, avatar: 'KS' },
		{ rank: 3, name: 'YUKI NAKAMURA', level: 39, score: 12100, avatar: 'YN' }
	];

	const otherScorers = [
		{ rank: 4, name: 'AKIRA ITO', streak: 15, score: 11450 },
		{ rank: 5, name: 'MEI WATANABE', streak: 3, score: 10890 },
		{ rank: 6, name: 'HIROSHI YAMADA', streak: 22, score: 9950 }
	];
</script>

<svelte:head>
	<title>Leaderboard | QuizGame</title>
</svelte:head>

<div class="mx-auto max-w-4xl pb-16">
	<!-- Header -->
	<div class="mb-12 flex items-end justify-between border-b border-ink pb-2">
		<div class="flex items-center gap-2">
			<div class="bg-brand-red px-2 py-1">
				<span class="text-3xl font-black text-white">03</span>
			</div>
			<span class="text-3xl font-black text-ink">/</span>
			<h1 class="text-3xl font-black tracking-tight text-ink uppercase">Leaderboard</h1>
		</div>
		<span class="text-xs font-bold tracking-widest text-stone-500 uppercase">Top Scorers</span>
	</div>

	<!-- Top 3 Section -->
	<div class="mb-16 grid grid-cols-1 items-end gap-6 md:grid-cols-3">
		{#each topScorers as scorer (scorer.rank)}
			{#if scorer.rank === 1}
				<!-- 1st Place Card -->
				<div
					class="relative order-first flex w-full flex-col items-center border-[3px] border-ink bg-paper p-6 shadow-hard-lg md:order-none"
				>
					<!-- Header -->
					<div class="mb-4 flex w-full items-start justify-between">
						<div class="flex items-baseline gap-1">
							<span class="text-4xl font-black text-brand-red">01</span>
							<span class="text-2xl font-black text-ink">/</span>
						</div>
						<div class="bg-brand-red px-2 py-1">
							<span class="text-[10px] font-bold tracking-widest text-white uppercase"
								>Champion</span
							>
						</div>
					</div>
					<div class="mb-6 w-full border-b border-line"></div>

					<!-- Avatar & Info -->
					<div
						class="mb-4 flex h-24 w-24 items-center justify-center border-2 border-ink bg-stone-200"
					>
						<span class="text-2xl font-black text-stone-400">{scorer.avatar}</span>
					</div>
					<h2 class="mb-1 text-xl font-black text-ink uppercase">{scorer.name}</h2>
					<span class="mb-6 text-xs font-bold text-brand-red uppercase">Level {scorer.level}</span>

					<!-- Footer -->
					<div class="mt-auto flex w-full items-end justify-between border-t border-line pt-4">
						<span class="text-[10px] font-bold tracking-widest text-ink uppercase">Total Score</span
						>
						<span class="text-3xl font-black text-brand-red">{scorer.score.toLocaleString()}</span>
					</div>
				</div>
			{:else}
				<!-- 2nd & 3rd Place Cards -->
				<div class="flex w-full flex-col items-center border-2 border-ink bg-paper p-5">
					<!-- Header -->
					<div class="mb-4 flex w-full items-start justify-between">
						<div class="flex items-baseline gap-1">
							<span class="text-3xl font-black text-brand-red">0{scorer.rank}</span>
							<span class="text-xl font-black text-ink">/</span>
						</div>
						<div class="border border-ink px-2 py-0.5">
							<span class="text-[10px] font-bold tracking-widest text-ink uppercase">Rank</span>
						</div>
					</div>
					<div class="mb-5 w-full border-b border-line"></div>

					<!-- Avatar & Info -->
					<div
						class="mb-3 flex h-20 w-20 items-center justify-center border border-ink bg-stone-200"
					>
						<span class="text-xl font-black text-stone-400">{scorer.avatar}</span>
					</div>
					<h2 class="mb-1 text-lg font-black text-ink uppercase">{scorer.name}</h2>
					<span class="mb-5 text-xs font-bold text-stone-500 uppercase">Level {scorer.level}</span>

					<!-- Footer -->
					<div class="mt-auto flex w-full items-end justify-between border-t border-line pt-3">
						<span class="text-[10px] font-bold tracking-widest text-ink uppercase">Score</span>
						<span class="text-2xl font-black text-brand-red">{scorer.score.toLocaleString()}</span>
					</div>
				</div>
			{/if}
		{/each}
	</div>

	<!-- Global Rank List -->
	<div class="grid grid-cols-1 items-start gap-8 md:grid-cols-[1fr_2.5fr]">
		<div class="border-l-2 border-brand-red pl-4 md:sticky md:top-24">
			<h2 class="mb-2 text-xs font-bold tracking-widest text-brand-red uppercase">Global Rank</h2>
			<p class="text-sm font-medium text-stone-600">
				The top 100 students based on overall performance and consecutive daily streaks.
			</p>
		</div>

		<div class="flex flex-col gap-3">
			{#each otherScorers as scorer (scorer.rank)}
				<div class="flex items-stretch border-2 border-ink bg-paper">
					<div class="flex w-16 items-center justify-center border-r-2 border-ink bg-stone-50">
						<span class="text-xl font-black text-stone-500">
							{scorer.rank.toString().padStart(2, '0')}
						</span>
					</div>
					<div class="flex flex-1 items-center justify-between p-4">
						<div>
							<h3 class="mb-1 text-lg font-black text-ink uppercase">{scorer.name}</h3>
							<div class="flex items-center gap-1.5">
								<span class="h-2 w-2 bg-brand-red"></span>
								<span class="text-[10px] font-bold tracking-widest text-stone-500 uppercase">
									{scorer.streak} Day Streak
								</span>
							</div>
						</div>
						<div class="text-right">
							<div class="text-xl font-black text-ink">{scorer.score.toLocaleString()}</div>
							<div class="text-[10px] font-bold tracking-widest text-stone-500 uppercase">Pts</div>
						</div>
					</div>
				</div>
			{/each}

			<button
				class="mt-2 w-full border-2 border-ink py-4 text-center text-sm font-black tracking-widest text-ink uppercase transition-colors hover:bg-stone-50"
			>
				Load More
			</button>
		</div>
	</div>
</div>
