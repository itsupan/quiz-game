<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import { CONTENT_STATUS, JLPT_LEVELS, QUIZ_MODES } from '$lib/domain/enums';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const dateFormat = new Intl.DateTimeFormat('en-CA');

	/** Keeps the active filters when paging, rather than resetting to an unfiltered list. */
	function pageHref(number: number) {
		// Built in one shot rather than mutated, so this stays a plain value.
		const query = new URLSearchParams({
			...Object.fromEntries(page.url.searchParams),
			page: String(number)
		});

		return resolve(`/admin/quizzes?${query}`);
	}

	const minutes = (seconds: number | null) =>
		seconds === null ? 'untimed' : `${seconds / 60} min`;
</script>

<div class="head">
	<div>
		<h1>Quizzes</h1>
		<p class="lede">{data.total} in total.</p>
	</div>
	<a class="primary" href={resolve('/admin/quizzes/new')}>New quiz</a>
</div>

{#if form?.message}
	<p class="notice" class:bad={!form.ok} role="alert">{form.message}</p>
{/if}

<form class="filters" method="GET">
	<label>
		<span>Status</span>
		<select name="status" value={data.filters.status ?? ''}>
			<option value="">Any</option>
			{#each CONTENT_STATUS as status (status)}<option value={status}>{status}</option>{/each}
		</select>
	</label>
	<label>
		<span>Level</span>
		<select name="level" value={data.filters.level ?? ''}>
			<option value="">Any</option>
			{#each JLPT_LEVELS as level (level)}<option value={level}>{level}</option>{/each}
		</select>
	</label>
	<label>
		<span>Mode</span>
		<select name="mode" value={data.filters.mode ?? ''}>
			<option value="">Any</option>
			{#each QUIZ_MODES as mode (mode)}<option value={mode}>{mode}</option>{/each}
		</select>
	</label>
	<button type="submit">Apply</button>
</form>

{#if data.items.length === 0}
	<p class="empty" data-testid="empty">
		No quizzes match these filters. <a href={resolve('/admin/quizzes/new')}>Add one</a>.
	</p>
{:else}
	<table>
		<thead>
			<tr>
				<th scope="col">Title</th>
				<th scope="col">Mode</th>
				<th scope="col">Level</th>
				<th scope="col">Sections</th>
				<th scope="col">Time</th>
				<th scope="col">Status</th>
				<th scope="col">Updated</th>
				<th scope="col"><span class="visually-hidden">Actions</span></th>
			</tr>
		</thead>
		<tbody>
			{#each data.items as quiz (quiz.publicId)}
				<tr>
					<td>
						<a href={resolve('/admin/quizzes/[publicId]', { publicId: quiz.publicId })}>
							{quiz.title}
						</a>
					</td>
					<td>{quiz.mode}</td>
					<td>{quiz.level}</td>
					<td>
						{quiz.sectionCount}
						{#if quiz.sectionCount === 0}
							<span class="flag">no sections</span>
						{/if}
					</td>
					<td class="when">{minutes(quiz.timeLimitSeconds)}</td>
					<td><StatusBadge status={quiz.status} /></td>
					<td class="when">{dateFormat.format(quiz.updatedAt)}</td>
					<td class="actions">
						{#if quiz.status !== 'ARCHIVED'}
							<form method="POST" action="?/archive" use:enhance>
								<input type="hidden" name="publicId" value={quiz.publicId} />
								<ConfirmSubmit
									label="Archive"
									title="Archive this quiz?"
									message="It disappears from the homepage immediately. Attempts already made against it keep working, and you can publish it again later."
									confirmLabel="Archive quiz"
								/>
							</form>
						{/if}
					</td>
				</tr>
			{/each}
		</tbody>
	</table>

	{#if data.pageCount > 1}
		<nav class="pages" aria-label="Pagination">
			{#each { length: data.pageCount }, index (index)}
				<a
					href={pageHref(index + 1)}
					aria-current={data.page === index + 1 ? 'page' : undefined}
					aria-label="Page {index + 1}"
				>
					{index + 1}
				</a>
			{/each}
		</nav>
	{/if}
{/if}

<style>
	.head {
		display: flex;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.25rem;
	}

	.lede {
		margin: 0;
		color: var(--ink-muted);
	}

	.primary {
		padding: 0.5rem 0.875rem;
		background: var(--accent);
		color: var(--accent-ink);
		border-radius: var(--radius-sm);
		text-decoration: none;
		font-size: 0.9375rem;
		font-weight: 550;
		white-space: nowrap;
	}

	.notice {
		padding: 0.625rem 0.875rem;
		background: var(--success-soft);
		border: 1px solid color-mix(in srgb, var(--success) 25%, transparent);
		border-radius: var(--radius-sm);
		color: var(--success);
		margin: 0 0 1rem;
	}

	.notice.bad {
		background: var(--danger-soft);
		border-color: color-mix(in srgb, var(--danger) 25%, transparent);
		color: var(--danger);
	}

	.filters {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-end;
		gap: 0.75rem;
		padding: 0.875rem 1rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		margin-bottom: 1rem;
	}

	.filters label {
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
		font-size: 0.8125rem;
		font-weight: 600;
	}

	.filters select {
		min-width: 9rem;
	}

	.filters button {
		padding: 0.5rem 0.875rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: 0.875rem;
		font-weight: 550;
	}

	table {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.flag {
		display: inline-block;
		margin-left: 0.375rem;
		padding: 0.0625rem 0.375rem;
		border-radius: 999px;
		background: var(--warning-soft);
		color: var(--warning);
		font-size: 0.75rem;
		font-weight: 600;
	}

	.when {
		color: var(--ink-muted);
		font-size: 0.875rem;
		white-space: nowrap;
	}

	.actions {
		text-align: right;
	}

	.empty {
		padding: 2.5rem 1rem;
		text-align: center;
		color: var(--ink-muted);
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}

	.pages {
		display: flex;
		gap: 0.25rem;
		margin-top: 1rem;
	}

	.pages a {
		padding: 0.25rem 0.625rem;
		border: 1px solid var(--line);
		border-radius: var(--radius-sm);
		background: var(--surface);
		text-decoration: none;
	}

	.pages a[aria-current='page'] {
		background: var(--accent-soft);
		border-color: var(--accent);
	}
</style>
