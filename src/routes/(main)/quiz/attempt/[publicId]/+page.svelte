<script lang="ts">
	import { enhance } from '$app/forms';
	import { beforeNavigate, goto } from '$app/navigation';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import type { SubmitFunction } from '@sveltejs/kit';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import Countdown from '$lib/features/quiz/Countdown.svelte';
	import QuestionBody from '$lib/features/quiz/QuestionBody.svelte';
	import QuestionContextPanel from '$lib/features/quiz/QuestionContextPanel.svelte';
	import SoundToggle from '$lib/features/sound/SoundToggle.svelte';
	import ComboMeter from '$lib/features/quiz/ComboMeter.svelte';
	import LevelBadge from '$lib/features/quiz/LevelBadge.svelte';
	import VerdictPanel from '$lib/features/quiz/VerdictPanel.svelte';
	import { playSfx } from '$lib/features/sound/sound.svelte';
	import { COMBO_THRESHOLDS } from '$lib/features/quiz/game-feel';
	import { isPracticeMode } from '$lib/features/quiz/modes';
	import { stimulusFor, type AnswerVerdict } from '$lib/features/quiz/api/types';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/** Whichever media is actually driving the readiness gate — the group's, or the question's own. */
	const stimulus = $derived(stimulusFor(data.question));
	const gatingAudio = $derived(stimulus?.audio ?? data.question.audio);
	const progressPercent = $derived(
		Math.round((data.question.progress.current / data.question.progress.total) * 100)
	);

	/**
	 * Set while an answer (or Review & submit) is on its way to the server. Options are
	 * locked meanwhile, so a second tap cannot race the first one's redirect.
	 */
	let saving = $state(false);

	/**
	 * The gating audio that has reported it can play, keyed by URL rather than toggled by
	 * an effect: resetting a boolean whenever `data` changed shut the gate again after
	 * every save and every move between questions sharing one clip, while the already
	 * loaded `<audio>` never fired `canplay` a second time to reopen it.
	 *
	 * Listening choices start disabled in SSR as well as in the browser, so slow and broken
	 * audio cannot be skipped by submitting the server-rendered form before hydration.
	 */
	let readyAudioUrl = $state<string | null>(null);
	const audioGateOpen = $derived(gatingAudio === null || readyAudioUrl === gatingAudio.url);

	const isPractice = $derived(isPracticeMode(data.attempt.quiz.mode));

	/**
	 * Practice answers are revealed, and therefore final.
	 *
	 * The verdict carries its own question number for the same reason `pendingQuestion` does:
	 * this component is not remounted between questions, so a verdict that outlived its
	 * question would otherwise paint the next one.
	 */
	let verdict = $state<AnswerVerdict | null>(null);
	let nextAfterVerdict = $state<number | null>(null);
	let revealTimer: ReturnType<typeof setTimeout> | undefined;
	let autoAdvancing = $state(false);
	const revealing = $derived(verdict !== null && verdict.questionNumber === data.question.number);

	/**
	 * The option just picked, remembered client-side.
	 *
	 * The practice path skips `update()`, so `data.question.selectedOptionNumber` is still
	 * null while the verdict is on screen — and `OptionList` needs the pick to paint the
	 * wrong choice red beside the green correct one.
	 */
	let pickedOptionNumber = $state<number | null>(null);
	const selectedNow = $derived(revealing ? pickedOptionNumber : data.question.selectedOptionNumber);

	/*
	 * The verdict knows the streak a beat before the page data does, because the practice
	 * path skips `update()`. Once the reveal clears, the loaded attempt is authoritative
	 * again — the server owns the number either way.
	 */
	const liveCombo = $derived(revealing ? verdict!.combo : data.attempt.combo);

	/**
	 * Questions answered since this page was loaded.
	 *
	 * The server already refuses a second practice answer, and `canAnswer` reports the lock —
	 * but the practice path deliberately skips `update()`, so `data` still describes the
	 * question as unanswered until the next navigation. Without this, clearing the verdict on
	 * the final question would re-enable radios the server would then reject.
	 */
	const lockedQuestions = new SvelteSet<number>();

	const optionsDisabled = $derived(
		!data.question.canAnswer ||
			!audioGateOpen ||
			saving ||
			revealing ||
			lockedQuestions.has(data.question.number)
	);

	/**
	 * Finishing the attempt is a different question from answering this one.
	 *
	 * It must not borrow `optionsDisabled`. That would disable the trigger while a save is in
	 * flight, and `ConfirmSubmit` re-clicks its trigger to submit — a click on a disabled
	 * button does nothing, so a learner who confirmed would watch the dialog close and
	 * nothing happen. It would also strand a practice attempt permanently, since its last
	 * question is locked the moment it is answered.
	 *
	 * Nothing is lost by leaving it enabled: in exam mode the finishing post carries the
	 * answer itself, and in practice the answer was saved when it was picked.
	 */
	const submitDisabled = $derived(data.attempt.status !== 'IN_PROGRESS');

	function onaudioready(url: string | null) {
		if (url === null) return;
		readyAudioUrl = url;

		// A listening question only becomes answerable now, so the speed clock starts now too —
		// buffering a clip is not thinking time and should not cost the learner a bonus.
		questionShownAt = Date.now();
	}

	/**
	 * One tap answers: choosing an option saves it and moves on to the next question (or,
	 * on the last one, saves in place). The pause lets the selected highlight register
	 * before the page changes; a second pick inside it simply replaces the first.
	 *
	 * The pending pick remembers which question it belongs to. The page component is not
	 * remounted between questions, so a timer that outlived its question used to submit
	 * the NEXT question's form — saving a stale or empty choice there.
	 */
	const ADVANCE_DELAY_MS = 250;
	let answerFormEl: HTMLFormElement | undefined = $state();
	let nextQuestionEl: HTMLInputElement | undefined = $state();
	let elapsedMsEl: HTMLInputElement | undefined = $state();

	/**
	 * When this question became answerable, for the practice speed bonus.
	 *
	 * The browser is the only place that knows this: the server sees a question load, not the
	 * moment it was painted, and on a listening question not the moment the audio gate opened.
	 * The clock restarts whenever the question number changes — including on one returned to
	 * through the navigator, which gets a fresh clock rather than an inherited one.
	 */
	let questionShownAt = Date.now();
	let timedQuestion = -1;
	$effect(() => {
		if (data.question.number === timedQuestion) return;

		timedQuestion = data.question.number;
		questionShownAt = Date.now();
	});
	let advanceTimer: ReturnType<typeof setTimeout> | undefined;
	let pendingQuestion: number | null = null;

	function cancelPendingAnswer() {
		clearTimeout(advanceTimer);
		pendingQuestion = null;
	}

	function flushPendingAnswer() {
		const question = pendingQuestion;
		cancelPendingAnswer();
		if (question === null || question !== data.question.number || saving) return;
		answerFormEl?.requestSubmit();
	}

	function onanswerchange(event: Event) {
		const target = event.target as HTMLInputElement;
		if (target.name !== 'selectedOptionNumber' || optionsDisabled) return;

		pickedOptionNumber = Number(target.value);
		if (elapsedMsEl) elapsedMsEl.value = String(Date.now() - questionShownAt);
		playSfx('swish');

		const { number, links } = data.question;
		if (nextQuestionEl) nextQuestionEl.value = String(links.next ? number + 1 : number);

		cancelPendingAnswer();
		pendingQuestion = number;

		/*
		 * The pause exists so the selected highlight registers before the page changes. In
		 * practice mode nothing changes yet — the answer stays on screen for the verdict — so
		 * there is nothing to race and the delay would only make the reveal feel sluggish.
		 */
		if (isPractice) {
			flushPendingAnswer();
			return;
		}

		const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
		advanceTimer = setTimeout(flushPendingAnswer, reduceMotion ? 0 : ADVANCE_DELAY_MS);
	}

	beforeNavigate((navigation) => {
		// Only the learner's own navigations; the redirect after a save arrives as `goto`.
		if (navigation.type !== 'link' && navigation.type !== 'popstate') return;

		/*
		 * Drop any verdict still on screen. Its question number would match again on the way
		 * back to that question through the navigator, re-revealing an answer the learner has
		 * already seen.
		 */
		clearVerdict();

		const target = navigation.to?.url;
		const withinAttempt = target?.pathname === navigation.from?.url.pathname;

		if (withinAttempt && saving) {
			// Let the in-flight save land first; it redirects on its own.
			navigation.cancel();
			return;
		}

		if (pendingQuestion === null) return;

		if (withinAttempt && navigation.type === 'link' && target && nextQuestionEl) {
			// A navigator click inside the pause: save the pick now and go where they clicked,
			// instead of dropping it or letting it fire later against another question.
			navigation.cancel();
			nextQuestionEl.value = target.searchParams.get('q') ?? String(data.question.number);
			flushPendingAnswer();
			return;
		}

		cancelPendingAnswer();
	});

	const enhanceAnswer: SubmitFunction = ({ formData }) => {
		cancelPendingAnswer();
		if (formData.get('finish') === 'true') playSfx('strike');
		saving = true;

		return async ({ result, update }) => {
			try {
				/*
				 * The practice action returns a verdict instead of redirecting, so there is no
				 * reload to wait for — and calling `update()` here would re-run `load` for data
				 * that the advance is about to replace anyway. A failure has no verdict and
				 * falls through, so error notices still arrive the usual way.
				 */
				if (result.type === 'success' && result.data?.verdict) {
					revealVerdict(result.data.verdict as AnswerVerdict, result.data.next ?? null);
					return;
				}

				// Keep the just-checked radio: a form reset would clear it before the reload lands.
				await update({ reset: false });
			} finally {
				saving = false;
			}
		};
	};

	const AUTO_ADVANCE_MS = 900;

	function revealVerdict(next: AnswerVerdict, following: number | null) {
		verdict = next;
		nextAfterVerdict = following;
		lockedQuestions.add(next.questionNumber);
		playSfx(next.isCorrect ? 'correct' : 'incorrect');

		// A threshold crossing gets a second layer on top of the verdict, not instead of it.
		if (next.isCorrect && COMBO_THRESHOLDS.includes(next.combo as 3 | 5 | 10)) {
			playSfx('combo');
		}

		/*
		 * A correct answer moves on by itself, so a good run keeps its rhythm. A wrong one
		 * waits: the explanation is the reason practice exists, and skipping it past someone
		 * would defeat the point.
		 *
		 * Reduced motion also turns the auto-advance off. It is an imperfect proxy for
		 * assistive tech — nothing can detect a screen reader — but it is the one this app
		 * already relies on, and navigating 900ms into an assertive announcement would cut
		 * the verdict off mid-sentence.
		 */
		if (!next.isCorrect) return;
		if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
		autoAdvancing = true;
		revealTimer = setTimeout(continueFromVerdict, AUTO_ADVANCE_MS);
	}

	function clearVerdict() {
		clearTimeout(revealTimer);
		revealTimer = undefined;
		autoAdvancing = false;
		verdict = null;
		nextAfterVerdict = null;
		pickedOptionNumber = null;
	}

	function continueFromVerdict() {
		const following = nextAfterVerdict;
		clearVerdict();

		// The last question has nowhere to go; its Review & submit button is already on screen.
		if (following === null) return;
		goto(resolve(`/quiz/attempt/${data.attempt.id}?q=${following}`), { noScroll: true });
	}

	$effect(() => () => {
		cancelPendingAnswer();
		clearTimeout(revealTimer);
	});

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
			playSfx('strike');
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
		Docked below AppShell's sticky header, so long passage and media questions never hide their status.
	-->
	<div
		class="sticky top-16 z-20 flex flex-col gap-2 border-2 border-ink bg-white px-4 py-2 shadow-hard sm:flex-row sm:items-center"
	>
		<div class="min-w-0 flex-1 space-y-1.5">
			<div class="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
				<div class="flex items-center gap-3">
					<Badge>{data.question.section.replace('_', ' ')}</Badge>
					<span class="text-xs font-black text-ink">
						Question {data.question.progress.current} of {data.question.progress.total}
					</span>
				</div>
				<!--
					The bar is already dense on a phone, so the streak takes the counts' place
					rather than adding a slot. An exam sitting has no streak and keeps the counts.
				-->
				{#if isPractice}
					<ComboMeter combo={liveCombo} />
				{:else}
					<span class="text-xs font-bold text-stone-500">
						{data.question.progress.answered} answered · {progressPercent}% through
					</span>
				{/if}
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
								href={resolve(`/quiz/attempt/${data.attempt.id}?q=${item.number}`)}
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
			<span class="text-xs font-bold text-stone-500" role="status" aria-live="polite">
				{saving ? 'Saving…' : ''}
			</span>
			{#if isPractice}
				<LevelBadge lifetimeXp={data.lifetimeXp} />
			{/if}
			{#if data.deadline}
				<Countdown
					deadline={new Date(data.deadline)}
					{onexpire}
					onlowtime={() => playSfx('drum')}
				/>
			{/if}
			<SoundToggle />
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

	{#snippet answerForm()}
		<!--
			Keyed by question so every question mounts fresh radios. Reused inputs kept the
			DOM `checked` state from the previous question whenever the server's selection
			did not change (unanswered → unanswered), showing a pick that was never made.
		-->
		{#key data.question.number}
			<form
				id="active-answer-form"
				method="POST"
				action="?/answer"
				bind:this={answerFormEl}
				use:enhance={enhanceAnswer}
				onchange={onanswerchange}
				aria-busy={saving}
				class="flex flex-col gap-6"
			>
				<input type="hidden" name="questionNumber" value={data.question.number} />
				<input type="hidden" name="elapsedMs" bind:this={elapsedMsEl} />
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
					selectedOptionId={selectedNow}
					correctOptionNumber={revealing ? verdict!.correctOptionNumber : undefined}
					disabled={optionsDisabled}
					showSectionBadge={false}
					{onaudioready}
				/>

				{#if revealing}
					<VerdictPanel
						verdict={verdict!}
						isLast={nextAfterVerdict === null}
						{autoAdvancing}
						onContinue={continueFromVerdict}
					/>
				{/if}

				{#if !data.question.links.next}
					{@const unanswered = data.question.progress.answered < data.question.progress.total}
					{@const submitMessage = unanswered
						? 'Any questions left blank are scored as unanswered. You can review saved answers before confirming.'
						: 'You can review your answers on the result page afterwards, but this attempt closes once submitted.'}

					<div class="flex items-center justify-end border-t border-line pt-4">
						<!--
							Exam mode finishes through `?/answer` with `finish`, so the post saves this
							last answer and closes the attempt in one trip.

							Practice cannot: its answer was already saved the moment it was picked, the
							question is locked against a second write, and its options are disabled — so
							the radio would not be submitted at all and the write would be refused as a
							re-answer. It finishes straight through `?/submit`, which touches no answers.
						-->
						{#if isPractice}
							<ConfirmSubmit
								label="Review & submit"
								title="Submit this attempt?"
								message={submitMessage}
								confirmLabel="Submit attempt"
								form="submit-attempt-form"
								disabled={submitDisabled}
							/>
						{:else}
							<ConfirmSubmit
								label="Review & submit"
								title="Submit this attempt?"
								message={submitMessage}
								confirmLabel="Submit attempt"
								formaction="?/answer"
								name="finish"
								value="true"
								disabled={submitDisabled}
							/>
						{/if}
					</div>
				{/if}
			</form>
		{/key}
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
				{@render answerForm()}
			</div>
		{/if}
	</Card>

	<p class="text-xs font-medium text-stone-500">
		Your answer is saved as soon as you choose it. Use the question numbers above to go back, and
		submit from the final question when you are ready.
	</p>

	<!-- Named so practice mode's Review & submit can target it, and the expiry path can too. -->
	<form
		id="submit-attempt-form"
		method="POST"
		action="?/submit"
		bind:this={submitFormEl}
		use:enhance
		hidden
	></form>
	<form method="POST" action="?/advance" bind:this={advanceFormEl} use:enhance hidden></form>
	<form id="exit-attempt-form" method="POST" action="?/exit" use:enhance hidden></form>
</div>
