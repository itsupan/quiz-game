<script lang="ts">
	import { page } from '$app/state';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	// Default to N4 as shown in the user's mockup reference, or allow ALL LEVELS
	let selectedLevel = $state<string>('N4');
	let searchQuery = $state<string>(page.url.searchParams.get('q') ?? '');

	const levels = ['ALL LEVELS', 'N5', 'N4', 'N3', 'N2', 'N1'];

	interface CardItem {
		id: string;
		title: string;
		description: string;
		level: string;
		category: string;
		categoryStyle: 'underlined' | 'boxed';
		icon: 'book' | 'flask' | 'math';
		cornerTriangle?: boolean;
	}

	// Curated featured sets matching the user's visual mockup reference
	const mockupFeaturedCards: CardItem[] = [
		{
			id: 'mockup-card-1',
			title: 'Advanced Typography & Layout',
			description: 'Master the spatial relationships in grid systems...',
			level: 'N4',
			category: 'LANGUAGE ARTS',
			categoryStyle: 'underlined',
			icon: 'book',
			cornerTriangle: false
		},
		{
			id: 'mockup-card-2',
			title: 'Cellular Structures',
			description: 'Identify and understand the function of complex...',
			level: 'N4',
			category: 'SCIENCES',
			categoryStyle: 'underlined',
			icon: 'flask',
			cornerTriangle: false
		},
		{
			id: 'mockup-card-3',
			title: 'Calculus II Foundations',
			description: 'Integration techniques and sequences.',
			level: 'N4',
			category: 'MATHEMATICS',
			categoryStyle: 'boxed',
			icon: 'math',
			cornerTriangle: true
		}
	];

	// Map live database quizzes to the same brutalist card design
	const dbCards = $derived<CardItem[]>(
		(data.quizzes ?? []).map((quiz, index) => {
			let category = 'LANGUAGE ARTS';
			let icon: 'book' | 'flask' | 'math' = 'book';
			let categoryStyle: 'underlined' | 'boxed' = 'underlined';

			if (quiz.sections.includes('LISTENING')) {
				category = 'SCIENCES';
				icon = 'flask';
			} else if (quiz.mode === 'FULL_EXAM' || quiz.mode === 'MOCK_TEST') {
				category = 'MATHEMATICS';
				icon = 'math';
				categoryStyle = 'boxed';
			}

			return {
				id: quiz.publicId,
				title: quiz.title,
				description: quiz.description || 'Comprehensive JLPT evaluation and structural review.',
				level: quiz.level,
				category,
				categoryStyle,
				icon,
				cornerTriangle: index % 3 === 2
			};
		})
	);

	// Combined card list
	const allCards = $derived<CardItem[]>([...mockupFeaturedCards, ...dbCards]);

	// Filtered cards based on active level and search term
	const filteredCards = $derived<CardItem[]>(
		allCards.filter((card) => {
			const matchesLevel =
				selectedLevel === 'ALL LEVELS'
					? true
					: card.level.toUpperCase() === selectedLevel.toUpperCase();

			const q = searchQuery.trim().toLowerCase();
			const matchesSearch =
				q === '' ||
				card.title.toLowerCase().includes(q) ||
				card.description.toLowerCase().includes(q) ||
				card.category.toLowerCase().includes(q) ||
				card.level.toLowerCase().includes(q);

			return matchesLevel && matchesSearch;
		})
	);

	function setLevel(level: string) {
		selectedLevel = level;
	}

	const userName = $derived(data.user?.displayName || 'Student');
</script>

<svelte:head>
	<title>Home | QuizGame</title>
</svelte:head>

<div class="space-y-8">
	<!-- 01 / OVERVIEW SECTION -->
	<section aria-labelledby="overview-heading">
		<div class="mb-6 flex items-center gap-2">
			<span class="inline-block h-8 w-1.5 bg-[#B6251F]" aria-hidden="true"></span>
			<h2
				id="overview-heading"
				class="flex items-center gap-2 text-2xl font-black tracking-tight uppercase sm:text-3xl"
			>
				<span class="text-[#B6251F]">01</span>
				<span class="text-[#202121]">/ OVERVIEW</span>
			</h2>
		</div>

		<div class="grid grid-cols-1 gap-6 lg:grid-cols-2">
			<!-- Welcome Back & Streak Card -->
			<div
				class="relative flex min-h-[220px] flex-col justify-between border-2 border-[#202121] bg-white p-6 sm:p-8"
			>
				<!-- Top Right Flame Corner Badge -->
				<div
					class="absolute top-0 right-0 flex h-12 w-12 items-center justify-center bg-[#B6251F] text-white"
					aria-label="Active Streak Badge"
				>
					<svg class="h-6 w-6 fill-current" viewBox="0 0 24 24">
						<path
							d="M12 23c-4.97 0-9-4.03-9-9 0-3.53 2.06-6.66 5.14-8.08C8.84 8.79 10.42 11 12 11c1.5 0 2.25-1.5 1.5-3.5 3.08 1.42 5.5 4.55 5.5 8.5 0 4.97-4.03 9-9 9z"
						></path>
					</svg>
				</div>

				<div>
					<h3 class="text-2xl font-extrabold tracking-tight text-[#202121] sm:text-3xl">
						Welcome back, {userName}.
					</h3>
					<p class="mt-2 max-w-md text-sm leading-relaxed font-medium text-stone-600 sm:text-base">
						Your focus is sharp. Continue your structural learning path today.
					</p>
				</div>

				<div class="mt-8 flex items-baseline gap-2.5">
					<span class="text-6xl leading-none font-black tracking-tight text-[#B6251F] sm:text-7xl">
						{data.streakDays ?? 14}
					</span>
					<span class="pb-1 text-xs font-black tracking-widest text-[#202121] uppercase">
						DAY STREAK
					</span>
				</div>
			</div>

			<!-- ACTIVE METRIC BOX (Double Border Style) -->
			<div class="border border-[#202121] bg-white p-1.5">
				<div class="flex h-full min-h-[208px] flex-col justify-between border border-[#202121] p-6">
					<div class="flex items-center justify-between border-b border-stone-200 pb-3">
						<span
							class="border-b-2 border-[#B6251F] pb-0.5 text-xs font-black tracking-widest text-[#B6251F] uppercase"
						>
							ACTIVE METRIC
						</span>
						<span class="font-mono text-[10px] tracking-wider text-stone-500 uppercase">
							WEEKLY CADENCE
						</span>
					</div>

					<!-- Minimalist brutalist metric chart -->
					<div class="py-4">
						<div class="grid h-20 grid-cols-7 items-end gap-2 pt-2">
							{#each [{ id: 'mon', day: 'M', h: '45%', active: false }, { id: 'tue', day: 'T', h: '65%', active: false }, { id: 'wed', day: 'W', h: '85%', active: false }, { id: 'thu', day: 'T', h: '50%', active: false }, { id: 'fri', day: 'F', h: '95%', active: true }, { id: 'sat', day: 'S', h: '70%', active: false }, { id: 'sun', day: 'S', h: '90%', active: true }] as item (item.id)}
								<div class="flex h-full flex-col items-center justify-end gap-1.5">
									<div
										class="w-full transition-all {item.active ? 'bg-[#B6251F]' : 'bg-[#202121]'}"
										style="height: {item.h};"
									></div>
									<span class="font-mono text-[10px] font-bold text-stone-600">{item.day}</span>
								</div>
							{/each}
						</div>
					</div>

					<div
						class="flex items-center justify-between border-t border-stone-100 pt-3 text-xs font-bold tracking-wider text-[#202121] uppercase"
					>
						<span>ACCURACY: <span class="text-[#B6251F]">94.2%</span></span>
						<span class="font-mono text-[11px] text-stone-500">180 / 180 PT</span>
					</div>
				</div>
			</div>
		</div>
	</section>

	<!-- FILTER BY LEVEL BAR -->
	<section aria-label="Filter quizzes by JLPT level" class="pt-4">
		<div class="mb-4 flex items-center gap-4">
			<span class="text-xs font-black tracking-widest whitespace-nowrap text-[#B6251F] uppercase">
				FILTER BY LEVEL:
			</span>
			<div class="flex-1 border-b border-stone-300" aria-hidden="true"></div>
		</div>

		<div class="flex flex-wrap items-center gap-2 sm:gap-2.5">
			{#each levels as level (level)}
				<button
					type="button"
					onclick={() => setLevel(level)}
					class="px-4 py-1.5 text-xs font-black tracking-widest uppercase transition-colors {selectedLevel ===
					level
						? 'border-2 border-[#B6251F] bg-[#B6251F] text-white'
						: 'border-2 border-[#202121] bg-white text-[#202121] hover:bg-stone-100'}"
				>
					{level}
				</button>
			{/each}
		</div>
	</section>

	<!-- 02 / FEATURED SETS SECTION -->
	<section aria-labelledby="featured-sets-heading" class="pt-4">
		<!-- Section Header Row -->
		<div class="mb-6 flex items-center justify-between border-b-2 border-[#202121] pb-3">
			<div class="flex items-center gap-2 sm:gap-3">
				<span class="inline-block bg-[#B6251F] px-2 py-0.5 text-sm font-black text-white">
					02
				</span>
				<h2
					id="featured-sets-heading"
					class="text-xl font-black tracking-tight text-[#202121] uppercase sm:text-2xl"
				>
					FEATURED SETS
				</h2>
				<span
					class="hidden text-xs font-bold tracking-widest text-stone-500 uppercase sm:inline sm:text-sm"
				>
					/ BANSHI SHEJI
				</span>
			</div>

			<!-- Brutalist Geometric Indicators -->
			<div class="flex items-center gap-1.5" aria-hidden="true">
				<span class="inline-block h-3.5 w-8 bg-[#B6251F]"></span>
				<span class="inline-block h-3.5 w-2.5 bg-[#202121]"></span>
				<span class="inline-block h-3.5 w-14 border border-[#202121] bg-transparent"></span>
			</div>
		</div>

		<!-- 3-Column Cards Grid -->
		{#if filteredCards.length > 0}
			<div class="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
				{#each filteredCards as card (card.id)}
					<article
						class="relative flex flex-col justify-between border-2 border-[#202121] bg-white p-6 transition-shadow hover:shadow-lg"
					>
						<!-- Decorative corner triangle for featured cards (e.g. Card 3) -->
						{#if card.cornerTriangle}
							<div
								class="pointer-events-none absolute top-0 right-0 h-0 w-0 border-t-[28px] border-r-[28px] border-b-[28px] border-l-[28px] border-t-[#B6251F] border-r-[#B6251F] border-b-transparent border-l-transparent"
								aria-hidden="true"
							></div>
						{/if}

						<div>
							<!-- Card Category & Icon Row -->
							<div class="mb-4 flex items-center justify-between">
								{#if card.categoryStyle === 'boxed'}
									<span
										class="border border-[#202121] px-2 py-0.5 text-[11px] font-bold tracking-widest text-[#202121] uppercase"
									>
										{card.category}
									</span>
								{:else}
									<span
										class="inline-block border-b border-[#202121] pb-0.5 text-xs font-bold tracking-widest text-[#202121] uppercase"
									>
										{card.category}
									</span>
								{/if}

								<!-- Icon corresponding to category -->
								<div class="text-[#B6251F]">
									{#if card.icon === 'book'}
										<svg
											class="h-5 w-5"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											viewBox="0 0 24 24"
										>
											<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
											<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"
											></path>
										</svg>
									{:else if card.icon === 'flask'}
										<svg
											class="h-5 w-5"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											viewBox="0 0 24 24"
										>
											<path
												d="M10 2v7.31L4.69 18.66A2 2 0 0 0 6.4 22h11.2a2 2 0 0 0 1.71-3.34L14 9.31V2"
											></path>
											<line x1="8.5" y1="2" x2="15.5" y2="2"></line>
											<line x1="7" y1="16" x2="17" y2="16"></line>
										</svg>
									{:else}
										<svg
											class="h-5 w-5 text-[#202121]"
											fill="none"
											stroke="currentColor"
											stroke-width="2"
											viewBox="0 0 24 24"
										>
											<rect x="3" y="3" width="18" height="18" rx="1"></rect>
											<line x1="3" y1="9" x2="21" y2="9"></line>
											<line x1="9" y1="21" x2="9" y2="9"></line>
										</svg>
									{/if}
								</div>
							</div>

							<!-- Card Title & Description -->
							<h3 class="mb-2 text-xl leading-snug font-black tracking-tight text-[#202121]">
								{card.title}
							</h3>
							<p
								class="line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-stone-600 sm:text-sm"
							>
								{card.description}
							</p>
						</div>

						<!-- Dotted Separator & Action Buttons -->
						<div class="mt-6">
							<div class="mb-5 border-b-2 border-dotted border-[#202121]" aria-hidden="true"></div>

							<div class="grid grid-cols-2 gap-3">
								<button
									type="button"
									class="flex cursor-pointer items-center justify-center bg-[#B6251F] px-3 py-2.5 text-center text-xs font-black tracking-wider text-white uppercase transition-colors hover:bg-[#9a1f1a]"
								>
									LEARN MODE
								</button>
								<button
									type="button"
									class="flex cursor-pointer items-center justify-center border-2 border-[#202121] px-3 py-2.5 text-center text-xs font-black tracking-wider text-[#202121] uppercase transition-colors hover:bg-[#202121] hover:text-white"
								>
									EXAM MODE
								</button>
							</div>
						</div>
					</article>
				{/each}
			</div>
		{:else}
			<div class="space-y-3 border-2 border-[#202121] bg-white p-10 text-center">
				<p class="text-lg font-black tracking-tight text-[#202121] uppercase">
					No quiz sets found for level {selectedLevel}
				</p>
				<p class="text-xs font-medium tracking-wider text-stone-500 uppercase">
					Try selecting <button
						onclick={() => setLevel('ALL LEVELS')}
						class="font-bold text-[#B6251F] underline">ALL LEVELS</button
					> or adjusting your search query.
				</p>
			</div>
		{/if}
	</section>
</div>
