<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import { stimulusFor, type AttemptQuestion, type ResultQuestion } from './api/types';
	import OptionList from './OptionList.svelte';
	import QuestionMedia from './QuestionMedia.svelte';

	/**
	 * The question itself: its instruction, whatever format-specific material it carries
	 * (a focus term, a cloze sentence), and its answer options. Shared by the attempt page
	 * and the result review list, so a person sees the exact same presentation both times.
	 *
	 * A question's own image/audio is skipped whenever it belongs to a group — grouped
	 * media is shared reading/listening material, and `QuestionContextPanel` already owns
	 * it, so mounting it again here would mean two players for the same clip.
	 */
	let {
		question,
		revealStudyAids,
		name,
		selectedOptionId,
		correctOptionNumber,
		disabled = false,
		/** Off on the attempt page — its own sticky status bar already names the section. */
		showSectionBadge = true,
		onaudioready
	}: {
		question: AttemptQuestion | ResultQuestion;
		revealStudyAids: boolean;
		name: string;
		selectedOptionId: number | null;
		/** Only passed by the result review list — see `OptionList` for what it switches on. */
		correctOptionNumber?: number | null;
		disabled?: boolean;
		showSectionBadge?: boolean;
		onaudioready?: () => void;
	} = $props();

	/** Withheld for KANJI_READING: the reading is exactly what the options are testing. */
	const presentation = $derived(question.presentation);
	const focus = $derived(
		presentation.type === 'VOCABULARY_MEANING' || presentation.type === 'KANJI_READING'
			? presentation.focus
			: null
	);
	const context = $derived(presentation.type === 'GRAMMAR_CLOZE' ? presentation.context : null);
	const group = $derived(stimulusFor(question));
	const showFocusReading = $derived(
		focus?.reading !== null && presentation.type === 'VOCABULARY_MEANING'
	);
	const clozeParts = $derived(context?.text?.split(/_{2,}/) ?? []);
	const options = $derived(question.options);
</script>

<div class="flex flex-col gap-4">
	<div>
		{#if showSectionBadge}
			<div class="mb-3 flex items-center gap-2">
				<Badge>{question.section.replace('_', ' ')}</Badge>
			</div>
		{/if}
		<h2 class="text-xl leading-snug font-bold text-ink">{question.stem}</h2>
		{#if revealStudyAids && presentation.prompt.translation}
			<p class="mt-2 text-sm text-stone-500 italic">{presentation.prompt.translation}</p>
		{/if}
	</div>

	{#if focus?.text}
		<div class="border-2 border-ink bg-paper px-6 py-4 text-center">
			<p class="text-4xl font-black tracking-wide text-ink">{focus.text}</p>
			{#if showFocusReading}
				<p class="mt-2 text-sm font-bold text-stone-500">{focus.reading}</p>
			{/if}
		</div>
	{/if}

	{#if context?.text}
		<div class="border-2 border-ink bg-paper px-5 py-4">
			<p class="text-xl leading-relaxed font-bold text-ink">
				{#each clozeParts as part, i (i)}
					{part}{#if i < clozeParts.length - 1}<span
							class="mx-1 inline-block min-w-16 border-b-2 border-brand-red align-bottom"
							aria-hidden="true">&nbsp;</span
						>{/if}
				{/each}
			</p>
			{#if revealStudyAids && context.transliteration}
				<p class="mt-3 text-sm text-stone-500 italic">{context.transliteration}</p>
			{/if}
		</div>
	{/if}

	{#if !group}
		<QuestionMedia
			image={question.image}
			audio={question.audio}
			revealTranscript={revealStudyAids}
			{onaudioready}
		/>
	{/if}

	{#key question.number}
		<OptionList {name} {options} {selectedOptionId} {correctOptionNumber} {disabled} />
	{/key}
</div>
