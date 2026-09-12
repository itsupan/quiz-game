<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import Field from '$lib/components/Field.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import BlockerList from '$lib/features/admin/BlockerList.svelte';
	import PageHeader from '$lib/features/admin/PageHeader.svelte';
	import QuizForm from '$lib/features/admin/quizzes/QuizForm.svelte';
	import { SECTIONS } from '$lib/domain/enums';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	const timestamp = new Intl.DateTimeFormat('en-CA', { dateStyle: 'medium', timeStyle: 'short' });

	const sectionErrors = $derived(form?.sectionErrors ?? {});

	/** Suggests the next free position so the common case needs no thought. */
	const nextPosition = $derived(
		data.sections.reduce((highest, section) => Math.max(highest, section.position), 0) + 1
	);

	const isRandom = $derived(data.quiz.selectionMode === 'RANDOM');

	const unusedSections = $derived(
		SECTIONS.filter((section) => !data.sections.some((existing) => existing.section === section))
	);
</script>

<PageHeader title={data.quiz.title} back={{ href: resolve('/admin/quizzes'), label: 'Quizzes' }}>
	{#snippet meta()}
		<StatusBadge status={data.quiz.status} />
		<span>Created {timestamp.format(data.quiz.createdAt)}</span>
		<span>Last updated {timestamp.format(data.quiz.updatedAt)}</span>
		{#if data.quiz.publishedAt}
			<span>First published {timestamp.format(data.quiz.publishedAt)}</span>
		{/if}
	{/snippet}

	{#snippet action()}
		<form method="POST" class="flex gap-2" use:enhance>
			{#if data.quiz.status !== 'PUBLISHED'}
				<Button type="submit" size="sm" formaction="?/publish">Publish</Button>
			{/if}
			{#if data.quiz.status !== 'ARCHIVED'}
				<ConfirmSubmit
					label="Archive"
					formaction="?/archive"
					title="Archive this quiz?"
					message="It disappears from the homepage immediately. Attempts already made against it keep working, and you can publish it again later."
					confirmLabel="Archive quiz"
				/>
			{/if}
		</form>
	{/snippet}
</PageHeader>

{#if form?.message}
	<Notice tone={form.ok ? 'success' : 'danger'} alert>{form.message}</Notice>
{/if}

{#if data.quiz.status !== 'PUBLISHED'}
	<BlockerList blockers={data.blockers} label="Blocking publication" />
{/if}

<h2 class="mt-8 text-lg font-black tracking-tight uppercase">Details</h2>
<QuizForm
	action="?/update"
	submitLabel="Save details"
	errors={form?.errors ?? {}}
	values={form?.values ?? {}}
	initial={{
		title: data.quiz.title,
		description: data.quiz.description ?? '',
		mode: data.quiz.mode,
		level: data.quiz.level,
		selectionMode: data.quiz.selectionMode,
		timeLimitSeconds: data.quiz.timeLimitSeconds
	}}
/>

<h2 class="mt-8 text-lg font-black tracking-tight uppercase">Sections</h2>
<p class="mt-0 mb-4 text-sm text-muted">
	The structure of the paper: which content section, in what order, with its own optional time
	limit.{#if isRandom}
		This quiz draws at random, so each section says how many questions it pulls from the bank.{/if}
</p>

{#if data.sections.length > 0}
	<div class="overflow-x-auto border-2 border-ink bg-white">
		<table>
			<thead>
				<tr>
					<th scope="col">Section</th>
					<th scope="col">Position</th>
					<th scope="col">Time limit (min)</th>
					<th scope="col">Questions drawn</th>
					<th scope="col"><span class="visually-hidden">Actions</span></th>
				</tr>
			</thead>
			<tbody>
				{#each data.sections as section (section.id)}
					<tr>
						<th scope="row">{section.section}</th>
						<td>
							<!-- Editable, not just listed: switching a quiz to RANDOM leaves its
						     existing sections without a draw count, and without this there
						     would be no way to supply one short of deleting the section. -->
							<label class="visually-hidden" for="position-{section.id}">
								Position for {section.section}
							</label>
							<input
								id="position-{section.id}"
								form="section-{section.id}"
								type="number"
								name="position"
								min="1"
								value={section.position}
							/>
						</td>
						<td>
							<label class="visually-hidden" for="minutes-{section.id}">
								Time limit in minutes for {section.section}
							</label>
							<input
								id="minutes-{section.id}"
								form="section-{section.id}"
								type="number"
								name="timeLimitMinutes"
								min="1"
								placeholder="none"
								value={section.timeLimitSeconds === null ? '' : section.timeLimitSeconds / 60}
							/>
						</td>
						<td>
							{#if isRandom}
								<label class="visually-hidden" for="draw-{section.id}">
									Questions drawn for {section.section}
								</label>
								<input
									id="draw-{section.id}"
									form="section-{section.id}"
									type="number"
									name="drawCount"
									min="1"
									aria-invalid={section.drawCount === null ? 'true' : undefined}
									value={section.drawCount ?? ''}
								/>
							{:else}
								<span class="text-sm text-muted">not drawn</span>
							{/if}
						</td>
						<td>
							<div class="flex justify-end gap-2">
								<!-- The row's inputs live in the table cells and point back here with
						     `form`, because a <form> is not valid markup inside a <tr>. -->
								<form id="section-{section.id}" method="POST" action="?/saveSection" use:enhance>
									<input type="hidden" name="sectionId" value={section.id} />
									<input type="hidden" name="section" value={section.section} />
									<Button type="submit" variant="ghost" size="sm">Save</Button>
								</form>
								<form method="POST" action="?/deleteSection" use:enhance>
									<input type="hidden" name="sectionId" value={section.id} />
									<ConfirmSubmit
										label="Remove"
										title="Remove this section?"
										message="Any questions attached to it would go with it, so removal is refused while it still has any."
										confirmLabel="Remove section"
									/>
								</form>
							</div>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>
{:else}
	<p
		class="border-2 border-dashed border-line p-6 text-center text-muted"
		data-testid="no-sections"
	>
		This quiz has no sections yet.
	</p>
{/if}

{#if unusedSections.length > 0}
	<form
		method="POST"
		action="?/saveSection"
		class="mt-5 border-2 border-ink bg-white p-5"
		use:enhance
	>
		<h3 class="mt-0 text-base font-black tracking-tight uppercase">Add a section</h3>

		<div class="grid grid-cols-[repeat(auto-fit,minmax(11rem,1fr))] gap-x-4">
			<Field id="section" label="Section" error={sectionErrors.section} required>
				{#snippet control(props)}
					<select {...props} name="section">
						{#each unusedSections as section (section)}
							<option value={section}>{section}</option>
						{/each}
					</select>
				{/snippet}
			</Field>

			<Field id="position" label="Position" error={sectionErrors.position} required>
				{#snippet control(props)}
					<input {...props} type="number" name="position" min="1" value={nextPosition} />
				{/snippet}
			</Field>

			<Field
				id="sectionTimeLimit"
				label="Time limit (minutes)"
				hint="Optional, on top of the quiz limit."
				error={sectionErrors.timeLimitMinutes}
			>
				{#snippet control(props)}
					<input {...props} type="number" name="timeLimitMinutes" min="1" />
				{/snippet}
			</Field>

			{#if isRandom}
				<Field id="drawCount" label="Questions to draw" error={sectionErrors.drawCount} required>
					{#snippet control(props)}
						<input {...props} type="number" name="drawCount" min="1" />
					{/snippet}
				</Field>
			{/if}
		</div>

		<Button type="submit" size="md">Add section</Button>
	</form>
{:else}
	<p class="border-2 border-dashed border-line p-6 text-center text-muted">
		Every section is already configured for this quiz.
	</p>
{/if}
