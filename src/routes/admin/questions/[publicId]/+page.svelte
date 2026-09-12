<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import Button from '$lib/components/Button.svelte';
	import BlockerList from '$lib/features/admin/BlockerList.svelte';
	import PageHeader from '$lib/features/admin/PageHeader.svelte';
	import QuestionForm from '$lib/features/questions/QuestionForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const timestamp = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<PageHeader title="Edit question" back={{ href: resolve('/admin/questions'), label: 'Questions' }}>
	{#snippet meta()}
		<StatusBadge status={data.question.status} />
		<span>Created {timestamp.format(data.question.createdAt)}</span>
		<span>Last updated {timestamp.format(data.question.updatedAt)}</span>
	{/snippet}

	{#snippet action()}
		<form method="POST" use:enhance class="flex gap-2">
			{#if data.question.status !== 'PUBLISHED'}
				<Button type="submit" size="sm" formaction="?/publish">Publish</Button>
			{/if}
			{#if data.question.status !== 'ARCHIVED'}
				<ConfirmSubmit
					label="Archive"
					formaction="?/archive"
					title="Archive this question?"
					message="It stops appearing in new quizzes. Past attempts that used it keep working, and you can publish it again later."
					confirmLabel="Archive question"
				/>
			{/if}
		</form>
	{/snippet}
</PageHeader>

{#if form?.message}
	<Notice tone={form.ok ? 'success' : 'danger'} alert>{form.message}</Notice>
{/if}

{#if data.question.status !== 'PUBLISHED'}
	<BlockerList blockers={data.blockers} label="Blocking publication" />
{/if}

<QuestionForm
	action="?/update"
	submitLabel="Save changes"
	errors={form?.errors ?? {}}
	values={form?.values ?? {}}
	submitted={form?.submitted}
	media={data.media}
	initial={{
		stem: data.question.stem,
		explanation: data.question.explanation ?? '',
		level: data.question.level,
		section: data.question.section,
		points: data.question.points,
		imageMediaId: data.question.imageMediaId,
		audioMediaId: data.question.audioMediaId,
		options: data.options.map((option) => ({
			id: option.id,
			body: option.body,
			isCorrect: option.isCorrect
		}))
	}}
/>
