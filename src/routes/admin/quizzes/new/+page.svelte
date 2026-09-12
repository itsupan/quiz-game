<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/features/admin/PageHeader.svelte';
	import QuizForm from '$lib/features/admin/quizzes/QuizForm.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<PageHeader
	title="New quiz"
	lede="Sections are configured on the next screen, once the quiz exists."
	back={{ href: resolve('/admin/quizzes'), label: 'Quizzes' }}
/>

<QuizForm
	submitLabel="Create quiz"
	errors={form?.errors ?? {}}
	values={form?.values ?? {}}
	initial={{
		title: '',
		description: '',
		mode: 'JLPT_PRACTICE',
		level: 'N4',
		selectionMode: 'FIXED',
		timeLimitSeconds: null
	}}
/>
