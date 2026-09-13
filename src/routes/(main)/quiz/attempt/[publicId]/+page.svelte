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
	import { stimulusFor } from '$lib/features/quiz/api/types';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** Whichever media is actually driving the readiness gate — the group's, or the question's own. */
	const stimulus = $derived(stimulusFor(data.question));
	const gatingAudio = $derived(stimulus?.audio ?? data.question.audio);
	const progressPercent = $derived(
		Math.round((data.question.progress.current / data.question.progress.total) * 100)
	);

	/**
	 * Listening choices start disabled in SSR as well as in the browser. The media
	 * component opens them only after `canplay`, so slow and broken audio cannot be skipped
	 * merely by submitting the server-rendered form before hydration.
	 */
	// eslint-disable-next-line svelte/prefer-writable-derived
	let optionsDisabled = $state(untrack(() => gatingAudio !== null || !data.question.canAnswer));

	$effect(() => {
		optionsDisabled = gatingAudio !== null || !data.question.canAnswer;
	});

	function onaudioready() {
		if (data.question.canAnswer) optionsDisabled = false;
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
	<title>{data.attempt.quiz.title} | QuizGame</title>
</svelte:head>

<div class="space-y-4">
	<div class="flex items-center gap-3">
		<span class="h-6 w-1.5 bg-brand-red" aria-hidden="true"></span>
		<h1 class="text-xl font-black tracking-tight text-ink uppercase">
			{data.attempt.quiz.title}
		</h1>
	</div>

	<!--
		Docked below both rows of AppShell's mobile header, then below its single desktop
		row from md upward, so long passage and media questions never hide their status.
	-->
	<div
		class="sticky top-[6.25rem] z-20 flex flex-col gap-2 border-2 border-ink bg-white px-4 py-2 shadow-hard sm:flex-row sm:items-center md:top-16"
	>
		<div class="min-w-0 flex-1 space-y-1.5">
			<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
				<div class="flex items-center gap-3">
					<Badge>{data.question.section.replace('_', ' ')}</Badge>
					<span class="text-xs font-black text-ink">
						Question {data.question.progress.current} of {data.question.progress.total}
					</span>
				</div>
				<span class="text-xs font-bold text-stone-500">
					{data.question.progress.answered} answered · {progressPercent}% through
				</span>
			</div>

			<div
				class="h-2 w-full overflow-hidden bg-stone-200"
				role="progressbar"
				aria-label="Quiz progress"
				aria-valuemin={0}
				aria-valuenow={data.question.progress.current}
				aria-valuemax={data.question.progress.total}
				aria-valuetext={`Question ${data.question.progress.current} of ${data.question.progress.total}`}
			>
				<div
					class="h-full bg-brand-red transition-[width] duration-300 ease-out motion-reduce:transition-none"
					style={`width: ${progressPercent}%`}
				></div>
			</div>
		</div>

		<div class="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
			{#if data.deadline}
				<Countdown deadline={new Date(data.deadline)} {onexpire} />
			{/if}
			<ConfirmSubmit
				label="Exit quiz"
				title="Exit this quiz?"
				message="Your saved answers will not be scored, and this attempt cannot be resumed."
				confirmLabel="Exit quiz"
				form="exit-attempt-form"
				formaction="?/exit"
				triggerVariant="ghost"
			/>
		</div>
	</div>

	{#if form?.message}
		<Notice tone="danger" alert>{form.message}</Notice>
	{:else if !data.question.canAnswer}
		<Notice tone="warning">
			This section isn't currently open, so this question can't be answered right now.
		</Notice>
		<form method="POST" action="?/advance" use:enhance>
			<Button type="submit" variant="secondary">Continue</Button>
		</form>
	{/if}

	<Card raised>
		<!--
			A reading passage or a listening clip earns a shared context panel — the material
			is genuinely separate from the question. A concept-review group is a worked
			explanation of the grammar point the question is testing, and showing it during a
			live attempt would just hand over the answer; it stays for the result page's
			review instead, once the attempt is no longer live.
		-->
		{#if stimulus && stimulus.type !== 'CONCEPT_REVIEW'}
			<div class="grid grid-cols-1 lg:grid-cols-2">
				<div class="border-b border-line bg-stone-50 p-5 lg:border-r lg:border-b-0 lg:p-6">
					<QuestionContextPanel group={stimulus} revealStudyAids={true} {onaudioready} />
				</div>

				<div class="p-5 lg:p-6">
					<form
						id="active-answer-form"
						method="POST"
						action="?/answer"
						use:enhance
						class="flex flex-col gap-6"
					>
						<input type="hidden" name="questionNumber" value={data.question.number} />

						<QuestionBody
							question={data.question}
							revealStudyAids={true}
							name="selectedOptionNumber"
							selectedOptionId={data.question.selectedOptionNumber}
							disabled={optionsDisabled}
							showSectionBadge={false}
						/>

						<div class="flex items-center justify-between border-t border-line pt-4">
							{#if data.question.links.previous}
								<Button
									type="submit"
									name="nextQuestion"
									value={String(data.question.number - 1)}
									variant="secondary"
									disabled={optionsDisabled}
								>
									&larr; Prev
								</Button>
							{:else}
								<span></span>
							{/if}

							{#if data.question.links.next}
								<Button
									type="submit"
									name="nextQuestion"
									value={String(data.question.number + 1)}
									disabled={optionsDisabled}
								>
									Next →
								</Button>
							{:else}
								<ConfirmSubmit
									label="Review & submit"
									title="Submit this attempt?"
									message={data.question.progress.answered < data.question.progress.total
										? 'Any questions left blank are scored as unanswered. You can review saved answers before confirming.'
										: 'You can review your answers on the result page afterwards, but this attempt closes once submitted.'}
									confirmLabel="Submit attempt"
									formaction="?/answer"
									name="finish"
									value="true"
									disabled={optionsDisabled}
								/>
							{/if}
						</div>
					</form>
				</div>
			</div>
		{:else}
			<div class="p-5 lg:p-6">
				<form
					id="active-answer-form"
					method="POST"
					action="?/answer"
					use:enhance
					class="flex flex-col gap-6"
				>
					<input type="hidden" name="questionNumber" value={data.question.number} />

					<QuestionBody
						question={data.question}
						revealStudyAids={true}
						name="selectedOptionNumber"
						selectedOptionId={data.question.selectedOptionNumber}
						disabled={optionsDisabled}
						showSectionBadge={false}
						{onaudioready}
					/>

					<div class="flex items-center justify-between border-t border-line pt-4">
						{#if data.question.links.previous}
							<Button
								type="submit"
								name="nextQuestion"
								value={String(data.question.number - 1)}
								variant="secondary"
								disabled={optionsDisabled}
							>
								&larr; Prev
							</Button>
						{:else}
							<span></span>
						{/if}

						{#if data.question.links.next}
							<Button
								type="submit"
								name="nextQuestion"
								value={String(data.question.number + 1)}
								disabled={optionsDisabled}
							>
								Next →
							</Button>
						{:else}
							<ConfirmSubmit
								label="Review & submit"
								title="Submit this attempt?"
								message={data.question.progress.answered < data.question.progress.total
									? 'Any questions left blank are scored as unanswered. You can review saved answers before confirming.'
									: 'You can review your answers on the result page afterwards, but this attempt closes once submitted.'}
								confirmLabel="Submit attempt"
								formaction="?/answer"
								name="finish"
								value="true"
								disabled={optionsDisabled}
							/>
						{/if}
					</div>
				</form>
			</div>
		{/if}
	</Card>

	<p class="text-xs font-medium text-stone-500">
		Your answer is saved when you move to another question. Submit from the final question when you
		are ready.
	</p>

	<form method="POST" action="?/submit" bind:this={submitFormEl} use:enhance hidden></form>
	<form method="POST" action="?/advance" bind:this={advanceFormEl} use:enhance hidden></form>
	<form id="exit-attempt-form" method="POST" action="?/exit" use:enhance hidden></form>
</div>
