<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/Badge.svelte';
	import { categoryLabel, RESULT_LABEL, RESULT_TONE } from '$lib/features/analytics/analytics';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const dateFormat = new Intl.DateTimeFormat('en-CA');

	/** Cycles through the same three accent colors the section order (vocab, grammar, listening) has always used. */
	const PROGRESS_COLORS = [
		{ colorClass: 'bg-brand-red', textClass: 'text-brand-red' },
		{ colorClass: 'bg-ink', textClass: 'text-ink' },
		{ colorClass: 'bg-stone-500', textClass: 'text-ink' }
	];
</script>

<svelte:head>
	<title>Analytics | QuizGame</title>
</svelte:head>

<div class="mx-auto pb-16">
	<!-- Header -->
	<div class="mb-12 border-b border-ink pb-6">
		<div class="flex flex-col justify-between md:flex-row md:items-end">
			<div class="flex items-center gap-4">
				<span class="h-10 w-1.5 bg-brand-red" aria-hidden="true"></span>
				<div class="flex flex-col">
					<span class="text-[10px] font-bold tracking-widest text-stone-500 uppercase"
						>Seiseki Bunseki</span
					>
					<h1 class="text-3xl font-black tracking-tight text-ink uppercase md:text-4xl">
						Performance
					</h1>
				</div>
			</div>
			<div class="mt-4 max-w-xs text-xs font-bold text-stone-500 md:mt-0 md:text-right">
				Data tracking and analytical breakdown of recent learning cycles.
			</div>
		</div>
	</div>

	<!-- Top Grid Section -->
	<div class="mb-20 grid grid-cols-1 gap-12 lg:grid-cols-[1.5fr_1fr]">
		<!-- Weekly Progress -->
		<div>
			<div class="mb-4 flex items-center justify-between border-b border-ink pb-2">
				<div class="flex items-center gap-2">
					<div class="bg-brand-red px-2 py-0.5">
						<span class="text-[10px] font-bold tracking-widest text-white uppercase">Progress</span>
					</div>
					<h2 class="text-lg font-black text-ink uppercase">Weekly Progress</h2>
				</div>
			</div>

			<div class="border border-ink bg-stone-50 p-6 md:p-8">
				{#each data.overview.weeklyPerformance as item, i (item.category)}
					<div class="mb-6 last:mb-0">
						<div class="mb-2 flex justify-between font-bold">
							<span class="text-sm text-ink">{item.label}</span>
							<span class="text-sm {PROGRESS_COLORS[i].textClass}">
								{item.percentage === null ? 'No data' : `${item.percentage}%`}
							</span>
						</div>
						<div class="h-2 w-full bg-stone-200">
							<div
								class="h-full {PROGRESS_COLORS[i].colorClass}"
								style="width: {item.percentage ?? 0}%"
							></div>
						</div>
					</div>
				{/each}
			</div>
		</div>

		<!-- Kanji Mastery -->
		<div>
			<div class="mb-4 flex items-center justify-between border-b border-ink pb-2">
				<h2 class="text-lg font-black text-ink uppercase">Kanji Mastery</h2>
				<div class="bg-ink px-2 py-0.5">
					<span class="text-[10px] font-bold tracking-widest text-white uppercase">Stats</span>
				</div>
			</div>

			<div
				class="flex h-[calc(100%-2.5rem)] flex-col items-center justify-center gap-2 border border-ink bg-stone-50 p-6 text-center md:p-8"
			>
				<p class="text-sm font-bold text-stone-500 uppercase">Kanji tracking coming soon</p>
				{#if data.overview.kanjiMastery.target.level}
					<p class="text-xs font-bold text-stone-400 uppercase">
						Target level: {data.overview.kanjiMastery.target.level}
					</p>
				{/if}
			</div>
		</div>
	</div>

	<!-- Exam Scores Table -->
	<div>
		<div class="mb-6 flex items-end justify-between border-b border-line pb-2">
			<div class="flex items-center gap-3">
				<div class="h-6 w-1.5 bg-brand-red"></div>
				<h2 class="text-2xl font-black tracking-tight text-ink uppercase">Exam Scores</h2>
			</div>
			<a
				href={resolve('/analytics/exams')}
				class="border-b border-ink pb-0.5 text-[10px] font-bold tracking-widest text-stone-500 uppercase transition-colors hover:text-ink"
			>
				View All Exams
			</a>
		</div>

		{#if data.overview.recentExams.length === 0}
			<p
				class="w-full border-2 border-ink bg-white p-8 text-center text-sm font-bold text-stone-500 uppercase"
			>
				No exams completed yet.
			</p>
		{:else}
			<div class="w-full overflow-x-auto border-2 border-ink bg-white">
				<table class="w-full min-w-[700px] text-left">
					<thead class="bg-stone-50">
						<tr>
							<th
								class="border-b border-ink px-6 py-4 text-[10px] font-bold tracking-widest text-stone-500 uppercase"
								>Date</th
							>
							<th
								class="border-b border-ink px-6 py-4 text-[10px] font-bold tracking-widest text-stone-500 uppercase"
								>Exam Name</th
							>
							<th
								class="border-b border-ink px-6 py-4 text-[10px] font-bold tracking-widest text-stone-500 uppercase"
								>Category</th
							>
							<th
								class="border-b border-ink px-6 py-4 text-right text-[10px] font-bold tracking-widest text-stone-500 uppercase"
								>Score</th
							>
							<th
								class="border-b border-ink px-6 py-4 text-center text-[10px] font-bold tracking-widest text-stone-500 uppercase"
								>Status</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-line">
						{#each data.overview.recentExams as exam (exam.attemptId)}
							<tr>
								<td class="px-6 py-5 text-sm font-bold tracking-wider text-ink">
									{dateFormat.format(new Date(exam.completedAt))}
								</td>
								<td class="px-6 py-5 text-sm text-ink">
									<a
										href={resolve('/(main)/quiz/attempt/[publicId]/result', {
											publicId: exam.attemptId
										})}
										class="hover:text-brand-red hover:underline"
									>
										{exam.title}
									</a>
								</td>
								<td class="px-6 py-5">
									<span class="border border-line px-2 py-1 text-[10px] text-stone-600"
										>{categoryLabel(exam.category)}</span
									>
								</td>
								<td class="px-6 py-5 text-right font-bold">
									<span class="text-2xl text-ink">{exam.score.earned}</span>
									<span class="text-sm text-stone-500">/{exam.score.maximum}</span>
								</td>
								<td class="px-6 py-5 text-center">
									<Badge tone={RESULT_TONE[exam.result]}>{RESULT_LABEL[exam.result]}</Badge>
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	</div>
</div>
