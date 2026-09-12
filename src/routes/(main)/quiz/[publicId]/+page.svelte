<script lang="ts">
	import { enhance } from '$app/forms';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	function minutes(seconds: number | null) {
		return seconds === null ? null : Math.round(seconds / 60);
	}

	const totalMinutes = $derived(minutes(data.quiz.timeLimitSeconds));
	const totalQuestions = $derived(
		data.quiz.sections.reduce((sum, section) => sum + section.questionCount, 0)
	);
</script>

<svelte:head>
	<title>{data.quiz.title} | QuizGame</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<span class="h-8 w-1.5 bg-brand-red" aria-hidden="true"></span>
		<h1 class="text-2xl font-black tracking-tight text-ink uppercase">{data.quiz.title}</h1>
	</div>

	{#if form?.message}
		<Notice tone="danger" alert>{form.message}</Notice>
	{/if}

	<Card raised class="p-6">
		<div class="mb-4 flex flex-wrap gap-2">
			<Badge>{data.quiz.mode}</Badge>
			<Badge>{data.quiz.level}</Badge>
			{#if totalMinutes !== null}
				<Badge>{totalMinutes} min</Badge>
			{:else}
				<Badge>Untimed</Badge>
			{/if}
		</div>

		{#if data.quiz.description}
			<p class="text-stone-600">{data.quiz.description}</p>
		{/if}

		<h2 class="mt-6 text-sm font-bold tracking-widest uppercase">Sections</h2>
		<div class="mt-2 overflow-x-auto border-2 border-ink bg-white">
			<table class="w-full min-w-[420px] text-left">
				<thead class="bg-stone-50">
					<tr>
						<th
							scope="col"
							class="border-b border-ink px-4 py-3 text-[10px] font-bold tracking-widest text-stone-500 uppercase"
							>Section</th
						>
						<th
							scope="col"
							class="border-b border-ink px-4 py-3 text-[10px] font-bold tracking-widest text-stone-500 uppercase"
							>Questions</th
						>
						<th
							scope="col"
							class="border-b border-ink px-4 py-3 text-[10px] font-bold tracking-widest text-stone-500 uppercase"
							>Time limit</th
						>
					</tr>
				</thead>
				<tbody class="divide-y divide-line">
					{#each data.quiz.sections as section (section.position)}
						<tr>
							<th scope="row" class="px-4 py-3 text-sm font-bold text-ink">
								{section.section.replace('_', ' ')}
							</th>
							<td class="px-4 py-3 text-sm text-ink">{section.questionCount}</td>
							<td class="px-4 py-3 text-sm text-ink">
								{section.timeLimitSeconds === null
									? '—'
									: `${minutes(section.timeLimitSeconds)} min`}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
		</div>

		<p class="mt-4 text-sm text-muted">
			{totalQuestions} question{totalQuestions === 1 ? '' : 's'} total.
		</p>

		{#if totalMinutes !== null}
			<Notice tone="info">
				The clock starts the moment you begin and cannot be paused. Closing this tab does not stop
				it — every answer is saved as you choose it, and whatever you have answered when time runs
				out is scored.
			</Notice>
		{/if}

		<form method="POST" action="?/start" use:enhance class="mt-6">
			<Button type="submit" size="lg">Start</Button>
		</form>
	</Card>
</div>
