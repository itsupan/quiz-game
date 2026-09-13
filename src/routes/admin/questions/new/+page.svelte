<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import PageHeader from '$lib/features/admin/PageHeader.svelte';
	import QuestionForm from '$lib/features/questions/QuestionForm.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<div class="p-8">
	<PageHeader
		title="New question"
		back={{ href: resolve('/admin/questions'), label: 'Questions' }}
	/>

	{#if form?.message}
		<Notice tone="danger" alert>{form.message}</Notice>
	{/if}

	<QuestionForm
		errors={form?.errors ?? {}}
		values={form?.values ?? {}}
		submitted={form?.submitted}
		initial={{
			stem: '',
			explanation: '',
			level: 'N4',
			section: 'VOCAB_KANJI',
			points: 1,
			options: []
		}}
	/>

	<div class="mt-8 flex justify-end border-t border-line pt-6">
		<Button type="submit" form="edit-question-form" size="md">Create question</Button>
	</div>
</div>
