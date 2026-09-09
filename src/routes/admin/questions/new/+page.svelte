<script lang="ts">
	import { resolve } from '$app/paths';
	import QuestionForm from '$lib/features/admin/QuestionForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<p class="crumb"><a href={resolve('/admin/questions')}>← Questions</a></p>
<h1>New question</h1>

{#if form?.message}
	<p class="error" role="alert">{form.message}</p>
{/if}

<QuestionForm
	submitLabel="Create question"
	errors={form?.errors ?? {}}
	values={form?.values ?? {}}
	submitted={form?.submitted}
	media={data.media}
	initial={{
		stem: '',
		explanation: '',
		level: 'N4',
		section: 'VOCAB_KANJI',
		points: 1,
		imageMediaId: null,
		audioMediaId: null,
		options: []
	}}
/>

<style>
	.crumb {
		margin: 0 0 0.25rem;
		font-size: 0.875rem;
	}

	.crumb a {
		text-decoration: none;
		color: var(--ink-muted);
	}

	.error {
		padding: 0.625rem 0.875rem;
		background: var(--danger-soft);
		border: 1px solid color-mix(in srgb, var(--danger) 25%, transparent);
		border-radius: var(--radius-sm);
		color: var(--danger);
	}
</style>
