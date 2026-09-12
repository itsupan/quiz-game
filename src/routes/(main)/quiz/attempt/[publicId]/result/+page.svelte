<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import QuestionMedia from '$lib/features/quiz/QuestionMedia.svelte';
	import OptionList from '$lib/features/quiz/OptionList.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const result = $derived(data.result);
	const attempt = $derived(result.attempt);
	const quiz = $derived(result.quiz);
	const bandScores = $derived(result.bandScores);
	const questions = $derived(result.questions);
	const incorrect = $derived(questions.filter((question) => !question.isCorrect));
</script>

<svelte:head>
	<title>Result — {quiz.title} | QuizGame</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<span class="h-8 w-1.5 bg-brand-red" aria-hidden="true"></span>
		<h1 class="text-2xl font-black tracking-tight text-ink uppercase">{quiz.title}</h1>
	</div>

	<Card raised class="p-6">
		<div class="mb-4 flex flex-wrap gap-2">
			<Badge>{quiz.mode}</Badge>
			<Badge>{quiz.level}</Badge>
			<Badge tone={attempt.status === 'EXPIRED' ? 'warning' : 'neutral'}>
				{attempt.status === 'EXPIRED' ? 'Time ran out' : 'Submitted'}
			</Badge>
			{#if attempt.passed !== null}
				<Badge tone={attempt.passed ? 'success' : 'danger'}>
					{attempt.passed ? 'Pass' : 'Fail'}
				</Badge>
			{/if}
		</div>

		<p class="text-lg font-bold text-ink">
			{attempt.rawScore} / {attempt.rawMax} correct ({attempt.correctCount} of {attempt.questionCount})
		</p>

		{#if attempt.scaledTotal !== null}
			<p class="text-sm text-muted">
				Scaled score: {attempt.scaledTotal}
				{#if quiz.scaledTotalMax !== null}/ {quiz.scaledTotalMax}{/if} — an estimate, not an official
				JLPT result.
			</p>
		{/if}

		{#if bandScores.length > 0}
			<table class="mt-4 w-full">
				<thead>
					<tr>
						<th scope="col" class="text-left">Band</th>
						<th scope="col" class="text-left">Score</th>
						<th scope="col" class="text-left">Pass mark</th>
					</tr>
				</thead>
				<tbody>
					{#each bandScores as band (band.bandCode)}
						<tr>
							<th scope="row" class="text-left font-normal">{band.label}</th>
							<td>{band.scaledScore} / {band.scaledMax}</td>
							<td>
								{#if band.passMark !== null}
									{band.passMark}
									{band.passed ? '✓' : '✗'}
								{:else}
									—
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>
			<p class="mt-2 text-xs text-muted">
				Scaled scores are a linear estimate of official JLPT scaling, which is item-response-theory
				based and unpublished. Treat this as a study estimate, not an exam result.
			</p>
		{/if}
	</Card>

	{#if incorrect.length > 0}
		<h2 class="text-lg font-black tracking-tight uppercase">Review</h2>
		<p class="m-0 text-sm text-muted">
			{incorrect.length} question{incorrect.length === 1 ? '' : 's'} to look back on.
		</p>

		{#each incorrect as question (question.attemptQuestionId)}
			<Card class="p-6">
				<p class="mb-3 text-xs font-bold tracking-widest text-muted uppercase">
					{question.section} · {question.points} pt{question.points === 1 ? '' : 's'}
				</p>

				<QuestionMedia image={question.image} audio={question.audio} revealTranscript />

				<p class="mb-4 text-lg font-medium text-ink">{question.stem}</p>

				<OptionList
					name="reviewOption"
					options={question.options}
					selectedOptionId={question.correctOptionId}
					disabled
				/>

				{#if question.selectedOptionId === null}
					<Notice tone="warning">You left this one unanswered.</Notice>
				{:else if !question.isCorrect}
					<Notice tone="danger">
						You chose {question.options.find((option) => option.id === question.selectedOptionId)
							?.body}.
					</Notice>
				{/if}

				{#if question.explanation}
					<p class="mt-3 text-sm text-stone-600">{question.explanation}</p>
				{/if}
			</Card>
		{/each}
	{:else}
		<Notice tone="success">Every question was answered correctly.</Notice>
	{/if}

	<Button href={resolve('/home')} variant="ghost">Back to Dashboard</Button>
</div>
