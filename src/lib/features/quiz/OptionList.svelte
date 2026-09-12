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

	{#each options as option (option.id)}
		<label
			class="mb-2 flex items-center gap-3 border-2 border-line bg-white p-3 has-checked:border-ink has-checked:bg-paper has-disabled:opacity-60"
		>
			<input type="radio" {name} value={option.id} checked={selectedOptionId === option.id} />
			<span>{option.body}</span>
		</label>
	{/each}
</fieldset>
