<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import FilterBar from '$lib/features/admin/FilterBar.svelte';
	import PageHeader from '$lib/features/admin/PageHeader.svelte';
	import Pagination from '$lib/features/admin/Pagination.svelte';
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

<PageHeader title="Quizzes" lede="{data.total} in total.">
	{#snippet action()}
		<Button href={resolve('/admin/quizzes/new')} size="md">New quiz</Button>
	{/snippet}
</PageHeader>

{#if form?.message}
	<Notice tone={form.ok ? 'success' : 'danger'} alert>{form.message}</Notice>
{/if}

<FilterBar>
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
	<Button type="submit" variant="secondary" size="sm">Apply</Button>
</FilterBar>

{#if data.items.length === 0}
	<p class="border-2 border-dashed border-line p-6 text-center text-muted" data-testid="empty">
		No quizzes match these filters. <a
			class="font-semibold text-brand-red"
			href={resolve('/admin/quizzes/new')}>Add one</a
		>.
	</p>
{:else}
	<div class="overflow-x-auto border-2 border-ink bg-white">
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
							<a
								class="font-semibold"
								href={resolve('/admin/quizzes/[publicId]', { publicId: quiz.publicId })}
							>
								{quiz.title}
							</a>
						</td>
						<td>{quiz.mode}</td>
						<td>{quiz.level}</td>
						<td>
							{quiz.sectionCount}
							{#if quiz.sectionCount === 0}
								<Badge tone="warning">no sections</Badge>
							{/if}
						</td>
						<td class="whitespace-nowrap text-muted tabular-nums">
							{minutes(quiz.timeLimitSeconds)}
						</td>
						<td><StatusBadge status={quiz.status} /></td>
						<td class="whitespace-nowrap text-muted tabular-nums">
							{dateFormat.format(quiz.updatedAt)}
						</td>
						<td class="text-right">
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
	</div>

	<Pagination page={data.page} pageCount={data.pageCount} href={pageHref} />
{/if}
