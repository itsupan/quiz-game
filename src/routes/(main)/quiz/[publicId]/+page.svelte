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
		<table class="mt-2 w-full">
			<thead>
				<tr>
					<th scope="col" class="text-left">Section</th>
					<th scope="col" class="text-left">Questions</th>
					<th scope="col" class="text-left">Time limit</th>
				</tr>
			</thead>
			<tbody>
				{#each data.quiz.sections as section (section.position)}
					<tr>
						<th scope="row" class="text-left font-normal">{section.section}</th>
						<td>{section.questionCount}</td>
						<td
							>{section.timeLimitSeconds === null
								? '—'
								: `${minutes(section.timeLimitSeconds)} min`}</td
						>
					</tr>
				{/each}
			</tbody>
		</table>

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
