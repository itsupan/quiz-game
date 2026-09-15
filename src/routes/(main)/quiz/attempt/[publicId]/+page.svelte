<script lang="ts">
	import { enhance } from '$app/forms';
	import type { SubmitFunction } from '@sveltejs/kit';
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

	/**
	 * One tap answers: choosing an option saves it and moves on to the next question (or,
	 * on the last one, saves in place). The pause lets the selected highlight register
	 * before the page changes; a second pick inside it simply replaces the first.
	 */
	const ADVANCE_DELAY_MS = 250;
	let answerFormEl: HTMLFormElement | undefined = $state();
	let nextQuestionEl: HTMLInputElement | undefined = $state();
	let advanceTimer: ReturnType<typeof setTimeout> | undefined;
	let saving = false;
	let pendingSave = false;

	function saveAnswer() {
		if (saving) {
			pendingSave = true;
			return;
		}
		answerFormEl?.requestSubmit();
	}

	function onanswerchange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.name !== 'selectedOptionNumber' || optionsDisabled) return;

		const { number, links } = data.question;
		if (nextQuestionEl) nextQuestionEl.value = String(links.next ? number + 1 : number);

		clearTimeout(advanceTimer);
		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		advanceTimer = setTimeout(saveAnswer, reduceMotion ? 0 : ADVANCE_DELAY_MS);
	}

	const enhanceAnswer: SubmitFunction = ({ submitter }) => {
		// Review & submit carries its own intent; only the automatic save is serialized.
		if (!submitter) saving = true;
		clearTimeout(advanceTimer);

		return async ({ update }) => {
			// Keep the just-checked radio: a form reset would clear it before the reload lands.
			await update({ reset: false });
			saving = false;
			if (pendingSave) {
				pendingSave = false;
				saveAnswer();
			}
		};
	};

	$effect(() => () => clearTimeout(advanceTimer));

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

			<nav aria-label="Questions" class="-mx-1 overflow-x-auto px-1 pt-0.5 pb-1">
				<ol class="m-0 flex list-none gap-1.5 p-0">
					{#each data.attempt.questions as item (item.number)}
						{@const isCurrent = item.number === data.question.number}
						<li>
							<a
								href={`?q=${item.number}`}
								aria-current={isCurrent ? 'page' : undefined}
								aria-label={`Question ${item.number}${item.answered ? ', answered' : ''}`}
								data-sveltekit-noscroll
								class="flex h-7 min-w-7 items-center justify-center border px-1.5 text-xs font-black transition-colors {isCurrent
									? 'border-brand-red bg-brand-red text-white'
									: item.answered
										? 'border-ink bg-ink text-white hover:bg-stone-700'
										: 'border-stone-300 bg-white text-stone-500 hover:border-ink hover:text-ink'}"
								>{item.number}</a
							>
						</li>
					{/each}
				</ol>
			</nav>
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

	{#snippet answerForm(audioReady?: () => void)}
		<form
			id="active-answer-form"
			method="POST"
			action="?/answer"
			bind:this={answerFormEl}
			use:enhance={enhanceAnswer}
			onchange={onanswerchange}
			class="flex flex-col gap-6"
		>
			<input type="hidden" name="questionNumber" value={data.question.number} />
			<input
				type="hidden"
				name="nextQuestion"
				value={String(data.question.number)}
				bind:this={nextQuestionEl}
			/>

			<QuestionBody
				question={data.question}
				revealStudyAids={true}
				name="selectedOptionNumber"
				selectedOptionId={data.question.selectedOptionNumber}
				disabled={optionsDisabled}
				showSectionBadge={false}
				onaudioready={audioReady}
			/>

			{#if !data.question.links.next}
				<div class="flex items-center justify-end border-t border-line pt-4">
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
				</div>
			{/if}
		</form>
	{/snippet}

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
					{@render answerForm()}
				</div>
			</div>
		{:else}
			<div class="p-5 lg:p-6">
				{@render answerForm(onaudioready)}
			</div>
		{/if}
	</Card>

	<p class="text-xs font-medium text-stone-500">
		Your answer is saved as soon as you choose it. Use the question numbers above to go back, and
		submit from the final question when you are ready.
	</p>

	<form method="POST" action="?/submit" bind:this={submitFormEl} use:enhance hidden></form>
	<form method="POST" action="?/advance" bind:this={advanceFormEl} use:enhance hidden></form>
	<form id="exit-attempt-form" method="POST" action="?/exit" use:enhance hidden></form>
</div>
