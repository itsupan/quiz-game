<script lang="ts">
	import type { AttemptQuestionView, ResultQuestionView } from './attempts/types.server';
	import Badge from '$lib/components/Badge.svelte';
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
		disabled = false,
		/** Off on the attempt page — its own sticky status bar already names the section. */
		showSectionBadge = true,
		onaudioready
	}: {
		question: AttemptQuestionView | ResultQuestionView;
		revealStudyAids: boolean;
		name: string;
		selectedOptionId: number | null;
		disabled?: boolean;
		showSectionBadge?: boolean;
		onaudioready?: () => void;
	} = $props();

	/** Withheld for KANJI_READING: the reading is exactly what the options are testing. */
	const showFocusReading = $derived(
		question.focusReading !== null && question.format === 'VOCABULARY_MEANING'
	);

	const clozeParts = $derived(question.contextText?.split(/_{2,}/) ?? []);
</script>

<div class="flex flex-col gap-6">
	<div>
		{#if showSectionBadge}
			<div class="mb-3 flex items-center gap-2">
				<Badge>{question.section.replace('_', ' ')}</Badge>
			</div>
		{/if}
		<h2 class="text-xl leading-snug font-bold text-ink">{question.stem}</h2>
		{#if revealStudyAids && question.promptTranslation}
			<p class="mt-2 text-sm text-stone-500 italic">{question.promptTranslation}</p>
		{/if}
	</div>

	{#if question.focusText}
		<div class="border-2 border-ink bg-paper px-8 py-6 text-center">
			<p class="text-4xl font-black tracking-wide text-ink">{question.focusText}</p>
			{#if showFocusReading}
				<p class="mt-2 text-sm font-bold text-stone-500">{question.focusReading}</p>
			{/if}
		</div>
	{/if}

	{#if question.contextText}
		<div class="border-2 border-ink bg-paper px-6 py-5">
			<p class="text-xl leading-relaxed font-bold text-ink">
				{#each clozeParts as part, i (i)}
					{part}{#if i < clozeParts.length - 1}<span
							class="mx-1 inline-block min-w-16 border-b-2 border-brand-red align-bottom"
							aria-hidden="true">&nbsp;</span
						>{/if}
				{/each}
			</p>
			{#if revealStudyAids && question.contextTransliteration}
				<p class="mt-3 text-sm text-stone-500 italic">{question.contextTransliteration}</p>
			{/if}
		</div>
	{/if}

	{#if !question.group}
		<QuestionMedia
			image={question.image}
			audio={question.audio}
			revealTranscript={revealStudyAids}
			{onaudioready}
		/>
	{/if}

	<OptionList {name} options={question.options} {selectedOptionId} {disabled} />
</div>
