<script lang="ts">
	import { enhance } from '$app/forms';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
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

<h2 class="mt-8 mb-2 text-lg font-black tracking-tight text-ink uppercase">Sections</h2>
<p class="mt-0 mb-4 text-sm text-muted">
	The structure of the paper: which content section, in what order, with its own optional time
	limit.{#if isRandom}
		This quiz draws at random, so each section says how many questions it pulls from the bank.{/if}
</p>

{#if sections.length > 0}
	<div class="overflow-x-auto border border-ink bg-white">
		<table class="w-full text-left text-sm">
			<thead class="border-b border-ink bg-stone-100">
				<tr>
					<th scope="col" class="px-4 py-3 text-[10px] font-bold tracking-widest text-ink uppercase"
						>Section</th
					>
					<th scope="col" class="px-4 py-3 text-[10px] font-bold tracking-widest text-ink uppercase"
						>Position</th
					>
					<th scope="col" class="px-4 py-3 text-[10px] font-bold tracking-widest text-ink uppercase"
						>Time limit (min)</th
					>
					<th scope="col" class="px-4 py-3 text-[10px] font-bold tracking-widest text-ink uppercase"
						>Questions drawn</th
					>
					<th scope="col" class="px-4 py-3"><span class="visually-hidden">Actions</span></th>
				</tr>
			</thead>
			<tbody class="divide-y divide-ink/20">
				{#each sections as section (section.id)}
					<tr class="transition-colors hover:bg-stone-50">
						<th scope="row" class="px-4 py-3 text-xs font-bold tracking-wider uppercase"
							>{section.section}</th
						>
						<td class="px-4 py-3">
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
								class="w-20 border border-ink bg-white px-2 py-1 text-sm outline-none focus:border-brand-red"
							/>
						</td>
						<td class="px-4 py-3">
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
								class="w-24 border border-ink bg-white px-2 py-1 text-sm outline-none focus:border-brand-red"
							/>
						</td>
						<td class="px-4 py-3">
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
									class="w-24 border border-ink bg-white px-2 py-1 text-sm outline-none focus:border-brand-red"
								/>
							{:else}
								<span class="text-xs font-bold tracking-widest text-muted uppercase">not drawn</span
								>
							{/if}
						</td>
						<td class="px-4 py-3 text-right">
							<div class="flex items-center justify-end gap-2">
								<form id="section-{section.id}" method="POST" action="?/saveSection" use:enhance>
									<input type="hidden" name="sectionId" value={section.id} />
									<input type="hidden" name="section" value={section.section} />
									<button
										type="submit"
										class="border border-ink bg-white px-3 py-1.5 text-[10px] font-bold tracking-widest text-ink uppercase transition-colors hover:bg-stone-100"
										>Save</button
									>
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
		class="border-2 border-dashed border-ink p-8 text-center text-sm font-bold tracking-widest text-muted uppercase"
		data-testid="no-sections"
	>
		This quiz has no sections yet.
	</p>
{/if}

{#if unusedSections.length > 0}
	<form
		method="POST"
		action="?/saveSection"
		class="mt-6 flex flex-col gap-6 border border-ink bg-stone-50 p-6"
		use:enhance
	>
		<div class="flex items-center gap-2 border-b border-ink pb-4">
			<i class="fi fi-rs-apps-add text-xl text-brand-red" aria-hidden="true"></i>
			<h3 class="m-0 text-lg font-black tracking-tight text-ink uppercase">Add a section</h3>
		</div>

		<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
			<div>
				<label
					class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
					for="section">Section</label
				>
				<div class="relative flex items-center border border-ink bg-white">
					<select
						id="section"
						name="section"
						class="w-full appearance-none border-none bg-transparent px-3 py-2 text-sm outline-none"
					>
						{#each unusedSections as section (section)}
							<option value={section}>{section}</option>
						{/each}
					</select>
					<i
						class="fi fi-rs-angle-down pointer-events-none absolute right-3 text-muted"
						aria-hidden="true"
					></i>
				</div>
				{#if errors.section}<p class="mt-1 text-xs text-brand-red">{errors.section}</p>{/if}
			</div>

			<div>
				<label
					class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
					for="position">Position</label
				>
				<input
					id="position"
					type="number"
					name="position"
					min="1"
					value={nextPosition}
					class="w-full border border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
				/>
				{#if errors.position}<p class="mt-1 text-xs text-brand-red">{errors.position}</p>{/if}
			</div>

			<div>
				<label
					class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
					for="sectionTimeLimit">Time limit (min)</label
				>
				<input
					id="sectionTimeLimit"
					type="number"
					name="timeLimitMinutes"
					min="1"
					class="w-full border border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
					placeholder="Optional"
				/>
				{#if errors.timeLimitMinutes}<p class="mt-1 text-xs text-brand-red">
						{errors.timeLimitMinutes}
					</p>{/if}
			</div>

			{#if isRandom}
				<div>
					<label
						class="mb-2 block text-[10px] font-bold tracking-widest text-ink uppercase"
						for="drawCount">Questions to draw</label
					>
					<input
						id="drawCount"
						type="number"
						name="drawCount"
						min="1"
						class="w-full border border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
						required
					/>
					{#if errors.drawCount}<p class="mt-1 text-xs text-brand-red">{errors.drawCount}</p>{/if}
				</div>
			{/if}
		</div>

		<div class="flex justify-end pt-2">
			<button
				type="submit"
				class="border border-brand-red bg-brand-red px-6 py-2.5 text-[10px] font-bold tracking-widest text-white uppercase transition-colors hover:bg-brand-red-dark"
			>
				Add Section
			</button>
		</div>
	</form>
{:else}
	<p
		class="mt-6 border-2 border-dashed border-ink p-6 text-center text-xs font-bold tracking-widest text-muted uppercase"
	>
		Every section is already configured for this quiz.
	</p>
{/if}
