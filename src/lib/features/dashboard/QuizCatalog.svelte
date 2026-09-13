<script lang="ts">
	import { page } from '$app/state';
	import type { DashboardQuiz } from './dashboard';
	import { filterQuizCards, toQuizCards } from './dashboard';
	import QuizCard from './QuizCard.svelte';

	let { quizzes }: { quizzes: DashboardQuiz[] } = $props();
	let selectedLevel = $state('ALL LEVELS');
	let searchQuery = $state(page.url.searchParams.get('q') ?? '');
	const levels = ['ALL LEVELS', 'N5', 'N4', 'N3', 'N2', 'N1'];
	const cards = $derived(toQuizCards(quizzes));
	const filteredCards = $derived(filterQuizCards(cards, selectedLevel, searchQuery));
</script>

<section aria-label="Filter quizzes by JLPT level" class="pt-4">
	<div class="mb-4 flex items-center gap-4">
		<span class="text-xs font-black tracking-widest whitespace-nowrap text-brand-red uppercase">
			FILTER BY LEVEL:
		</span>
		<div class="flex-1 border-b border-stone-300" aria-hidden="true"></div>
	</div>
	<div class="flex flex-wrap items-center gap-2 sm:gap-2.5">
		{#each levels as level (level)}
			<button
				type="button"
				onclick={() => (selectedLevel = level)}
				class="px-4 py-1.5 text-xs font-black tracking-widest uppercase transition-colors {selectedLevel ===
				level
					? 'border-2 border-brand-red bg-brand-red text-white'
					: 'border-2 border-ink bg-white text-ink hover:bg-stone-100'}">{level}</button
			>
		{/each}
	</div>
</section>

<section aria-labelledby="featured-sets-heading" class="pt-4">
	<div class="mb-6 flex items-center justify-between border-b-2 border-ink pb-3">
		<div class="flex items-center gap-2 sm:gap-3">
			<span class="inline-block h-6 w-1.5 bg-brand-red" aria-hidden="true"></span>
			<h2
				id="featured-sets-heading"
				class="text-xl font-black tracking-tight text-ink uppercase sm:text-2xl"
			>
				FEATURED SETS
			</h2>
			<span
				class="hidden text-xs font-bold tracking-widest text-stone-500 uppercase sm:inline sm:text-sm"
				>/ BANSHI SHEJI</span
			>
		</div>
		<div class="flex items-center gap-1.5" aria-hidden="true">
			<span class="inline-block h-3.5 w-8 bg-brand-red"></span>
			<span class="inline-block h-3.5 w-2.5 bg-ink"></span>
			<span class="inline-block h-3.5 w-14 border border-ink bg-transparent"></span>
		</div>
	</div>

	{#if filteredCards.length > 0}
		<ul class="m-0 grid list-none grid-cols-1 gap-6 p-0 md:grid-cols-2 lg:grid-cols-3">
			{#each filteredCards as card (card.id)}
				<QuizCard {card} />
			{/each}
		</ul>
	{:else}
		<div class="space-y-3 border-2 border-ink bg-white p-10 text-center">
			<p class="text-lg font-black tracking-tight text-ink uppercase">
				No quiz sets found for level {selectedLevel}
			</p>
			<p class="text-xs font-medium tracking-wider text-stone-500 uppercase">
				Try selecting <button
					type="button"
					onclick={() => (selectedLevel = 'ALL LEVELS')}
					class="font-bold text-brand-red underline">ALL LEVELS</button
				> or adjusting your search query.
			</p>
		</div>
	{/if}
</section>
