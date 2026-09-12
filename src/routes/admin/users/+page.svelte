<script lang="ts">
	import { enhance } from '$app/forms';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import FilterBar from '$lib/features/admin/FilterBar.svelte';
	import PageHeader from '$lib/features/admin/PageHeader.svelte';
	import Pagination from '$lib/features/admin/Pagination.svelte';
	import { USER_ROLES, USER_STATUS } from '$lib/domain/enums';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const dateFormat = new Intl.DateTimeFormat('en-CA');

	function pageHref(number: number) {
		const query = new URLSearchParams({
			...Object.fromEntries(page.url.searchParams),
			page: String(number)
		});
		return resolve(`/admin/users?${query}`);
	}
</script>

<PageHeader title="Users" lede="{data.total} in total." />

{#if form?.message}
	<Notice tone={form.ok ? 'success' : 'danger'} alert>{form.message}</Notice>
{/if}

<FilterBar>
	<label class="max-w-sm flex-1">
		<span class="visually-hidden">Search</span>
		<!-- Using value from data.filters directly to keep the input populated -->
		<input
			type="search"
			name="search"
			placeholder="Search name or email..."
			value={data.filters.search ?? ''}
		/>
	</label>
	<Button type="submit" variant="secondary" size="sm">Search</Button>
</FilterBar>

{#if data.items.length === 0}
	<p class="border-2 border-dashed border-line p-6 text-center text-muted" data-testid="empty">
		No users match these filters.
	</p>
{:else}
	<div class="overflow-x-auto border-2 border-ink bg-white">
		<table>
			<thead>
				<tr>
					<th scope="col">Name</th>
					<th scope="col">Email</th>
					<th scope="col">Role</th>
					<th scope="col">Status</th>
					<th scope="col">Last Login</th>
					<th scope="col">Created</th>
				</tr>
			</thead>
			<tbody>
				{#each data.items as user (user.publicId)}
					<tr>
						<td class="font-semibold">{user.displayName}</td>
						<td class="text-muted">{user.email}</td>
						<td>
							<form method="POST" action="?/updateRole" use:enhance>
								<input type="hidden" name="publicId" value={user.publicId} />
								<select
									name="role"
									value={user.role}
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
									class="rounded border-line px-2 py-1 text-sm"
								>
									{#each USER_ROLES as role (role)}
										<option value={role}>{role}</option>
									{/each}
								</select>
							</form>
						</td>
						<td>
							<form method="POST" action="?/updateStatus" use:enhance>
								<input type="hidden" name="publicId" value={user.publicId} />
								<select
									name="status"
									value={user.status}
									onchange={(e) => e.currentTarget.form?.requestSubmit()}
									class="rounded border-line px-2 py-1 text-sm"
								>
									{#each USER_STATUS as status (status)}
										<option value={status}>{status}</option>
									{/each}
								</select>
							</form>
						</td>
						<td class="whitespace-nowrap text-muted tabular-nums">
							{user.lastLoginAt ? dateFormat.format(user.lastLoginAt) : 'Never'}
						</td>
						<td class="whitespace-nowrap text-muted tabular-nums">
							{dateFormat.format(user.createdAt)}
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<Pagination page={data.page} pageCount={data.pageCount} href={pageHref} />
{/if}
