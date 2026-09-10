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
	import { CONTENT_STATUS, JLPT_LEVELS, SECTIONS } from '$lib/domain/enums';
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

		return resolve(`/admin/questions?${query}`);
	}
</script>

<PageHeader title="Questions" lede="{data.total} in the bank.">
	{#snippet action()}
		<Button href={resolve('/admin/questions/new')} size="md">New question</Button>
	{/snippet}
</PageHeader>

{#if form?.message}
	<Notice tone={form.ok ? 'success' : 'danger'} alert>{form.message}</Notice>
{/if}

<FilterBar>
	<label>
		<span>Level</span>
		<select name="level" value={data.filters.level ?? ''}>
			<option value="">Any</option>
			{#each JLPT_LEVELS as level (level)}<option value={level}>{level}</option>{/each}
		</select>
	</label>
	<label>
		<span>Section</span>
		<select name="section" value={data.filters.section ?? ''}>
			<option value="">Any</option>
			{#each SECTIONS as section (section)}<option value={section}>{section}</option>{/each}
		</select>
	</label>
	<label>
		<span>Status</span>
		<select name="status" value={data.filters.status ?? ''}>
			<option value="">Any</option>
			{#each CONTENT_STATUS as status (status)}<option value={status}>{status}</option>{/each}
		</select>
	</label>
	<Button type="submit" variant="secondary" size="sm">Apply</Button>
</FilterBar>

{#if data.items.length === 0}
	<p class="border-2 border-dashed border-line p-6 text-center text-muted" data-testid="empty">
		No questions match these filters. <a
			class="font-semibold text-brand-red"
			href={resolve('/admin/questions/new')}>Add one</a
		>.
	</p>
{:else}
	<div class="overflow-x-auto border-2 border-ink bg-white">
		<table>
			<thead>
				<tr>
					<th scope="col">Question</th>
					<th scope="col">Level</th>
					<th scope="col">Section</th>
					<th scope="col">Options</th>
					<th scope="col">Status</th>
					<th scope="col">Updated</th>
					<th scope="col"><span class="visually-hidden">Actions</span></th>
				</tr>
			</thead>
			<tbody>
				{#each data.items as question (question.publicId)}
					<tr>
						<td>
							<a
								class="font-semibold"
								href={resolve('/admin/questions/[publicId]', { publicId: question.publicId })}
							>
								{question.stem}
							</a>
						</td>
						<td>{question.level}</td>
						<td>{question.section}</td>
						<td>
							{question.optionCount}
							{#if !question.hasAnswerKey}
								<!-- Surfaced in the list because a question without a key cannot be
								     published, and finding that out one edit page at a time is how a
								     draft sits broken for months. -->
								<Badge tone="warning">no answer key</Badge>
							{/if}
						</td>
						<td><StatusBadge status={question.status} /></td>
						<td class="whitespace-nowrap text-muted tabular-nums">
							{dateFormat.format(question.updatedAt)}
						</td>
						<td class="text-right">
							{#if question.status !== 'ARCHIVED'}
								<form method="POST" action="?/archive" use:enhance>
									<input type="hidden" name="publicId" value={question.publicId} />
									<ConfirmSubmit
										label="Archive"
										title="Archive this question?"
										message="It stops appearing in new quizzes. Past attempts that used it keep working, and you can publish it again later."
										confirmLabel="Archive question"
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
