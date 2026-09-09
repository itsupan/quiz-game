<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import QuestionForm from '$lib/features/admin/QuestionForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const timestamp = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' });
</script>

<p class="crumb"><a href={resolve('/admin/questions')}>← Questions</a></p>

<div class="head">
	<div>
		<h1>Edit question</h1>
		<p class="meta">
			<StatusBadge status={data.question.status} />
			<span>Created {timestamp.format(data.question.createdAt)}</span>
			<span>Last updated {timestamp.format(data.question.updatedAt)}</span>
		</p>
	</div>

	<div class="status-actions">
		<form method="POST" use:enhance>
			{#if data.question.status !== 'PUBLISHED'}
				<button type="submit" formaction="?/publish" class="primary">Publish</button>
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
	</div>
</div>

{#if form?.message}
	<p class="notice" class:bad={!form.ok} role="alert">{form.message}</p>
{/if}

{#if data.blockers.length > 0 && data.question.status !== 'PUBLISHED'}
	<ul class="blockers" aria-label="Blocking publication">
		{#each data.blockers as blocker (blocker)}
			<li>{blocker}</li>
		{/each}
	</ul>
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

<style>
	.crumb {
		margin: 0 0 0.25rem;
		font-size: 0.875rem;
	}

	.crumb a {
		text-decoration: none;
		color: var(--ink-muted);
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin: 0;
		font-size: 0.8125rem;
		color: var(--ink-muted);
	}

	.status-actions form {
		display: flex;
		gap: 0.5rem;
	}

	.primary {
		padding: 0.4375rem 0.75rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 0.875rem;
		font-weight: 550;
	}

	.notice {
		padding: 0.625rem 0.875rem;
		border-radius: var(--radius-sm);
		margin: 0 0 1rem;
		background: var(--success-soft);
		border: 1px solid color-mix(in srgb, var(--success) 25%, transparent);
		color: var(--success);
	}

	.notice.bad {
		background: var(--danger-soft);
		border-color: color-mix(in srgb, var(--danger) 25%, transparent);
		color: var(--danger);
	}

	.blockers {
		margin: 0 0 1rem;
		padding: 0.75rem 0.875rem 0.75rem 2rem;
		background: var(--warning-soft);
		border: 1px solid color-mix(in srgb, var(--warning) 25%, transparent);
		border-radius: var(--radius-sm);
		color: var(--warning);
		font-size: 0.875rem;
	}
</style>
