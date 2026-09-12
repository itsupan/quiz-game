<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import Countdown from '$lib/features/quiz/Countdown.svelte';
	import OptionList from '$lib/features/quiz/OptionList.svelte';
	import QuestionMedia from '$lib/features/quiz/QuestionMedia.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/**
	 * Listening choices start disabled in SSR as well as in the browser. The media
	 * component opens them only after `canplay`, so slow and broken audio cannot be skipped
	 * merely by submitting the server-rendered form before hydration.
	 */
	// eslint-disable-next-line svelte/prefer-writable-derived
	let optionsDisabled = $state(untrack(() => data.question.audio !== null));

	$effect(() => {
		optionsDisabled = data.question.audio !== null;
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

<div class="space-y-4">
	<div class="flex flex-wrap items-center justify-between gap-3">
		<h1 class="text-xl font-black tracking-tight text-ink uppercase">{data.quiz.title}</h1>
		<Countdown deadline={data.deadline ? new Date(data.deadline) : null} {onexpire} />
	</div>

	<p class="m-0 text-sm text-muted">
		Question {data.index} of {data.total} · {data.question.section} · {data.answeredCount} answered
	</p>

	{#if form?.message}
		<Notice tone="danger" alert>{form.message}</Notice>
	{/if}

	{#key data.question.attemptQuestionId}
		<Card raised class="p-6">
			<QuestionMedia image={data.question.image} audio={data.question.audio} {onaudioready} />

			<p class="mb-4 text-lg font-medium text-ink">{data.question.stem}</p>

			<form method="POST" action="?/answer" use:enhance>
				<input type="hidden" name="attemptQuestionId" value={data.question.attemptQuestionId} />

				<OptionList
					name="selectedOptionId"
					options={data.question.options}
					selectedOptionId={data.question.selectedOptionId}
					disabled={optionsDisabled}
				/>

				<div class="mt-4 flex flex-wrap gap-2">
					{#if data.index > 1}
						<Button type="submit" variant="ghost" name="nextIndex" value={String(data.index - 1)}>
							Previous
						</Button>
					{/if}

					<Button type="submit" variant="secondary" name="nextIndex" value={String(data.index)}>
						Save answer
					</Button>

					{#if data.index < data.total}
						<Button
							type="submit"
							name="nextIndex"
							value={String(data.index + 1)}
							disabled={optionsDisabled}
						>
							Next
						</Button>
					{/if}
				</div>
			</form>
		</Card>
	{/key}

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

	<form method="POST" action="?/advance" bind:this={advanceFormEl} use:enhance hidden></form>
</div>
