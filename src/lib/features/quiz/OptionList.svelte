<script lang="ts">
	import type { QuizOption } from './api/types';

	/**
	 * One question's answer choices, as a native radio group.
	 *
	 * A `<fieldset disabled>` cascades to every radio inside it in one line — the readiness
	 * gate on a listening question (see `QuestionMedia`) needs nothing more than that prop.
	 */
	let {
		name,
		options,
		selectedOptionId,
		correctOptionNumber,
		disabled = false
	}: {
		name: string;
		options: QuizOption[];
		selectedOptionId: number | null;
		/**
		 * Only passed by the result review list, once the attempt is scored. Its presence
		 * switches the highlight from "what's selected" (brand red) to "what's right" (green)
		 * plus "what you picked instead" (red) — reusing the live attempt's plain selected
		 * style here would paint the correct answer red, reading as wrong under a green
		 * CORRECT banner.
		 */
		correctOptionNumber?: number | null;
		disabled?: boolean;
	} = $props();

	const reviewMode = $derived(correctOptionNumber !== undefined);
</script>

<fieldset class="m-0 border-0 p-0" class:review-mode={reviewMode} {disabled}>
	<legend class="visually-hidden">Answer options</legend>
	<div class="flex flex-col gap-3">
		{#each options as option, i (option.number)}
			{@const isSelected = selectedOptionId === option.number}
			{@const isCorrectOption = reviewMode && correctOptionNumber === option.number}
			{@const isWrongPick = reviewMode && isSelected && !isCorrectOption}
			<label
				class="answer-option relative flex cursor-pointer items-center gap-6 border border-ink bg-white p-3 transition-colors has-disabled:cursor-not-allowed has-disabled:opacity-60"
				class:is-correct={isCorrectOption}
				class:is-wrong={isWrongPick}
			>
				<!--
					A full-size invisible overlay, not `sr-only`: that class's 1x1px absolutely
					positioned box lands right under this label's own first child (the lettered
					box below), so a direct click or Playwright's `.check()` on the input hits
					that sibling instead. Covering the whole row keeps the input reachable from
					anywhere in it, exactly like clicking the visible content already does.
				-->
				<input
					type="radio"
					{name}
					value={option.number}
					checked={isSelected}
					aria-label={option.body}
					class="absolute inset-0 z-10 h-full w-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
				/>

				<div class="answer-marker flex items-center justify-center border border-ink px-2 py-1">
					<span class="text-xs font-bold">{String.fromCharCode(65 + i)}</span>
				</div>

				<div class="flex-1">
					<span class="answer-text text-base font-medium text-ink">{option.body}</span>
				</div>
			</label>
		{/each}
	</div>
</fieldset>

<style>
	/*
	 * Hover gets its own neutral affordance, deliberately not the "selected" red — sharing
	 * that color made hovering an unselected option look like a second answer was chosen.
	 */
	.answer-option:not(:has(input:disabled)):hover {
		border-color: var(--color-line-strong);
		background: var(--color-line);
	}

	/*
	 * The live attempt page has no `is-correct`/`is-wrong` classes (review mode is off), so
	 * this reduces to a plain `:has(input:checked)` there — reacting the instant a radio is
	 * clicked, before any server round-trip updates `selectedOptionId`. In review mode the
	 * guard keeps this from fighting the green "correct" style on a row that's also checked.
	 */
	fieldset:not(.review-mode) .answer-option:has(input:checked),
	.answer-option.is-wrong {
		border-color: var(--color-brand-red);
		background: var(--color-danger-soft);
		border-width: 2px;
		padding: 11px;
	}

	fieldset:not(.review-mode) .answer-option:has(input:checked) .answer-marker,
	.answer-option.is-wrong .answer-marker {
		border-color: var(--color-brand-red);
		background: var(--color-brand-red);
		color: white;
	}

	fieldset:not(.review-mode) .answer-option:has(input:checked) .answer-text,
	.answer-option.is-wrong .answer-text {
		color: var(--color-brand-red);
		font-weight: 700;
	}

	.answer-option.is-correct {
		border-color: var(--color-success);
		background: var(--color-success-soft);
		border-width: 2px;
		padding: 11px;
	}

	.answer-option.is-correct .answer-marker {
		border-color: var(--color-success);
		background: var(--color-success);
		color: white;
	}

	.answer-option.is-correct .answer-text {
		color: var(--color-success);
		font-weight: 700;
	}

	.answer-option:has(input:focus-visible) {
		outline: 3px solid var(--color-brand-red);
		outline-offset: 3px;
	}
</style>
