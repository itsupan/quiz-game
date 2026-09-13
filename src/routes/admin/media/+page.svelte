<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { enhance } from '$app/forms';
	import Button from '$lib/components/Button.svelte';
	import Card from '$lib/components/Card.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import Field from '$lib/components/Field.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import FilterBar from '$lib/features/admin/FilterBar.svelte';
	import Pagination from '$lib/features/admin/Pagination.svelte';
	import PageHeader from '$lib/features/admin/PageHeader.svelte';
	import { MEDIA_KINDS } from '$lib/domain/enums';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	function pageHref(number: number) {
		const query = new URLSearchParams({
			...Object.fromEntries(page.url.searchParams),
			page: String(number)
		});
		return resolve(`/admin/media?${query}`);
	}
</script>

<div class="mx-auto max-w-[1400px] px-8 py-8">
	<PageHeader
		title="Media Library"
		lede="Upload images and audio here, then reference the Media ID when authoring a question — by hand or through a CSV import."
	/>

	{#if form?.message}
		<Notice tone={form.ok ? 'success' : 'danger'} alert>{form.message}</Notice>
	{/if}

	<details class="mb-6 border-2 border-ink bg-stone-50 open:pb-2">
		<summary class="cursor-pointer px-5 py-4 text-sm font-black tracking-tight uppercase"
			>Upload a file</summary
		>
		<form
			method="POST"
			action="?/upload"
			enctype="multipart/form-data"
			use:enhance
			class="grid gap-4 px-5 pb-5 md:grid-cols-3"
		>
			<Field id="file" label="File" required>
				{#snippet control(props)}
					<input
						{...props}
						type="file"
						name="file"
						accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/mp4,audio/ogg"
						required
						class="w-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none"
					/>
				{/snippet}
			</Field>
			<Field
				id="altText"
				label="Alt text"
				hint="Images only — required before a question using it can publish."
			>
				{#snippet control(props)}
					<input
						{...props}
						type="text"
						name="altText"
						class="w-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
						placeholder="Describes the image for a screen reader"
					/>
				{/snippet}
			</Field>
			<Field
				id="transcript"
				label="Transcript"
				hint="Audio only — required before a question using it can publish."
			>
				{#snippet control(props)}
					<textarea
						{...props}
						name="transcript"
						class="min-h-10 w-full resize-y border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
						placeholder="What is said in the clip"></textarea>
				{/snippet}
			</Field>
			<div class="md:col-span-3">
				<Button type="submit" size="md">Upload</Button>
				<span class="ml-3 text-xs text-muted"
					>PNG, JPEG, WebP (10 MB max) or MP3, M4A, OGG (50 MB max).</span
				>
			</div>
		</form>
	</details>

	<FilterBar>
		<label>
			Kind
			<select name="kind" onchange={(e) => e.currentTarget.form?.submit()}>
				<option value="">All</option>
				{#each MEDIA_KINDS as kind (kind)}
					<option value={kind} selected={data.filters.kind === kind}>{kind}</option>
				{/each}
			</select>
		</label>
	</FilterBar>

	{#if data.items.length === 0}
		<p
			class="border-2 border-dashed border-line p-8 text-center text-sm font-bold tracking-widest text-muted uppercase"
		>
			No media uploaded yet.
		</p>
	{:else}
		<div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
			{#each data.items as asset (asset.id)}
				<Card class="flex flex-col gap-3 p-4">
					<div class="flex items-center justify-between">
						<Badge tone={asset.kind === 'IMAGE' ? 'success' : 'neutral'}>{asset.kind}</Badge>
						<ConfirmSubmit
							label="Delete"
							title="Delete this file?"
							message="This permanently removes the file. It's refused while any question or passage still uses it."
							confirmLabel="Delete"
							form="delete-{asset.id}"
						/>
					</div>

					{#if asset.kind === 'IMAGE'}
						<img
							src="/media/{asset.publicId}"
							alt={asset.altText ?? ''}
							class="h-32 w-full border border-line-strong object-cover"
						/>
					{:else}
						<audio controls src="/media/{asset.publicId}" class="w-full"></audio>
					{/if}

					<p
						class="m-0 truncate text-sm font-semibold text-ink"
						title={asset.originalFilename ?? ''}
					>
						{asset.originalFilename ?? asset.r2Key}
					</p>

					<label class="flex flex-col gap-1 text-xs font-bold tracking-widest text-muted uppercase">
						Media ID
						<input
							readonly
							value={asset.id}
							onclick={(e) => e.currentTarget.select()}
							class="border border-line-strong bg-stone-50 px-2 py-1 text-sm font-normal tracking-normal text-ink normal-case"
						/>
					</label>

					<form
						id="describe-{asset.id}"
						method="POST"
						action="?/updateDescription"
						use:enhance
						class="flex flex-col gap-2"
					>
						<input type="hidden" name="assetId" value={asset.id} />
						{#if asset.kind === 'IMAGE'}
							<Field id="altText-{asset.id}" label="Alt text">
								{#snippet control(props)}
									<input
										{...props}
										type="text"
										name="altText"
										value={asset.altText ?? ''}
										class="w-full border border-line-strong bg-white px-2 py-1 text-sm outline-none focus:border-brand-red"
									/>
								{/snippet}
							</Field>
						{:else}
							<Field id="transcript-{asset.id}" label="Transcript">
								{#snippet control(props)}
									<textarea
										{...props}
										name="transcript"
										class="min-h-10 w-full resize-y border border-line-strong bg-white px-2 py-1 text-sm outline-none focus:border-brand-red"
										>{asset.transcript ?? ''}</textarea
									>
								{/snippet}
							</Field>
						{/if}
						<Button type="submit" variant="ghost" size="sm">Save</Button>
					</form>

					<form id="delete-{asset.id}" method="POST" action="?/delete" use:enhance class="hidden">
						<input type="hidden" name="assetId" value={asset.id} />
					</form>
				</Card>
			{/each}
		</div>

		<Pagination page={data.page} pageCount={data.pageCount} href={pageHref} />
	{/if}
</div>
