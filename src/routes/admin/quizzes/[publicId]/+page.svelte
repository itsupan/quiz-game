<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import BlockerList from '$lib/features/admin/BlockerList.svelte';
	import PageHeader from '$lib/features/admin/PageHeader.svelte';
	import QuizForm from '$lib/features/quiz/admin/QuizForm.svelte';
	import QuizQuestionsEditor from '$lib/features/quiz/admin/QuizQuestionsEditor.svelte';
	import QuizSectionsEditor from '$lib/features/quiz/admin/QuizSectionsEditor.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
	const timestamp = new Intl.DateTimeFormat('en-CA', {
		dateStyle: 'medium',
		timeStyle: 'short'
	});
</script>

<div class="mx-auto max-w-[1400px] px-8 py-8">
	<PageHeader
		title={data.quiz.title}
		back={{ href: resolve('/admin/quizzes'), label: 'Quiz Sets' }}
	>
		{#snippet meta()}
			<StatusBadge status={data.quiz.status} />
			<span>Created {timestamp.format(data.quiz.createdAt)}</span>
			<span>Last updated {timestamp.format(data.quiz.updatedAt)}</span>
			{#if data.quiz.publishedAt}
				<span>First published {timestamp.format(data.quiz.publishedAt)}</span>
			{/if}
		{/snippet}

		{#snippet action()}
			<form method="POST" class="flex gap-2" use:enhance>
				{#if data.quiz.status !== 'PUBLISHED'}
					<button
						type="submit"
						formaction="?/publish"
						class="flex items-center gap-2 border border-brand-red bg-brand-red px-6 py-2 text-[10px] font-bold tracking-widest text-white uppercase transition-colors hover:bg-brand-red-dark"
					>
						Publish
					</button>
				{/if}
				{#if data.quiz.status !== 'ARCHIVED'}
					<ConfirmSubmit
						label="Archive"
						formaction="?/archive"
						title="Archive this quiz?"
						message="It disappears from the homepage immediately. Attempts already made against it keep working, and you can publish it again later."
						confirmLabel="Archive quiz"
					/>
				{/if}
			</form>
		{/snippet}
	</PageHeader>

	{#if form?.message}
		<Notice tone={form.ok ? 'success' : 'danger'} alert>{form.message}</Notice>
	{/if}

	{#if data.quiz.status !== 'PUBLISHED'}
		<BlockerList blockers={data.blockers} label="Blocking publication" />
	{/if}

	<h2 class="mt-8 mb-4 text-lg font-black tracking-tight text-ink uppercase">Details</h2>
	<QuizForm
		action="?/update"
		submitLabel="Save details"
		errors={form?.errors ?? {}}
		values={form?.values ?? {}}
		initial={{
			title: data.quiz.title,
			description: data.quiz.description ?? '',
			mode: data.quiz.mode,
			level: data.quiz.level,
			selectionMode: data.quiz.selectionMode,
			icon: data.quiz.icon,
			timeLimitSeconds: data.quiz.timeLimitSeconds,
			xpReward: data.quiz.xpReward
		}}
	/>

	<QuizSectionsEditor
		sections={data.sections}
		selectionMode={data.quiz.selectionMode}
		errors={form?.sectionErrors ?? {}}
	/>

	{#if data.quiz.selectionMode === 'FIXED'}
		<QuizQuestionsEditor
			quizPublicId={data.quiz.publicId}
			level={data.quiz.level}
			sections={data.sections}
			attached={data.attached}
			form={form ?? null}
		/>
	{/if}
</div>
