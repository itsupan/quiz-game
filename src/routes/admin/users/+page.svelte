<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Notice from '$lib/components/Notice.svelte';
	import { JLPT_LEVELS } from '$lib/domain/enums';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	function pageHref(number: number) {
		const query = new URLSearchParams({
			...Object.fromEntries(page.url.searchParams),
			page: String(number)
		});
		return resolve(`/admin/users?${query}`);
	}
</script>

<div class="mx-auto max-w-[1400px] px-8 py-8">
	<!-- Header -->
	<div class="mb-8 flex items-end justify-between border-b-2 border-ink pb-6">
		<div>
			<h1 class="m-0 text-3xl font-black tracking-tight text-ink">User Management</h1>
			<p class="m-0 mt-1 text-sm text-muted">Manage students, progress, and system access.</p>
		</div>
		<a
			href={resolve('/admin/users')}
			class="flex items-center gap-2 border-2 border-ink bg-brand-red px-6 py-2.5 text-sm font-bold tracking-widest text-white shadow-[4px_4px_0px_0px_#1b1b18] transition-colors hover:bg-brand-red-dark"
		>
			<i class="fi fi-rs-user-add" aria-hidden="true"></i> Add New User
		</a>
	</div>

	{#if form?.message}
		<Notice tone={form.ok ? 'success' : 'danger'} alert>{form.message}</Notice>
	{/if}

	<!-- Filters -->
	<form method="GET" class="mb-6 flex flex-wrap gap-4">
		<!-- Search -->
		<div class="min-w-[300px] flex-1 border border-ink bg-stone-100 p-3 pb-4">
			<label
				class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
				for="search-users">Search Users</label
			>
			<div class="flex items-center gap-2 border-b border-ink pb-1">
				<i class="fi fi-rs-search text-muted" aria-hidden="true"></i>
				<input
					id="search-users"
					type="search"
					name="search"
					placeholder="Name, Email, or ID..."
					value={data.filters.search ?? ''}
					class="w-full border-none bg-transparent p-0 text-sm placeholder-muted outline-none"
				/>
			</div>
		</div>
		<!-- Filter by Level -->
		<div class="w-64 border border-ink bg-stone-100 p-3 pb-4">
			<label
				class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
				for="filter-level">Filter by Level</label
			>
			<div class="relative flex items-center gap-2 border-b border-ink pb-1">
				<select
					id="filter-level"
					name="level"
					class="w-full appearance-none border-none bg-transparent p-0 pr-6 text-sm outline-none"
					onchange={(e) => e.currentTarget.form?.submit()}
				>
					<option value="">All Levels</option>
					{#each JLPT_LEVELS as level (level)}
						<option value={level} selected={data.filters.level === level}>{level}</option>
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
			No users match these filters.
		</p>
	{:else}
		<!-- Table -->
		<div class="overflow-x-auto border border-ink bg-stone-50">
			<table class="w-full min-w-[800px] border-collapse text-left">
				<thead>
					<tr class="border-b border-ink bg-stone-100">
						<th
							class="border-r border-ink px-4 py-3 text-[10px] font-bold tracking-widest text-ink uppercase"
							>Name</th
						>
						<th
							class="border-r border-ink px-4 py-3 text-[10px] font-bold tracking-widest text-ink uppercase"
							>Email</th
						>
						<th
							class="w-32 border-r border-ink px-4 py-3 text-center text-[10px] font-bold tracking-widest text-ink uppercase"
							>Level</th
						>
						<th
							class="w-32 border-r border-ink px-4 py-3 text-center text-[10px] font-bold tracking-widest text-ink uppercase"
							>Status</th
						>
						<th
							class="relative w-16 px-4 py-3 text-center text-[10px] font-bold tracking-widest text-ink uppercase"
						>
							Actions
							<div class="absolute top-0 right-0 h-full w-4 bg-brand-red"></div>
						</th>
					</tr>
				</thead>
				<tbody class="bg-white text-sm">
					{#each data.items as user (user.publicId)}
						<tr class="border-b border-ink transition-colors hover:bg-stone-50">
							<td class="border-r border-ink px-4 py-4">{user.displayName}</td>
							<td class="border-r border-ink px-4 py-4 text-muted">{user.email}</td>
							<td class="border-r border-ink px-4 py-4 text-center">
								{#if user.jlptLevel}
									<span
										class="inline-block px-1.5 py-0.5 text-[10px] font-bold tracking-widest text-white uppercase {user.jlptLevel ===
											'N1' || user.jlptLevel === 'N2'
											? 'bg-brand-red'
											: 'bg-ink'}"
									>
										{user.jlptLevel}
									</span>
								{:else}
									<span class="text-muted">-</span>
								{/if}
							</td>
							<td class="border-r border-ink px-4 py-4 text-center">
								<span
									class="text-[10px] font-bold tracking-widest uppercase {user.status === 'ACTIVE'
										? 'text-brand-red'
										: 'text-muted'}"
								>
									● {user.status}
								</span>
							</td>
							<td
								class="cursor-pointer px-4 py-4 text-center text-xl leading-none font-bold tracking-widest text-muted hover:text-ink"
							>
								···
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
