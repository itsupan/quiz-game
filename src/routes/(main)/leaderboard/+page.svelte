<script lang="ts">
	import { toast } from '$lib/components/toast-store.svelte';
	import { LEVEL_CAP } from '$lib/features/leaderboard/leaderboard';
	import type { LeaderboardEntry } from '$lib/features/leaderboard/leaderboard';
	import { readApiResponse } from '$lib/features/quiz/api/client';
	import type { ApiPage } from '$lib/features/quiz/api/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

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

<div class="pb-16">
	<!-- Header -->
	<div class="mb-12 flex items-end justify-between border-b border-ink pb-2">
		<div class="flex items-center gap-3">
			<span class="h-8 w-1.5 bg-brand-red" aria-hidden="true"></span>
			<h1 class="text-3xl font-black tracking-tight text-ink uppercase">Leaderboard</h1>
		</div>
		<span class="text-xs font-bold tracking-widest text-stone-500 uppercase">Top Scorers</span>
	</div>

	<!-- Top 3 Section -->
	{#if podium.length > 0}
		<div class="mb-16 grid grid-cols-1 items-end gap-6 md:grid-cols-3">
			{#each podium as scorer (scorer.userId)}
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
	<div class="grid grid-cols-1 items-start gap-8 md:grid-cols-[1fr_2.5fr]">
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
						<div>
							<h3 class="mb-1 text-lg font-black text-ink uppercase">{scorer.displayName}</h3>
							<div class="flex items-center gap-1.5">
								<span class="h-2 w-2 bg-brand-red"></span>
								<span class="text-[10px] font-bold tracking-widest text-stone-500 uppercase">
									{scorer.streak} Day Streak
								</span>
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
