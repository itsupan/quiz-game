<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/Badge.svelte';
	import { toast } from '$lib/components/toast-store.svelte';
	import {
		categoryLabel,
		EXAM_RESULTS,
		RESULT_LABEL,
		RESULT_TONE
	} from '$lib/features/analytics/analytics';
	import type { ExamAttemptSummary } from '$lib/features/analytics/analytics';
	import { JLPT_LEVELS } from '$lib/domain/enums';
	import { readApiResponse } from '$lib/features/quiz/api/client';
	import type { ApiPage } from '$lib/features/quiz/api/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const dateFormat = new Intl.DateTimeFormat('en-CA');

	let exams = $state<ExamAttemptSummary[]>([]);
	let nextCursor = $state<string | null>(null);
	let loadingMore = $state(false);

	/** Resyncs the locally-appended list whenever a filter change reruns the load. */
	$effect(() => {
		exams = data.exams;
		nextCursor = data.nextCursor;
	});

	function filterQuery(level: string | null, result: string | null): string {
		return new URLSearchParams({
			...(level ? { level } : {}),
			...(result ? { result } : {})
		}).toString();
	}

	async function loadMore(): Promise<void> {
		if (nextCursor === null || loadingMore) return;

		loadingMore = true;
		try {
			const query = new URLSearchParams({
				cursor: nextCursor,
				...(data.level ? { level: data.level } : {}),
				...(data.result ? { result: data.result } : {})
			});

			const page = await readApiResponse<ApiPage<ExamAttemptSummary[]>>(
				fetch(`/api/v1/me/exam-attempts?${query}`)
			);
			exams = [...exams, ...page.data];
			nextCursor = page.page.nextCursor;
		} catch {
			toast.error('Could not load more exams.');
		} finally {
			loadingMore = false;
		}
	}
</script>

<svelte:head>
	<title>Exam History | QuizGame</title>
</svelte:head>

<div class="space-y-6 pb-16">
	<div class="flex items-center gap-3">
		<span class="h-8 w-1.5 bg-brand-red" aria-hidden="true"></span>
		<h1 class="text-2xl font-black tracking-tight text-ink uppercase">Exam History</h1>
	</div>

	<div>
		<p class="mb-2 text-[10px] font-bold tracking-widest text-stone-500 uppercase">
			Filter by level
		</p>
		<div class="flex flex-wrap gap-2">
			<a
				href={resolve(`/analytics/exams?${filterQuery(null, data.result)}`)}
				class="border-2 px-4 py-1.5 text-xs font-black tracking-widest uppercase {data.level ===
				null
					? 'border-ink bg-brand-red text-white'
					: 'border-ink bg-white text-ink hover:bg-stone-100'}"
			>
				All Levels
			</a>
			{#each JLPT_LEVELS as level (level)}
				<a
					href={resolve(`/analytics/exams?${filterQuery(level, data.result)}`)}
					class="border-2 px-4 py-1.5 text-xs font-black tracking-widest uppercase {data.level ===
					level
						? 'border-ink bg-brand-red text-white'
						: 'border-ink bg-white text-ink hover:bg-stone-100'}"
				>
					{level}
				</a>
			{/each}
		</div>
	</div>

	<div>
		<p class="mb-2 text-[10px] font-bold tracking-widest text-stone-500 uppercase">
			Filter by result
		</p>
		<div class="flex flex-wrap gap-2">
			<a
				href={resolve(`/analytics/exams?${filterQuery(data.level, null)}`)}
				class="border-2 px-4 py-1.5 text-xs font-black tracking-widest uppercase {data.result ===
				null
					? 'border-ink bg-brand-red text-white'
					: 'border-ink bg-white text-ink hover:bg-stone-100'}"
			>
				All Results
			</a>
			{#each EXAM_RESULTS as result (result)}
				<a
					href={resolve(`/analytics/exams?${filterQuery(data.level, result)}`)}
					class="border-2 px-4 py-1.5 text-xs font-black tracking-widest uppercase {data.result ===
					result
						? 'border-ink bg-brand-red text-white'
						: 'border-ink bg-white text-ink hover:bg-stone-100'}"
				>
					{RESULT_LABEL[result]}
				</a>
			{/each}
		</div>
	</div>

	{#if exams.length === 0}
		<p
			class="w-full border-2 border-ink bg-white p-8 text-center text-sm font-bold text-stone-500 uppercase"
		>
			No exams match these filters.
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
					{#each exams as exam (exam.attemptId)}
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
	{/if}
</div>
