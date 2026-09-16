<script lang="ts">
	import Button from '$lib/components/Button.svelte';
	import type { AnswerVerdict } from './api/types';

	/**
	 * The moment a practice answer lands: right or wrong, why, and the way onward.
	 *
	 * Only `JLPT_PRACTICE` ever renders this. A mock or full exam reveals nothing until the
	 * result page, which is the whole point of sitting one.
	 */
	let {
		verdict,
		isLast,
		autoAdvancing,
		onContinue
	}: {
		verdict: AnswerVerdict;
		/** No question follows this one, so continuing means going to review and submit. */
		isLast: boolean;
		/** True when a timer is already on its way to the next question. */
		autoAdvancing: boolean;
		onContinue: () => void;
	} = $props();

	const letter = $derived(String.fromCharCode(64 + verdict.correctOptionNumber));

	/**
	 * The colour flash on the options is invisible to a screen reader, so the verdict is
	 * spoken here instead. `assertive` because it answers something the learner just did and
	 * is about to act on; the explanation rides along in the same utterance so it is not
	 * truncated by the navigation that follows.
	 */
	const announcement = $derived(
		verdict.isCorrect
			? `Correct.${verdict.explanation ? ` ${verdict.explanation}` : ''}`
			: `Incorrect. The answer is ${letter}.${verdict.explanation ? ` ${verdict.explanation}` : ''}`
	);

	/*
	 * Focus moves to Continue on reveal so the keyboard path is one key, not a hunt through
	 * the options that are now locked. Skipped while a timer is running: stealing focus and
	 * then navigating out from under it is worse than leaving it where it is.
	 */
	let continueEl = $state<HTMLElement | undefined>();
	$effect(() => {
		if (!autoAdvancing) continueEl?.focus();
	});
</script>

<div
	class="flex flex-col gap-4 border-2 p-4 shadow-hard sm:flex-row sm:items-center sm:justify-between {verdict.isCorrect
		? 'border-success bg-success-soft'
		: 'border-danger bg-danger-soft'}"
>
	<div class="min-w-0 space-y-1">
		<p
			class="m-0 flex items-center gap-2 text-xs font-black tracking-widest uppercase {verdict.isCorrect
				? 'text-success'
				: 'text-danger'}"
		>
			<i
				class="fi {verdict.isCorrect ? 'fi-rs-check-circle' : 'fi-rs-circle-xmark'}"
				aria-hidden="true"
			></i>
			{verdict.isCorrect ? 'Correct' : `Incorrect — the answer is ${letter}`}
		</p>

		{#if verdict.explanation}
			<p class="m-0 text-sm leading-relaxed font-medium text-ink">{verdict.explanation}</p>
		{/if}
	</div>

	<div class="shrink-0">
		<Button type="button" variant="secondary" onclick={onContinue} bind:ref={continueEl}>
			{isLast ? 'Review & submit' : 'Next question'}
		</Button>
	</div>
</div>

<p class="visually-hidden" aria-live="assertive">{announcement}</p>
