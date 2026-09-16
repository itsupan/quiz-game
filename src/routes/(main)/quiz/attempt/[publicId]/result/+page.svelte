<script lang="ts">
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import QuestionBody from '$lib/features/quiz/QuestionBody.svelte';
	import QuestionContextPanel from '$lib/features/quiz/QuestionContextPanel.svelte';
	import CelebrationOverlay from '$lib/features/quiz/result/CelebrationOverlay.svelte';
	import ScoreCountUp from '$lib/features/quiz/result/ScoreCountUp.svelte';
	import { isPracticeMode } from '$lib/features/quiz/modes';
	import { computeLevel } from '$lib/features/leaderboard/leaderboard';
	import { stimulusFor, type ResultQuestion } from '$lib/features/quiz/api/types';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const result = $derived(data.result);
	const attempt = $derived(result.attempt);
	const quiz = $derived(result.quiz);
	const bandScores = $derived(result.bandScores);
	const questions = $derived(result.questions);
	const incorrectCount = $derived(questions.filter((question) => !question.isCorrect).length);

	const isPractice = $derived(isPracticeMode(quiz.mode));
	const summary = $derived(result.summary);
	const reward = $derived(result.reward);

	/**
	 * Whether this sitting crossed a level boundary.
	 *
	 * Derived from lifetime XP rather than stored: subtracting what this attempt awarded gives
	 * the total before it, so the answer is the same whenever the page is opened.
	 */
	const levelAfter = $derived(computeLevel(data.lifetimeXp));
	const levelBefore = $derived(computeLevel(data.lifetimeXp - reward.xpAwarded));
	const leveledUp = $derived(levelAfter > levelBefore);

	const celebrating = $derived(isPractice && attempt.status === 'SUBMITTED');

	function formatDuration(ms: number | null): string {
		if (ms === null) return '—';

		const totalSeconds = Math.round(ms / 1000);
		return `${Math.floor(totalSeconds / 60)}:${String(totalSeconds % 60).padStart(2, '0')}`;
	}

	let filter = $state<'all' | 'incorrect'>('all');
	const visibleQuestions = $derived(
		filter === 'all' ? questions : questions.filter((question) => !question.isCorrect)
	);

	const statusLabels = {
		correct: 'Correct',
		unanswered: 'Unanswered',
		incorrect: 'Incorrect'
	} as const;

	function statusOf(question: ResultQuestion): keyof typeof statusLabels {
		if (question.isCorrect) return 'correct';
		return question.selectedOptionNumber === null ? 'unanswered' : 'incorrect';
	}
</script>

{#snippet statusBadge(question: ResultQuestion)}
	{@const status = statusOf(question)}
	<div
		class="flex items-center justify-between border-b border-line px-6 py-3 {status === 'correct'
			? 'bg-success-soft'
			: status === 'unanswered'
				? 'bg-warning-soft'
				: 'bg-danger-soft'}"
	>
		<span
			class="flex items-center gap-2 text-xs font-black tracking-widest uppercase {status ===
			'correct'
				? 'text-success'
				: status === 'unanswered'
					? 'text-warning'
					: 'text-danger'}"
		>
			<i
				class="fi {status === 'correct'
					? 'fi-rs-check-circle'
					: status === 'unanswered'
						? 'fi-rs-exclamation'
						: 'fi-rs-circle-xmark'}"
				aria-hidden="true"
			></i>
			{statusLabels[status]}
		</span>
		<span class="text-xs font-bold text-stone-500">
			{question.points} pt{question.points === 1 ? '' : 's'}
		</span>
	</div>
{/snippet}

{#snippet reviewFeedback(question: ResultQuestion)}
	{#if question.selectedOptionNumber === null}
		<Notice tone="warning">You left this one unanswered.</Notice>
	{:else if !question.isCorrect}
		<Notice tone="danger">
			You chose {question.options.find((option) => option.number === question.selectedOptionNumber)
				?.body}.
		</Notice>
	{/if}

	{#if question.explanation}
		<p class="mt-3 text-sm text-stone-600">{question.explanation}</p>
	{/if}
{/snippet}

<svelte:head>
	<title>Result — {quiz.title} | QuizGame</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<span class="h-8 w-1.5 bg-brand-red" aria-hidden="true"></span>
		<h1 class="text-2xl font-black tracking-tight text-ink uppercase">{quiz.title}</h1>
	</div>

	<Card raised class="p-6 sm:p-8">
		<div class="mb-6 flex flex-wrap items-center justify-between gap-4">
			<div class="flex flex-wrap gap-2">
				<Badge>{quiz.mode}</Badge>
				<Badge>{quiz.level}</Badge>
				<Badge tone={attempt.status === 'EXPIRED' ? 'warning' : 'neutral'}>
					{attempt.status === 'EXPIRED' ? 'Time ran out' : 'Submitted'}
				</Badge>
			</div>
			{#if attempt.passed !== null}
				<span
					class="border-2 px-3 py-1 text-xs font-black tracking-widest uppercase {attempt.passed
						? 'border-success bg-success-soft text-success'
						: 'border-danger bg-danger-soft text-danger'}"
				>
					{attempt.passed ? 'Pass' : 'Fail'}
				</span>
			{/if}
		</div>

		<div
			class="flex flex-col gap-6 border-t border-line pt-6 sm:flex-row sm:items-end sm:justify-between"
		>
			<div>
				<p class="text-[10px] font-bold tracking-widest text-stone-500 uppercase">Score</p>
				<p class="mt-1 flex items-baseline gap-2">
					<span class="text-5xl font-black text-ink">
						{#if isPractice && attempt.rawScore !== null}
							<ScoreCountUp value={attempt.rawScore} />
						{:else}
							{attempt.rawScore}
						{/if}
					</span>
					<span class="text-lg font-bold text-stone-400">/ {attempt.rawMax}</span>
				</p>
				<p class="mt-1 text-sm text-stone-500">
					{attempt.correctCount} of {attempt.questionCount} correct
				</p>
			</div>

			{#if attempt.scaledTotal !== null}
				<div class="sm:text-right">
					<p class="text-[10px] font-bold tracking-widest text-stone-500 uppercase">
						Scaled estimate
					</p>
					<p class="mt-1 text-2xl font-black text-brand-red">
						{attempt.scaledTotal}{#if quiz.scaledTotalMax !== null}<span
								class="text-base text-stone-400"
							>
								/ {quiz.scaledTotalMax}</span
							>{/if}
					</p>
					<p class="mt-1 max-w-xs text-xs text-stone-400">Not an official JLPT result.</p>
				</div>
			{/if}
		</div>

		<!--
			Accuracy, time and XP were already in the result payload and simply never rendered.
			They are neutral facts, so every mode gets them; only the streak and the speed
			bonus are practice-only, because only practice has them.
		-->
		<dl class="mt-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
			{#snippet stat(label: string, value: string, accent = false)}
				<div class="border-2 border-ink bg-white p-3 shadow-hard">
					<dt class="text-[10px] font-bold tracking-widest text-stone-500 uppercase">{label}</dt>
					<dd class="mt-1 font-mono text-xl font-black {accent ? 'text-brand-red' : 'text-ink'}">
						{value}
					</dd>
				</div>
			{/snippet}

			{@render stat('Accuracy', `${summary.accuracyPercent}%`)}
			{@render stat('Time', formatDuration(summary.durationMs))}
			{@render stat('XP earned', `+${reward.xpAwarded}`, reward.xpAwarded > 0)}
			{#if isPractice}
				{@render stat('Best streak', String(summary.bestCombo), summary.bestCombo >= 3)}
			{:else}
				{@render stat('Unanswered', String(summary.unansweredCount))}
			{/if}
		</dl>

		{#if isPractice && reward.bonusXp > 0}
			<p class="mt-3 text-xs font-bold tracking-wider text-stone-500 uppercase">
				Includes +{reward.bonusXp} speed bonus — practice only, and never part of your scaled score.
			</p>
		{/if}

		{#if celebrating && leveledUp}
			<p
				class="mt-6 inline-flex items-center gap-2 border-2 border-brand-red bg-brand-red px-4 py-2 text-sm font-black tracking-widest text-white uppercase shadow-hard"
			>
				<i class="fi fi-rs-trophy" aria-hidden="true"></i>
				Level {levelAfter} reached
			</p>
		{/if}

		{#if bandScores.length > 0}
			<div class="mt-8 overflow-x-auto border-2 border-ink bg-white">
				<table class="w-full min-w-105 text-left">
					<thead class="bg-stone-50">
						<tr>
							<th
								class="border-b border-ink px-4 py-3 text-[10px] font-bold tracking-widest text-stone-500 uppercase"
								>Band</th
							>
							<th
								class="border-b border-ink px-4 py-3 text-[10px] font-bold tracking-widest text-stone-500 uppercase"
								>Score</th
							>
							<th
								class="border-b border-ink px-4 py-3 text-[10px] font-bold tracking-widest text-stone-500 uppercase"
								>Pass mark</th
							>
						</tr>
					</thead>
					<tbody class="divide-y divide-line">
						{#each bandScores as band (band.bandCode)}
							<tr>
								<td class="px-4 py-3 text-sm font-bold text-ink">{band.label}</td>
								<td class="px-4 py-3 text-sm text-ink">{band.scaledScore} / {band.scaledMax}</td>
								<td class="px-4 py-3 text-sm">
									{#if band.passMark !== null}
										<span class={band.passed ? 'text-success' : 'text-danger'}>
											{band.passMark}
											{band.passed ? '✓' : '✗'}
										</span>
									{:else}
										<span class="text-stone-400">—</span>
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
			<p class="mt-3 text-xs text-stone-400">
				Scaled scores are a linear estimate of official JLPT scaling, which is item-response-theory
				based and unpublished. Treat this as a study estimate, not an exam result.
			</p>
		{/if}
	</Card>

	<div class="mt-2 flex flex-wrap items-center justify-between gap-4">
		<div class="flex items-center gap-3">
			<span class="h-6 w-1.5 bg-brand-red" aria-hidden="true"></span>
			<h2 class="text-lg font-black tracking-tight text-ink uppercase">Review</h2>
		</div>

		<div class="flex border-2 border-ink" role="group" aria-label="Filter review by result">
			<button
				type="button"
				onclick={() => (filter = 'all')}
				aria-pressed={filter === 'all'}
				class="px-3 py-1.5 text-xs font-black tracking-widest uppercase transition-colors {filter ===
				'all'
					? 'bg-brand-red text-white'
					: 'bg-white text-ink hover:bg-stone-50'}"
			>
				All
			</button>
			<button
				type="button"
				onclick={() => (filter = 'incorrect')}
				aria-pressed={filter === 'incorrect'}
				class="border-l-2 border-ink px-3 py-1.5 text-xs font-black tracking-widest uppercase transition-colors {filter ===
				'incorrect'
					? 'bg-brand-red text-white'
					: 'bg-white text-ink hover:bg-stone-50'}"
			>
				Incorrect only
			</button>
		</div>
	</div>

	<p class="text-sm text-muted">
		{questions.length} question{questions.length === 1 ? '' : 's'} · {incorrectCount} incorrect
	</p>

	{#if visibleQuestions.length > 0}
		<div class="flex flex-col gap-6">
			{#each visibleQuestions as question (question.number)}
				<Card>
					{@render statusBadge(question)}

					{@const stimulus = stimulusFor(question)}
					{#if stimulus}
						<div class="grid grid-cols-1 lg:grid-cols-2">
							<div class="border-b border-line bg-stone-50 p-6 lg:border-r lg:border-b-0">
								<QuestionContextPanel group={stimulus} revealStudyAids={true} />
							</div>
							<div class="p-6">
								<QuestionBody
									{question}
									revealStudyAids={true}
									name="reviewOption-{question.number}"
									selectedOptionId={question.selectedOptionNumber}
									correctOptionNumber={question.correctOptionNumber}
									disabled
								/>
								<div class="mt-4">
									{@render reviewFeedback(question)}
								</div>
							</div>
						</div>
					{:else}
						<div class="p-6">
							<QuestionBody
								{question}
								revealStudyAids={true}
								name="reviewOption-{question.number}"
								selectedOptionId={question.selectedOptionNumber}
								correctOptionNumber={question.correctOptionNumber}
								disabled
							/>
							<div class="mt-4">
								{@render reviewFeedback(question)}
							</div>
						</div>
					{/if}
				</Card>
			{/each}
		</div>
	{:else}
		<Notice tone="success">Every question was answered correctly.</Notice>
	{/if}

	<!--
		A finished run used to be a dead end. The retry goes to the quiz brief, which owns the
		start action and its idempotency key, rather than re-posting one from here.
	-->
	<div class="flex flex-wrap items-center gap-3">
		{#if isPractice}
			<Button href={resolve(`/quiz/${quiz.id}`)}>Run it back</Button>
			<Button href={resolve('/leaderboard')} variant="secondary">See leaderboard</Button>
			<Button href={resolve('/home')} variant="ghost">Back to Dashboard</Button>
		{:else}
			<Button href={resolve('/home')}>Back to Dashboard</Button>
		{/if}
	</div>
</div>

{#if celebrating}
	<CelebrationOverlay />
{/if}
