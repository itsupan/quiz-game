<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import Countdown from '$lib/features/quiz/Countdown.svelte';
	import QuestionBody from '$lib/features/quiz/QuestionBody.svelte';
	import QuestionContextPanel from '$lib/features/quiz/QuestionContextPanel.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** Whichever media is actually driving the readiness gate — the group's, or the question's own. */
	const gatingAudio = $derived(data.question.group?.audio ?? data.question.audio);

	/**
	 * Listening choices start disabled in SSR as well as in the browser. The media
	 * component opens them only after `canplay`, so slow and broken audio cannot be skipped
	 * merely by submitting the server-rendered form before hydration.
	 */
	// eslint-disable-next-line svelte/prefer-writable-derived
	let optionsDisabled = $state(untrack(() => gatingAudio !== null));

	$effect(() => {
		optionsDisabled = gatingAudio !== null;
	});

	function onaudioready() {
		optionsDisabled = false;
	}

	let submitFormEl: HTMLFormElement | undefined = $state();
	let advanceFormEl: HTMLFormElement | undefined = $state();

	/**
	 * `requestSubmit()` with no argument fires the form's own submit event directly,
	 * which skips `ConfirmSubmit`'s button-click handler entirely — exactly what an
	 * automatic expiry submit needs. If this never runs at all (the tab is gone, the
	 * network is down), `enforceDeadline` settles the same clock the next time anyone
	 * loads this attempt or its result.
	 */
	function onexpire() {
		if (data.deadlineKind === 'section') {
			advanceFormEl?.requestSubmit();
		} else {
			submitFormEl?.requestSubmit();
		}
	}
</script>

<svelte:head>
	<title>{data.quiz.title} | QuizGame</title>
</svelte:head>

<div class="space-y-6">
	<div class="flex items-center gap-3">
		<span class="h-8 w-1.5 bg-brand-red" aria-hidden="true"></span>
		<h1 class="text-2xl font-black tracking-tight text-ink uppercase">{data.quiz.title}</h1>
	</div>

	<!--
		Docked just under AppShell's own sticky header (h-16), so the clock and progress
		stay visible while scrolling a long passage — the one piece of exam chrome that
		earns being sticky.
	-->
	<div
		class="sticky top-16 z-20 flex flex-wrap items-center justify-between gap-4 border-2 border-ink bg-white px-4 py-3 shadow-hard"
	>
		<div class="flex items-center gap-3">
			<Badge>{data.question.section.replace('_', ' ')}</Badge>
			<span class="text-xs font-bold text-stone-500">
				Question {data.index} of {data.total} · {data.answeredCount} answered
			</span>
		</div>

		<div class="flex items-center gap-6">
			<div class="hidden items-center gap-3 sm:flex">
				<div class="h-1.5 w-24 bg-stone-200 lg:w-32">
					<div
						class="h-full bg-brand-red transition-all duration-300"
						style="width: {(data.index / data.total) * 100}%"
					></div>
				</div>
			</div>

			{#if data.deadline}
				<Countdown deadline={new Date(data.deadline)} {onexpire} />
			{/if}
		</div>
	</div>

	{#if form?.message}
		<Notice tone="danger" alert>{form.message}</Notice>
	{/if}

	<Card raised>
		<!--
			A reading passage or a listening clip earns a shared context panel — the material
			is genuinely separate from the question. A concept-review group is a worked
			explanation of the grammar point the question is testing, and showing it during a
			live attempt would just hand over the answer; it stays for the result page's
			review instead, once the attempt is no longer live.
		-->
		{#if data.question.group && data.question.group.format !== 'CONCEPT_REVIEW'}
			<div class="grid grid-cols-1 lg:grid-cols-2">
				<div class="border-b border-line bg-stone-50 p-6 lg:border-r lg:border-b-0 lg:p-8">
					<QuestionContextPanel
						group={data.question.group}
						revealStudyAids={data.revealStudyAids}
						{onaudioready}
					/>
				</div>

				<div class="p-6 lg:p-8">
					<form method="POST" action="?/answer" use:enhance class="flex flex-col gap-8">
						<input type="hidden" name="attemptQuestionId" value={data.question.attemptQuestionId} />

						<QuestionBody
							question={data.question}
							revealStudyAids={data.revealStudyAids}
							name="selectedOptionId"
							selectedOptionId={data.question.selectedOptionId}
							disabled={optionsDisabled}
							showSectionBadge={false}
						/>

						<div class="flex items-center justify-between border-t border-line pt-6">
							{#if data.index > 1}
								<Button
									type="submit"
									name="nextIndex"
									value={String(data.index - 1)}
									variant="secondary"
								>
									&larr; Prev
								</Button>
							{:else}
								<span></span>
							{/if}

							<Button
								type="submit"
								name="nextIndex"
								value={String(data.index)}
								variant="secondary"
								size="sm"
								disabled={optionsDisabled}
							>
								Save answer
							</Button>

							<Button
								type="submit"
								name="nextIndex"
								value={String(data.index < data.total ? data.index + 1 : data.index)}
								disabled={optionsDisabled}
							>
								{data.index < data.total ? 'Next →' : 'Save →'}
							</Button>
						</div>
					</form>
				</div>
			</div>
		{:else}
			<div class="p-6 lg:p-8">
				<form method="POST" action="?/answer" use:enhance class="flex flex-col gap-8">
					<input type="hidden" name="attemptQuestionId" value={data.question.attemptQuestionId} />

					<QuestionBody
						question={data.question}
						revealStudyAids={data.revealStudyAids}
						name="selectedOptionId"
						selectedOptionId={data.question.selectedOptionId}
						disabled={optionsDisabled}
						showSectionBadge={false}
						{onaudioready}
					/>

					<div class="flex items-center justify-between border-t border-line pt-6">
						{#if data.index > 1}
							<Button
								type="submit"
								name="nextIndex"
								value={String(data.index - 1)}
								variant="secondary"
							>
								&larr; Prev
							</Button>
						{:else}
							<span></span>
						{/if}

						<Button
							type="submit"
							name="nextIndex"
							value={String(data.index)}
							variant="secondary"
							size="sm"
							disabled={optionsDisabled}
						>
							Save answer
						</Button>

						<Button
							type="submit"
							name="nextIndex"
							value={String(data.index < data.total ? data.index + 1 : data.index)}
							disabled={optionsDisabled}
						>
							{data.index < data.total ? 'Next →' : 'Save →'}
						</Button>
					</div>
				</form>
			</div>
		{/if}
	</Card>

	<div class="flex flex-col items-center justify-between gap-3 sm:flex-row">
		<p class="text-xs font-medium text-stone-500">
			Every answer is saved the moment you choose it.
		</p>
		<form method="POST" action="?/submit" bind:this={submitFormEl} use:enhance>
			<ConfirmSubmit
				label="Submit attempt"
				title="Submit this attempt?"
				message={data.answeredCount < data.total
					? `You have answered ${data.answeredCount} of ${data.total} questions. Anything left blank is scored as unanswered.`
					: 'You can review your answers on the result page afterwards, but this attempt closes once submitted.'}
				confirmLabel="Submit attempt"
			/>
		</form>
	</div>

	<form method="POST" action="?/advance" bind:this={advanceFormEl} use:enhance hidden></form>
</div>
