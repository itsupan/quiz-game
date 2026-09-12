<script lang="ts">
	import { resolve } from '$app/paths';
	import Notice from '$lib/components/Notice.svelte';
	import PageHeader from '$lib/features/admin/PageHeader.svelte';
	import QuestionForm from '$lib/features/questions/QuestionForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<PageHeader title="New question" back={{ href: resolve('/admin/questions'), label: 'Questions' }} />

{#if form?.message}
	<Notice tone="danger" alert>{form.message}</Notice>
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
