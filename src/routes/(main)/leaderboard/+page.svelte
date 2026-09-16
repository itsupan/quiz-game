<script lang="ts">
	import { onMount } from 'svelte';
	import { toast } from '$lib/components/toast-store.svelte';
	import { LEVEL_CAP } from '$lib/features/leaderboard/leaderboard';
	import type { LeaderboardEntry } from '$lib/features/leaderboard/leaderboard';
	import { readApiResponse } from '$lib/features/quiz/api/client';
	import type { ApiPage } from '$lib/features/quiz/api/types';
	import { LEADERBOARD_AUDIO_URL } from '$lib/features/sound/sound.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
	let audioEl: HTMLAudioElement;

	$effect(() => {
		if (!audioEl || !LEADERBOARD_AUDIO_URL) return;
		audioEl.play().catch(() => {});
	});

	onMount(() => {
		return () => audioEl?.pause();
	});

	let entries = $state<LeaderboardEntry[]>([]);
	let nextCursor = $state<string | null>(null);
	let loadingMore = $state(false);

	/** Resyncs the locally-appended list whenever the load rerun hands back a fresh first page. */
	$effect(() => {
		entries = data.entries;
		nextCursor = data.nextCursor;
	});

	/** Rank 2/1/3 in that order puts the champion in the center column on the podium grid. */
	const podium = $derived([entries[1], entries[0], entries[2]].filter((entry) => entry != null));
	const rest = $derived(entries.slice(3));

	function initials(displayName: string): string {
		return displayName
			.split(/\s+/)
			.slice(0, 2)
			.map((part) => part.slice(0, 1))
			.join('')
			.toUpperCase();
	}

	function levelLabel(entry: LeaderboardEntry): string {
		return entry.level === LEVEL_CAP ? `${LEVEL_CAP} MAX` : `${entry.level}`;
	}

	async function loadMore(): Promise<void> {
		if (nextCursor === null || loadingMore) return;

		loadingMore = true;
		try {
			const body = await readApiResponse<ApiPage<LeaderboardEntry[]>>(
				fetch(`/api/v1/leaderboard?cursor=${encodeURIComponent(nextCursor)}`)
			);
			entries = [...entries, ...body.data];
			nextCursor = body.page.nextCursor;
		} catch {
			toast.error('Could not load more of the leaderboard.');
		} finally {
			loadingMore = false;
		}
	}
</script>

<svelte:head>
	<title>Leaderboard | QuizGame</title>
</svelte:head>

<div class="leaderboard-page pb-16">
	{#if LEADERBOARD_AUDIO_URL}
		<audio
			bind:this={audioEl}
			src={LEADERBOARD_AUDIO_URL}
			autoplay
			loop
			preload="auto"
			class="hidden"
		></audio>
	{/if}

	<div class="samurai-atmosphere" aria-hidden="true">
		<div class="rising-sun"></div>
		<div class="ink-brush ink-brush-one"></div>
		<div class="ink-brush ink-brush-two"></div>
		<div class="katana-slash"></div>
	</div>

	<!-- Header -->
	<div class="leaderboard-content mb-12 flex items-end justify-between border-b border-ink pb-2">
		<div class="flex items-center gap-3">
			<span class="h-8 w-1.5 bg-brand-red" aria-hidden="true"></span>
			<h1 class="text-3xl font-black tracking-tight text-ink uppercase">Leaderboard</h1>
		</div>
		<span class="text-xs font-bold tracking-widest text-stone-500 uppercase">Top Scorers</span>
	</div>

	<!-- Top 3 Section -->
	{#if podium.length > 0}
		<div class="leaderboard-content mb-16 grid grid-cols-1 items-end gap-6 md:grid-cols-3">
			{#each podium as scorer (scorer.userId)}
				{#if scorer.rank === 1}
					<!-- 1st Place Card -->
					<div
						class="rank-card rank-card-champion relative order-first flex w-full flex-col items-center border-[3px] border-ink bg-paper p-6 shadow-hard-lg md:order-0"
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

						<style>
							.leaderboard-page {
								position: relative;
								isolation: isolate;
								overflow: hidden;
							}

							.leaderboard-content {
								position: relative;
								z-index: 1;
							}

							.samurai-atmosphere {
								position: absolute;
								inset: 0;
								z-index: -1;
								overflow: hidden;
								pointer-events: none;
							}

							.rising-sun {
								position: absolute;
								top: 2rem;
								right: -4rem;
								width: clamp(12rem, 30vw, 22rem);
								aspect-ratio: 1;
								border-radius: 50%;
								background: var(--color-brand-red);
								opacity: 0.12;
								animation: sun-breathe 8s ease-in-out infinite;
							}

							.ink-brush {
								position: absolute;
								width: 45vw;
								height: 1.5rem;
								background: var(--color-ink);
								opacity: 0.08;
								filter: blur(0.4px);
								transform: rotate(-12deg);
							}

							.ink-brush-one {
								top: 10rem;
								left: -12rem;
							}

							.ink-brush-two {
								top: 18rem;
								right: -14rem;
								transform: rotate(18deg);
							}

							.katana-slash {
								position: absolute;
								top: 8rem;
								left: -15%;
								width: 130%;
								height: 2px;
								background: linear-gradient(90deg, transparent, var(--color-brand-red), transparent);
								opacity: 0;
								transform: rotate(-7deg);
								animation: katana-sweep 7s ease-in-out 1s infinite;
							}

							.rank-card {
								animation: card-rise 650ms ease-out both;
							}

							.rank-card-champion {
								animation-delay: 120ms;
							}

							@media (prefers-reduced-motion: no-preference) {
								.rank-card:nth-child(2) {
									animation-delay: 240ms;
								}

								.rank-card:nth-child(3) {
									animation-delay: 360ms;
								}

								@keyframes card-rise {
									from {
										opacity: 0;
										transform: translateY(1rem);
									}
									to {
										opacity: 1;
										transform: translateY(0);
									}
								}

								@keyframes sun-breathe {
									0%,
									100% {
										transform: scale(1);
									}
									50% {
										transform: scale(1.06);
									}
								}

								@keyframes katana-sweep {
									0%,
									65%,
									100% {
										opacity: 0;
										transform: translateX(-15%) rotate(-7deg);
									}
									72% {
										opacity: 0.7;
									}
									82% {
										opacity: 0;
										transform: translateX(15%) rotate(-7deg);
									}
								}
							}

							@media (prefers-reduced-motion: reduce) {
								.rank-card,
								.rising-sun,
								.katana-slash {
									animation: none;
								}
							}
						</style>
						<div class="mb-6 w-full border-b border-line"></div>

						<!-- Avatar & Info -->
						<div
							class="mb-4 flex h-24 w-24 items-center justify-center overflow-hidden border-2 border-ink bg-stone-200"
						>
							{#if scorer.avatarUrl}
								<img src={scorer.avatarUrl} alt="" class="h-full w-full object-cover" />
							{:else}
								<span class="text-2xl font-black text-stone-400"
									>{initials(scorer.displayName)}</span
								>
							{/if}
						</div>
						<h2 class="mb-1 text-xl font-black text-ink uppercase">{scorer.displayName}</h2>
						<span class="mb-6 text-xs font-bold text-brand-red uppercase"
							>Level {levelLabel(scorer)}</span
						>

						<!-- Footer -->
						<div class="mt-auto flex w-full items-end justify-between border-t border-line pt-4">
							<span class="text-[10px] font-bold tracking-widest text-ink uppercase"
								>Total Score</span
							>
							<span class="text-3xl font-black text-brand-red"
								>{scorer.totalXp.toLocaleString()}</span
							>
						</div>
					</div>
				{:else}
					<!-- 2nd & 3rd Place Cards -->
					<div class="rank-card flex w-full flex-col items-center border-2 border-ink bg-paper p-5">
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
							class="mb-3 flex h-20 w-20 items-center justify-center overflow-hidden border border-ink bg-stone-200"
						>
							{#if scorer.avatarUrl}
								<img src={scorer.avatarUrl} alt="" class="h-full w-full object-cover" />
							{:else}
								<span class="text-xl font-black text-stone-400">{initials(scorer.displayName)}</span
								>
							{/if}
						</div>
						<h2 class="mb-1 text-lg font-black text-ink uppercase">{scorer.displayName}</h2>
						<span class="mb-5 text-xs font-bold text-stone-500 uppercase"
							>Level {levelLabel(scorer)}</span
						>

						<!-- Footer -->
						<div class="mt-auto flex w-full items-end justify-between border-t border-line pt-3">
							<span class="text-[10px] font-bold tracking-widest text-ink uppercase">Score</span>
							<span class="text-2xl font-black text-brand-red"
								>{scorer.totalXp.toLocaleString()}</span
							>
						</div>
					</div>
				{/if}
			{/each}
		</div>
	{/if}

	<!-- Global Rank List -->
	<div class="leaderboard-content grid grid-cols-1 items-start gap-8 md:grid-cols-[1fr_2.5fr]">
		<div class="border-l-2 border-brand-red pl-4 md:sticky md:top-24">
			<h2 class="mb-2 text-xs font-bold tracking-widest text-brand-red uppercase">Global Rank</h2>
			<p class="text-sm font-medium text-stone-600">
				The top 100 students based on overall performance and consecutive daily streaks.
			</p>
		</div>

		<div class="flex flex-col gap-3">
			{#if rest.length === 0 && podium.length === 0}
				<p
					class="border-2 border-ink bg-paper p-6 text-center text-sm font-bold text-stone-500 uppercase"
				>
					No attempts have been submitted yet.
				</p>
			{/if}

			{#each rest as scorer (scorer.userId)}
				<div class="flex items-stretch border-2 border-ink bg-paper">
					<div class="flex w-16 items-center justify-center border-r-2 border-ink bg-stone-50">
						<span class="text-xl font-black text-stone-500">
							{scorer.rank.toString().padStart(2, '0')}
						</span>
					</div>
					<div class="flex flex-1 items-center justify-between p-4">
						<div class="flex min-w-0 items-center gap-3">
							<div
								class="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden border border-ink bg-stone-200"
							>
								{#if scorer.avatarUrl}
									<img src={scorer.avatarUrl} alt="" class="h-full w-full object-cover" />
								{:else}
									<span class="text-xs font-black text-stone-400">{initials(scorer.displayName)}</span>
								{/if}
							</div>
							<div>
								<h3 class="mb-1 text-lg font-black text-ink uppercase">{scorer.displayName}</h3>
							<div class="flex items-center gap-1.5">
								<span class="h-2 w-2 bg-brand-red"></span>
								<span class="text-[10px] font-bold tracking-widest text-stone-500 uppercase">
									{scorer.streak} Day Streak
								</span>
							</div>
							</div>
						</div>
						<div class="text-right">
							<div class="text-xl font-black text-ink">{scorer.totalXp.toLocaleString()}</div>
							<div class="text-[10px] font-bold tracking-widest text-stone-500 uppercase">Pts</div>
						</div>
					</div>
				</div>
			{/each}

			{#if nextCursor !== null}
				<button
					type="button"
					onclick={loadMore}
					disabled={loadingMore}
					class="mt-2 w-full border-2 border-ink py-4 text-center text-sm font-black tracking-widest text-ink uppercase transition-colors hover:bg-stone-50 disabled:opacity-50"
				>
					{loadingMore ? 'Loading…' : 'Load More'}
				</button>
			{/if}
		</div>
	</div>
</div>
