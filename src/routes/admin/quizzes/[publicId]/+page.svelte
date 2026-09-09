<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import Field from '$lib/components/Field.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import QuizForm from '$lib/features/admin/QuizForm.svelte';
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

<p class="crumb"><a href={resolve('/admin/quizzes')}>← Quizzes</a></p>

<div class="head">
	<div>
		<h1>{data.quiz.title}</h1>
		<p class="meta">
			<StatusBadge status={data.quiz.status} />
			<span>Created {timestamp.format(data.quiz.createdAt)}</span>
			<span>Last updated {timestamp.format(data.quiz.updatedAt)}</span>
			{#if data.quiz.publishedAt}
				<span>First published {timestamp.format(data.quiz.publishedAt)}</span>
			{/if}
		</p>
	</div>

	<form method="POST" class="status-actions" use:enhance>
		{#if data.quiz.status !== 'PUBLISHED'}
			<button type="submit" formaction="?/publish" class="primary">Publish</button>
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
</div>

{#if form?.message}
	<p class="notice" class:bad={!form.ok} role="alert">{form.message}</p>
{/if}

{#if data.blockers.length > 0 && data.quiz.status !== 'PUBLISHED'}
	<ul class="blockers" aria-label="Blocking publication">
		{#each data.blockers as blocker (blocker)}
			<li>{blocker}</li>
		{/each}
	</ul>
{/if}

<h2>Details</h2>
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

<h2>Sections</h2>
<p class="lede">
	The structure of the paper: which content section, in what order, with its own optional time
	limit.{#if isRandom}
		This quiz draws at random, so each section says how many questions it pulls from the bank.{/if}
</p>

{#if data.sections.length > 0}
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
							<span class="none">not drawn</span>
						{/if}
					</td>
					<td class="actions">
						<!-- The row's inputs live in the table cells and point back here with
						     `form`, because a <form> is not valid markup inside a <tr>. -->
						<form id="section-{section.id}" method="POST" action="?/saveSection" use:enhance>
							<input type="hidden" name="sectionId" value={section.id} />
							<input type="hidden" name="section" value={section.section} />
							<button type="submit">Save</button>
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
					</td>
				</tr>
			{/each}
		</tbody>
	</table>
{:else}
	<p class="empty" data-testid="no-sections">This quiz has no sections yet.</p>
{/if}

{#if unusedSections.length > 0}
	<form method="POST" action="?/saveSection" class="add-section" use:enhance>
		<h3>Add a section</h3>

		<div class="row">
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

		<button type="submit" class="primary">Add section</button>
	</form>
{:else}
	<p class="empty">Every section is already configured for this quiz.</p>
{/if}

<style>
	.crumb {
		margin: 0 0 0.25rem;
		font-size: 0.875rem;
	}

	.crumb a {
		text-decoration: none;
		color: var(--ink-muted);
	}

	.head {
		display: flex;
		flex-wrap: wrap;
		align-items: flex-start;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1rem;
	}

	.meta {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 0.75rem;
		margin: 0;
		font-size: 0.8125rem;
		color: var(--ink-muted);
	}

	.status-actions {
		display: flex;
		gap: 0.5rem;
	}

	h2 {
		margin-top: 2rem;
	}

	.lede {
		margin: 0 0 1rem;
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

	.blockers {
		margin: 0 0 1rem;
		padding: 0.75rem 0.875rem 0.75rem 2rem;
		background: var(--warning-soft);
		border: 1px solid color-mix(in srgb, var(--warning) 25%, transparent);
		border-radius: var(--radius-sm);
		color: var(--warning);
		font-size: 0.875rem;
	}

	table {
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		overflow: hidden;
	}

	.actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.5rem;
	}

	.actions button {
		padding: 0.4375rem 0.75rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: 0.875rem;
		font-weight: 550;
	}

	tbody input {
		max-width: 8rem;
	}

	.none {
		color: var(--ink-faint);
		font-size: 0.875rem;
	}

	.empty {
		padding: 1.5rem 1rem;
		text-align: center;
		color: var(--ink-muted);
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}

	.add-section {
		margin-top: 1.25rem;
		padding: 1.25rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
	}

	.add-section h3 {
		margin-top: 0;
	}

	.row {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
		gap: 0 1rem;
	}

	.primary {
		padding: 0.5rem 0.875rem;
		border: 0;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--accent-ink);
		font-size: 0.9375rem;
		font-weight: 550;
	}
</style>
