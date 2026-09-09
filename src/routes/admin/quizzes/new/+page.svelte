<script lang="ts">
	import { resolve } from '$app/paths';
	import QuizForm from '$lib/features/admin/QuizForm.svelte';
	import type { PageProps } from './$types';

	let { form }: PageProps = $props();
</script>

<p class="crumb"><a href={resolve('/admin/quizzes')}>← Quizzes</a></p>
<h1>New quiz</h1>
<p class="lede">Sections are configured on the next screen, once the quiz exists.</p>

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

<style>
	.crumb {
		margin: 0 0 0.25rem;
		font-size: 0.875rem;
	}

	.crumb a {
		text-decoration: none;
		color: var(--ink-muted);
	}

	.lede {
		margin: 0 0 1.25rem;
		color: var(--ink-muted);
	}
</style>
