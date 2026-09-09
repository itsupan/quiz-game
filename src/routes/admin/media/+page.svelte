<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import Field from '$lib/components/Field.svelte';
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

<h1>Media</h1>
<p class="lede">
	{data.total} file{data.total === 1 ? '' : 's'}. Images and audio live in R2; only their metadata
	is stored in the database.
</p>

{#if form?.message}
	<p class="notice" class:bad={!form.ok} role="alert">{form.message}</p>
{/if}

<form method="POST" action="?/upload" enctype="multipart/form-data" class="upload" use:enhance>
	<h2>Upload a file</h2>

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

	<div class="row">
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

	<button type="submit" class="primary">Upload</button>
</form>

{#if data.items.length === 0}
	<p class="empty" data-testid="empty">No files uploaded yet.</p>
{:else}
	<ul class="assets">
		{#each data.items as asset (asset.publicId)}
			<li>
				<article>
					<header>
						<h3>{asset.originalFilename ?? asset.r2Key}</h3>
						<p class="facts">
							{asset.kind.toLowerCase()} · {size(asset.byteSize)} · added
							{dateFormat.format(asset.createdAt)}
							{#if !described(asset)}
								<span class="flag">not described</span>
							{/if}
						</p>
					</header>

					{#if asset.kind === 'IMAGE'}
						<img
							src={resolve('/media/[publicId]', { publicId: asset.publicId })}
							alt={asset.altText ?? ''}
						/>
					{:else}
						<audio controls src={resolve('/media/[publicId]', { publicId: asset.publicId })}
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

						<div class="asset-actions">
							<button type="submit">Save description</button>
						</div>
					</form>

					<form method="POST" action="?/delete" class="asset-actions" use:enhance>
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

<style>
	.lede {
		margin: 0 0 1.25rem;
		color: var(--ink-muted);
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

	.upload,
	article {
		padding: 1.25rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}

	.upload {
		margin-bottom: 1.75rem;
	}

	.upload h2,
	article h3 {
		margin-top: 0;
	}

	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(14rem, 1fr));
		gap: 0 1rem;
	}

	.assets {
		display: grid;
		grid-template-columns: repeat(auto-fill, minmax(20rem, 1fr));
		gap: 1rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	.facts {
		margin: 0 0 0.75rem;
		font-size: 0.8125rem;
		color: var(--ink-muted);
	}

	.flag {
		display: inline-block;
		margin-left: 0.25rem;
		padding: 0.0625rem 0.375rem;
		border-radius: 999px;
		background: var(--warning-soft);
		color: var(--warning);
		font-weight: 600;
	}

	img {
		display: block;
		max-height: 10rem;
		margin-bottom: 0.75rem;
		border-radius: var(--radius-sm);
		border: 1px solid var(--line);
	}

	audio {
		width: 100%;
		margin-bottom: 0.75rem;
	}

	.asset-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
		margin-top: 0.5rem;
	}

	.asset-actions button {
		padding: 0.4375rem 0.75rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: 0.875rem;
		font-weight: 550;
	}

	.empty {
		padding: 2.5rem 1rem;
		text-align: center;
		color: var(--ink-muted);
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}

	.primary {
		padding: 0.5625rem 1rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 0.9375rem;
		font-weight: 600;
	}
</style>
