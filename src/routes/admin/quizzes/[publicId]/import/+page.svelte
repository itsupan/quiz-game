<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Field from '$lib/components/Field.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import PageHeader from '$lib/features/admin/PageHeader.svelte';
	import { CSV_COLUMNS } from '$lib/features/questions/csv-import';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const COLUMN_NOTES: Record<string, string> = {
		stem: 'The question text. Required.',
		option_a: 'First answer option. Required.',
		option_b: 'Second answer option. Required.',
		option_c: 'Third option, or leave blank.',
		option_d: 'Fourth option, or leave blank.',
		option_e: 'Fifth option, or leave blank.',
		option_f: 'Sixth option, or leave blank.',
		correct_option: 'Letter A-F matching the correct option column. Required.',
		points: 'Whole number. Blank defaults to 1.',
		explanation: 'Shown to the learner on review. Optional.',
		image_media_id: 'A Media ID from the Media Library, or blank.',
		audio_media_id: 'A Media ID from the Media Library, or blank.'
	};
</script>

<div class="mx-auto max-w-4xl px-8 py-8">
	<PageHeader
		title="Import questions"
		lede="Bulk-add STANDARD multiple-choice questions to one quiz section from a CSV file."
		back={{
			href: resolve('/admin/quizzes/[publicId]', { publicId: data.quiz.publicId }),
			label: data.quiz.title
		}}
	/>

	{#if !data.section}
		<Notice tone="info">Choose which section this import targets.</Notice>
		<form
			method="GET"
			class="mt-4 flex flex-wrap items-end gap-3 border-2 border-ink bg-stone-50 p-6"
		>
			<div class="min-w-[16rem] flex-1">
				<Field id="section-picker" label="Section">
					{#snippet control(props)}
						<select
							{...props}
							name="section"
							class="w-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
						>
							{#each data.sections as section (section.id)}
								<option value={section.id}>{section.section}</option>
							{/each}
						</select>
					{/snippet}
				</Field>
			</div>
			<Button type="submit" size="md">Continue</Button>
		</form>
		{#if data.sections.length === 0}
			<p class="mt-4 text-sm text-muted">
				This quiz has no sections yet — add one on the quiz page first.
			</p>
		{/if}
	{:else}
		<p class="mb-6 text-sm text-muted">
			Importing into <strong class="text-ink">{data.section.section}</strong> at level
			<strong class="text-ink">{data.quiz.level}</strong>. Every row is created as a
			<Badge tone="warning">draft</Badge> and only published to the paper once you confirm below.
		</p>

		{#if form?.message}
			<Notice tone="danger" alert>{form.message}</Notice>
		{/if}

		{#if form?.committed}
			{@const { outcomes, rejected } = form.committed}
			<Notice tone={outcomes.some((o) => o.published) ? 'success' : 'warning'} alert>
				{outcomes.filter((o) => o.published).length} of {outcomes.length} imported question(s) were published
				and added to the paper. {rejected.length > 0
					? `${rejected.length} row(s) were skipped.`
					: ''}
			</Notice>

			{#if outcomes.some((o) => !o.published) || rejected.length > 0}
				<div class="mt-4 overflow-x-auto border-2 border-line">
					<table>
						<thead>
							<tr>
								<th scope="col">Line</th>
								<th scope="col">Status</th>
								<th scope="col">Reason</th>
							</tr>
						</thead>
						<tbody>
							{#each rejected as row (row.line)}
								<tr>
									<th scope="row">{row.line}</th>
									<td><Badge tone="danger">Not imported</Badge></td>
									<td>{row.errors.join(' ')}</td>
								</tr>
							{/each}
							{#each outcomes.filter((o) => !o.published) as row (row.line)}
								<tr>
									<th scope="row">{row.line}</th>
									<td><Badge tone="warning">Created as draft</Badge></td>
									<td>
										{row.message}
										<a href={resolve('/admin/questions/[publicId]', { publicId: row.publicId })}
											>Finish editing</a
										>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{/if}

			<div class="mt-6">
				<Button href={resolve('/admin/quizzes/[publicId]', { publicId: data.quiz.publicId })}
					>Back to the quiz</Button
				>
			</div>
		{:else if form?.preview && form.quizSectionId === data.section.id}
			{@const rows = form.preview}
			{@const validCount = rows.filter((r) => r.ok).length}
			<Notice tone={validCount > 0 ? 'info' : 'danger'}>
				{validCount} of {rows.length} row(s) are valid and ready to import.
			</Notice>

			<div class="mt-4 overflow-x-auto border-2 border-line">
				<table>
					<thead>
						<tr>
							<th scope="col">Line</th>
							<th scope="col">Status</th>
							<th scope="col">Detail</th>
						</tr>
					</thead>
					<tbody>
						{#each rows as row (row.line)}
							<tr>
								<th scope="row">{row.line}</th>
								<td>
									{#if row.ok}
										<Badge tone="success">Valid</Badge>
									{:else}
										<Badge tone="danger">Error</Badge>
									{/if}
								</td>
								<td>
									{#if row.ok}
										{row.stem} <span class="text-muted">({row.optionCount} options)</span>
									{:else}
										{row.errors.join(' ')}
									{/if}
								</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>

			{#if validCount > 0}
				<form method="POST" action="?/commit" use:enhance class="mt-6">
					<input type="hidden" name="quizSectionId" value={data.section.id} />
					<input type="hidden" name="csvText" value={form.csvText} />
					<Button type="submit" size="md">Publish & add {validCount} to this section</Button>
				</form>
			{/if}
		{:else}
			<form
				method="POST"
				action="?/preview"
				enctype="multipart/form-data"
				use:enhance
				class="flex flex-col gap-4 border-2 border-ink bg-stone-50 p-6"
			>
				<input type="hidden" name="quizSectionId" value={data.section.id} />
				<Field id="file" label="CSV file" required>
					{#snippet control(props)}
						<input
							{...props}
							type="file"
							name="file"
							accept=".csv,text/csv"
							required
							class="w-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none"
						/>
					{/snippet}
				</Field>
				<div>
					<Button type="submit" size="md">Preview import</Button>
					<!-- eslint-disable svelte/no-navigation-without-resolve -->
					<a
						href="/templates/question-import-template.csv"
						class="ml-3 text-xs font-semibold text-brand-red">Download a sample CSV</a
					>
					<!-- eslint-enable svelte/no-navigation-without-resolve -->
				</div>
			</form>

			<h2 class="mt-8 mb-2 text-sm font-black tracking-widest text-ink uppercase">Columns</h2>
			<div class="overflow-x-auto border-2 border-line">
				<table>
					<thead>
						<tr>
							<th scope="col">Column</th>
							<th scope="col">Meaning</th>
						</tr>
					</thead>
					<tbody>
						{#each CSV_COLUMNS as column (column)}
							<tr>
								<th scope="row"><code>{column}</code></th>
								<td>{COLUMN_NOTES[column]}</td>
							</tr>
						{/each}
					</tbody>
				</table>
			</div>
		{/if}
	{/if}
</div>
