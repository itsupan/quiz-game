<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Field from '$lib/components/Field.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import PageHeader from '$lib/features/admin/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const dateFormat = new Intl.DateTimeFormat('en-CA');

	const size = (bytes: number) =>
		bytes < 1024 * 1024
			? `${Math.round(bytes / 1024)} KB`
			: `${(bytes / (1024 * 1024)).toFixed(1)} MB`;

	const described = (asset: (typeof data.items)[number]) =>
		asset.kind === 'IMAGE' ? Boolean(asset.altText?.trim()) : Boolean(asset.transcript?.trim());
</script>

<PageHeader
	title="Media"
	lede="{data.total} file{data.total === 1
		? ''
		: 's'}. Images and audio live in R2; only their metadata is stored in the database."
/>

{#if form?.message}
	<Notice tone={form.ok ? 'success' : 'danger'} alert>{form.message}</Notice>
{/if}

<form
	method="POST"
	action="?/upload"
	enctype="multipart/form-data"
	class="mb-7 border-2 border-ink bg-white p-5"
	use:enhance
>
	<h2 class="mt-0 text-lg font-black tracking-tight uppercase">Upload a file</h2>

	<Field
		id="file"
		label="File"
		hint="PNG, JPEG or WebP up to 10 MB; MP3, M4A or OGG up to 50 MB."
		required
	>
		{#snippet control(props)}
			<input
				{...props}
				type="file"
				name="file"
				accept="image/png,image/jpeg,image/webp,audio/mpeg,audio/mp4,audio/ogg"
				required
			/>
		{/snippet}
	</Field>

	<div class="grid grid-cols-[repeat(auto-fit,minmax(14rem,1fr))] gap-x-4">
		<Field
			id="altText"
			label="Alt text (images)"
			hint="Describes the image for anyone who cannot see it. Required before a question using it can be published."
		>
			{#snippet control(props)}
				<input {...props} type="text" name="altText" />
			{/snippet}
		</Field>

		<Field
			id="transcript"
			label="Transcript (audio)"
			hint="The spoken text. Required before a listening question using it can be published."
		>
			{#snippet control(props)}
				<textarea {...props} name="transcript"></textarea>
			{/snippet}
		</Field>
	</div>

	<Button type="submit" size="md">Upload</Button>
</form>

{#if data.items.length === 0}
	<p class="border-2 border-dashed border-line p-10 text-center text-muted" data-testid="empty">
		No files uploaded yet.
	</p>
{:else}
	<ul class="m-0 grid list-none grid-cols-[repeat(auto-fill,minmax(20rem,1fr))] gap-4 p-0">
		{#each data.items as asset (asset.publicId)}
			<li>
				<article class="h-full border-2 border-ink bg-white p-5">
					<header>
						<h3 class="mt-0 text-base font-black tracking-tight break-words">
							{asset.originalFilename ?? asset.r2Key}
						</h3>
						<p class="mt-0 mb-3 text-xs text-muted">
							{asset.kind.toLowerCase()} · {size(asset.byteSize)} · added
							{dateFormat.format(asset.createdAt)}
							{#if !described(asset)}
								<Badge tone="warning">not described</Badge>
							{/if}
						</p>
					</header>

					{#if asset.kind === 'IMAGE'}
						<img
							class="mb-3 block max-h-40 border border-line"
							src={resolve('/media/[publicId]', { publicId: asset.publicId })}
							alt={asset.altText ?? ''}
						/>
					{:else}
						<audio
							class="mb-3 w-full"
							controls
							src={resolve('/media/[publicId]', { publicId: asset.publicId })}
						></audio>
					{/if}

					<form method="POST" action="?/describe" use:enhance>
						<input type="hidden" name="assetId" value={asset.id} />

						{#if asset.kind === 'IMAGE'}
							<Field id="altText-{asset.id}" label="Alt text">
								{#snippet control(props)}
									<input {...props} type="text" name="altText" value={asset.altText ?? ''} />
								{/snippet}
							</Field>
						{:else}
							<Field id="transcript-{asset.id}" label="Transcript">
								{#snippet control(props)}
									<textarea {...props} name="transcript">{asset.transcript ?? ''}</textarea>
								{/snippet}
							</Field>
						{/if}

						<div class="mt-2 flex justify-end gap-2">
							<Button type="submit" variant="ghost" size="sm">Save description</Button>
						</div>
					</form>

					<form method="POST" action="?/delete" class="mt-2 flex justify-end gap-2" use:enhance>
						<input type="hidden" name="assetId" value={asset.id} />
						<ConfirmSubmit
							label="Delete"
							title="Delete this file?"
							message="This removes the file from storage permanently and cannot be undone. It is refused while any question or passage still uses it."
							confirmLabel="Delete permanently"
						/>
					</form>
				</article>
			</li>
		{/each}
	</ul>
{/if}
