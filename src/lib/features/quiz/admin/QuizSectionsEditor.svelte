<script lang="ts">
	import { enhance } from '$app/forms';
	import Button from '$lib/components/Button.svelte';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import Field from '$lib/components/Field.svelte';
	import { SECTIONS, type Section, type SelectionMode } from '$lib/domain/enums';

	type QuizSection = {
		id: number;
		section: Section;
		position: number;
		timeLimitSeconds: number | null;
		drawCount: number | null;
	};

	let {
		sections,
		selectionMode,
		errors = {}
	}: {
		sections: QuizSection[];
		selectionMode: SelectionMode;
		errors?: Record<string, string>;
	} = $props();

	const isRandom = $derived(selectionMode === 'RANDOM');
	const nextPosition = $derived(
		sections.reduce((highest, section) => Math.max(highest, section.position), 0) + 1
	);
	const unusedSections = $derived(
		SECTIONS.filter((section) => !sections.some((existing) => existing.section === section))
	);
</script>

<h2 class="mt-8 text-lg font-black tracking-tight uppercase">Sections</h2>
<p class="mt-0 mb-4 text-sm text-muted">
	The structure of the paper: which content section, in what order, with its own optional time
	limit.{#if isRandom}
		This quiz draws at random, so each section says how many questions it pulls from the bank.{/if}
</p>

{#if sections.length > 0}
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
				{#each sections as section (section.id)}
					<tr>
						<th scope="row">{section.section}</th>
						<td>
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
			<Field id="section" label="Section" error={errors.section} required>
				{#snippet control(props)}
					<select {...props} name="section">
						{#each unusedSections as section (section)}
							<option value={section}>{section}</option>
						{/each}
					</select>
				{/snippet}
			</Field>
			<Field id="position" label="Position" error={errors.position} required>
				{#snippet control(props)}
					<input {...props} type="number" name="position" min="1" value={nextPosition} />
				{/snippet}
			</Field>
			<Field
				id="sectionTimeLimit"
				label="Time limit (minutes)"
				hint="Optional, on top of the quiz limit."
				error={errors.timeLimitMinutes}
			>
				{#snippet control(props)}
					<input {...props} type="number" name="timeLimitMinutes" min="1" />
				{/snippet}
			</Field>
			{#if isRandom}
				<Field id="drawCount" label="Questions to draw" error={errors.drawCount} required>
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
