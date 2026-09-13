<script lang="ts">
	import { resolve } from '$app/paths';
	import PageHeader from '$lib/features/admin/PageHeader.svelte';
	import QuizForm from '$lib/features/quiz/admin/QuizForm.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<div class="mx-auto max-w-[1400px] px-8 py-8">
	<PageHeader
		title="New Quiz"
		lede="Sections are configured on the next screen, once the quiz exists."
		back={{ href: resolve('/admin/quizzes'), label: 'Quiz Sets' }}
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
			icon: 'book',
			timeLimitSeconds: null,
			xpReward: 0
		}}
	/>
</div>
