<script lang="ts">
	import type { PublicQuestionOption } from '$lib/server/db/schema';

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
		disabled = false
	}: {
		name: string;
		options: PublicQuestionOption[];
		selectedOptionId: number | null;
		disabled?: boolean;
	} = $props();
</script>

<fieldset class="m-0 border-0 p-0" {disabled}>
	<legend class="visually-hidden">Answer options</legend>
	<div class="flex flex-col gap-4">
		{#each options as option, i (option.id)}
			<label
				class="relative flex cursor-pointer items-center gap-6 border border-ink bg-white p-4 transition-colors hover:bg-stone-50 has-checked:border-2 has-checked:bg-paper has-disabled:opacity-60"
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
					value={option.id}
					checked={selectedOptionId === option.id}
					aria-label={option.body}
					class="absolute inset-0 h-full w-full cursor-pointer opacity-0"
				/>

				<div class="flex items-center justify-center border border-ink px-2 py-1">
					<span class="text-xs font-bold text-ink">{String.fromCharCode(65 + i)}</span>
				</div>

				<div class="flex-1">
					<span class="text-base font-medium text-ink">{option.body}</span>
				</div>
			</label>
		{/each}
	</div>
</fieldset>
