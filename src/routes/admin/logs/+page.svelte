<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/Badge.svelte';
	import { AUDIT_ACTIONS, AUDIT_ENTITY_TYPES } from '$lib/domain/enums';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	function pageHref(number: number) {
		const query = new URLSearchParams({
			...Object.fromEntries(page.url.searchParams),
			page: String(number)
		});
		return resolve(`/admin/logs?${query}`);
	}

	function entityHref(entityType: string, publicId: string | null) {
		if (!publicId) return null;
		if (entityType === 'quiz') return resolve('/admin/quizzes/[publicId]', { publicId });
		if (entityType === 'question') return resolve('/admin/questions/[publicId]', { publicId });
		return null;
	}

	function actionTone(action: string): 'neutral' | 'success' | 'warning' | 'danger' {
		if (action.endsWith('_ARCHIVED') || action.endsWith('_DELETED')) return 'danger';
		if (action.endsWith('_PUBLISHED') || action.endsWith('_CREATED')) return 'success';
		return 'neutral';
	}

	function formatTimestamp(value: string | number | Date) {
		return new Date(value).toLocaleString(undefined, {
			dateStyle: 'medium',
			timeStyle: 'short'
		});
	}
</script>

<div class="mx-auto max-w-[1400px] px-8 py-8">
	<div class="mb-8 flex items-end justify-between border-b-2 border-ink pb-6">
		<div>
			<h1 class="m-0 text-3xl font-black tracking-tight text-ink">System Logs</h1>
			<p class="m-0 mt-1 text-sm text-muted">
				Audit trail of admin actions across users, quizzes, questions, and media.
			</p>
		</div>
	</div>

	<!-- Filters -->
	<form method="GET" class="mb-6 flex flex-wrap gap-4">
		<div class="w-64 border border-ink bg-stone-100 p-3 pb-4">
			<label
				class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
				for="filter-action">Filter by Action</label
			>
			<div class="relative flex items-center gap-2 border-b border-ink pb-1">
				<select
					id="filter-action"
					name="action"
					class="w-full appearance-none border-none bg-transparent p-0 pr-6 text-sm outline-none"
					onchange={(e) => e.currentTarget.form?.submit()}
				>
					<option value="">All Actions</option>
					{#each AUDIT_ACTIONS as action (action)}
						<option value={action} selected={data.filters.action === action}
							>{action.replaceAll('_', ' ')}</option
						>
					{/each}
				</select>
				<i
					class="fi fi-rs-angle-down pointer-events-none absolute right-0 text-muted"
					aria-hidden="true"
				></i>
			</div>
		</div>

		<div class="w-64 border border-ink bg-stone-100 p-3 pb-4">
			<label
				class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
				for="filter-entity">Filter by Entity</label
			>
			<div class="relative flex items-center gap-2 border-b border-ink pb-1">
				<select
					id="filter-entity"
					name="entityType"
					class="w-full appearance-none border-none bg-transparent p-0 pr-6 text-sm outline-none"
					onchange={(e) => e.currentTarget.form?.submit()}
				>
					<option value="">All Entities</option>
					{#each AUDIT_ENTITY_TYPES as entityType (entityType)}
						<option value={entityType} selected={data.filters.entityType === entityType}
							>{entityType.replaceAll('_', ' ')}</option
						>
					{/each}
				</select>
				<i
					class="fi fi-rs-angle-down pointer-events-none absolute right-0 text-muted"
					aria-hidden="true"
				></i>
			</div>
		</div>
	</form>

	{#if data.items.length === 0}
		<p
			class="border-2 border-dashed border-ink p-8 text-center text-sm font-bold tracking-widest text-muted uppercase"
			data-testid="empty"
		>
			No log entries match these filters.
		</p>
	{:else}
		<!-- Table -->
		<div class="overflow-x-auto border border-ink bg-stone-50">
			<table class="w-full min-w-[800px] border-collapse text-left">
				<thead>
					<tr class="border-b border-ink bg-stone-100">
						<th
							class="w-44 border-r border-ink px-4 py-3 text-[10px] font-bold tracking-widest text-ink uppercase"
							>Date / Time</th
						>
						<th
							class="border-r border-ink px-4 py-3 text-[10px] font-bold tracking-widest text-ink uppercase"
							>Actor</th
						>
						<th
							class="border-r border-ink px-4 py-3 text-[10px] font-bold tracking-widest text-ink uppercase"
							>Action</th
						>
						<th class="px-4 py-3 text-[10px] font-bold tracking-widest text-ink uppercase"
							>Target</th
						>
					</tr>
				</thead>
				<tbody class="bg-white text-sm">
					{#each data.items as entry (entry.id)}
						{@const href = entityHref(entry.entityType, entry.entityPublicId)}
						<tr class="border-b border-ink transition-colors hover:bg-stone-50">
							<td class="border-r border-ink px-4 py-4 whitespace-nowrap text-muted">
								{formatTimestamp(entry.createdAt)}
							</td>
							<td class="border-r border-ink px-4 py-4">
								{entry.actorName ?? 'System'}
							</td>
							<td class="border-r border-ink px-4 py-4">
								<Badge tone={actionTone(entry.action)}>{entry.action.replaceAll('_', ' ')}</Badge>
							</td>
							<td class="px-4 py-4">
								{#if href}
									<a
										{href}
										class="font-semibold text-ink underline decoration-line-strong underline-offset-2 hover:text-brand-red"
										>{entry.entityLabel}</a
									>
								{:else}
									{entry.entityLabel}
								{/if}
							</td>
						</tr>
					{/each}
				</tbody>
			</table>

			<!-- Pagination -->
			<div class="flex items-center justify-between border-t border-ink p-4">
				<div class="text-[10px] font-bold tracking-widest text-muted uppercase">
					Showing {(data.page - 1) * 25 + 1}-{(data.page - 1) * 25 + data.items.length} of {data.total ||
						0}
				</div>
				<div class="flex gap-1">
					<a
						href={pageHref(Math.max(1, data.page - 1))}
						aria-label="Previous page"
						class="flex h-6 w-6 items-center justify-center border border-ink bg-white text-[10px] transition-colors hover:bg-stone-50"
						><i class="fi fi-rs-angle-left" aria-hidden="true"></i></a
					>
					<span
						class="flex h-6 w-6 items-center justify-center border border-ink bg-brand-red text-[10px] font-bold text-white"
						>{data.page}</span
					>
					{#if data.page < (data.pageCount || 1)}
						<a
							href={pageHref(data.page + 1)}
							class="flex h-6 w-6 items-center justify-center border border-ink bg-white text-[10px] font-bold transition-colors hover:bg-stone-50"
							>{data.page + 1}</a
						>
					{/if}
					<a
						href={pageHref(Math.min(data.pageCount || 1, data.page + 1))}
						aria-label="Next page"
						class="flex h-6 w-6 items-center justify-center border border-ink bg-white text-[10px] transition-colors hover:bg-stone-50"
						><i class="fi fi-rs-angle-right" aria-hidden="true"></i></a
					>
				</div>
			</div>
		</div>
	{/if}
</div>
