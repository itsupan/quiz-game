<script lang="ts">
	import Badge from '$lib/components/Badge.svelte';
	import type { Stimulus } from './api/types';
	import QuestionMedia from './QuestionMedia.svelte';

	/**
	 * The shared material a question belongs to — a reading passage, a listening clip, or
	 * a grammar point being reviewed — never the question itself. Rendered once per group,
	 * to the left of whichever question is currently open.
	 *
	 * Owns the group's own image/audio: a grouped question's readiness gate belongs here,
	 * not in `QuestionBody`, so the two never mount competing players for the same clip.
	 */
	let {
		group,
		revealStudyAids,
		onaudioready
	}: {
		group: Stimulus;
		revealStudyAids: boolean;
		onaudioready?: () => void;
	} = $props();

	const formatLabels = {
		READING_PASSAGE: 'Reading Passage',
		LISTENING_CLIP: 'Listening',
		CONCEPT_REVIEW: 'Grammar Point'
	} as const;
</script>

<div class="flex h-full flex-col">
	<div class="mb-8 flex items-center gap-3">
		<Badge>{formatLabels[group.type]}</Badge>
		{#if group.title}
			<h2 class="text-sm font-bold tracking-wide text-ink">{group.title}</h2>
		{/if}
	</div>

	{#if group.instruction}
		<p class="mb-6 text-sm font-medium text-stone-600">{group.instruction}</p>
	{/if}

	<QuestionMedia
		image={group.image}
		audio={group.audio}
		revealTranscript={revealStudyAids}
		{onaudioready}
	/>

	{#if group.body}
		<div class="flex-1 border-l-4 border-brand-red py-1 pl-6">
			<p class="text-xl leading-loose font-medium whitespace-pre-line text-ink">
				{group.body}
			</p>
		</div>
	{/if}

	{#if group.example}
		<div class="flex-1 border-l-4 border-brand-red py-1 pl-6">
			<p class="text-2xl leading-relaxed font-bold text-ink">{group.example.text}</p>
			{#if revealStudyAids && group.example.transliteration}
				<p class="mt-2 text-sm text-stone-500 italic">{group.example.transliteration}</p>
			{/if}
			{#if revealStudyAids && group.example.translation}
				<p class="mt-1 text-sm text-stone-500">{group.example.translation}</p>
			{/if}
		</div>
	{/if}

	{#if revealStudyAids && group.bodyTranslation}
		<div class="mt-8 border-t border-line pt-6">
			<p class="text-[10px] font-bold tracking-widest text-stone-400 uppercase">Translation</p>
			<p class="mt-2 text-sm leading-relaxed text-stone-500 italic">{group.bodyTranslation}</p>
		</div>
	{/if}
</div>
