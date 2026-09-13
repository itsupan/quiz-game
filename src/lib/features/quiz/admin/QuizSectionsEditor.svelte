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

	/**
	 * Only matters before any section exists: once the quiz has one, the full editor
	 * below covers both growing it into a mock paper and everything else.
	 */
	let setupPath = $state<'single' | 'multi' | null>(null);
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
{:else if setupPath === null}
	<div
		class="grid gap-4 border-2 border-dashed border-ink p-6 md:grid-cols-2"
		data-testid="no-sections"
	>
		<button
			type="button"
			class="flex cursor-pointer flex-col gap-2 border-2 border-ink bg-white p-5 text-left transition-colors hover:bg-stone-50"
			onclick={() => (setupPath = 'single')}
		>
			<i class="fi fi-rs-bullseye text-2xl text-brand-red" aria-hidden="true"></i>
			<span class="text-sm font-black tracking-tight text-ink uppercase">Single-topic quiz</span>
			<span class="text-xs text-muted normal-case"
				>One content section — pick it once, then go straight to adding questions.</span
			>
		</button>
		<button
			type="button"
			class="flex cursor-pointer flex-col gap-2 border-2 border-ink bg-white p-5 text-left transition-colors hover:bg-stone-50"
			onclick={() => (setupPath = 'multi')}
		>
			<i class="fi fi-rs-layers text-2xl text-brand-red" aria-hidden="true"></i>
			<span class="text-sm font-black tracking-tight text-ink uppercase">JLPT mock paper</span>
			<span class="text-xs text-muted normal-case"
				>Multiple sections — Vocabulary, Grammar, Listening — each managed separately.</span
			>
		</button>
	</div>
{:else if setupPath === 'single'}
	<form
		method="POST"
		action="?/saveSection"
		class="mt-2 flex flex-wrap items-end gap-4 border-2 border-ink bg-stone-50 p-6"
		use:enhance
	>
		<div class="min-w-[16rem] flex-1">
			<Field id="section" label="Section" error={errors.section}>
				{#snippet control(props)}
					<select
						{...props}
						name="section"
						class="w-full appearance-none border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
					>
						{#each unusedSections as section (section)}
							<option value={section}>{section}</option>
						{/each}
					</select>
				{/snippet}
			</Field>
		</div>
		<input type="hidden" name="position" value="1" />
		<Button type="submit" size="md">Save & start adding questions</Button>
		<Button type="button" variant="ghost" size="md" onclick={() => (setupPath = null)}>Back</Button>
	</form>
{/if}

{#if sections.length > 0 || setupPath === 'multi'}
	{#if unusedSections.length > 0}
		<form
			method="POST"
			action="?/saveSection"
			class="mt-6 flex flex-col gap-6 border-2 border-ink bg-stone-50 p-6"
			use:enhance
		>
			<div class="flex items-center gap-2 border-b-2 border-ink pb-4">
				<i class="fi fi-rs-apps-add text-xl text-brand-red" aria-hidden="true"></i>
				<h3 class="m-0 text-lg font-black tracking-tight text-ink uppercase">Add a section</h3>
			</div>

			<div class="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
				<Field id="newSection" label="Section" error={errors.section}>
					{#snippet control(props)}
						<select
							{...props}
							name="section"
							class="w-full appearance-none border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
						>
							{#each unusedSections as section (section)}
								<option value={section}>{section}</option>
							{/each}
						</select>
					{/snippet}
				</Field>

				<Field id="position" label="Position" error={errors.position}>
					{#snippet control(props)}
						<input
							{...props}
							type="number"
							name="position"
							min="1"
							value={nextPosition}
							class="w-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
						/>
					{/snippet}
				</Field>

				<Field id="sectionTimeLimit" label="Time limit (min)" error={errors.timeLimitMinutes}>
					{#snippet control(props)}
						<input
							{...props}
							type="number"
							name="timeLimitMinutes"
							min="1"
							class="w-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
							placeholder="Optional"
						/>
					{/snippet}
				</Field>

				{#if isRandom}
					<Field id="drawCount" label="Questions to draw" error={errors.drawCount}>
						{#snippet control(props)}
							<input
								{...props}
								type="number"
								name="drawCount"
								min="1"
								class="w-full border-2 border-ink bg-white px-3 py-2 text-sm outline-none focus:border-brand-red"
								required
							/>
						{/snippet}
					</Field>
				{/if}
			</div>

			<div class="flex justify-end pt-2">
				<Button type="submit" size="md">Add section</Button>
			</div>
		</form>
	{:else}
		<p
			class="mt-6 border-2 border-dashed border-ink p-6 text-center text-xs font-bold tracking-widest text-muted uppercase"
		>
			Every section is already configured for this quiz.
		</p>
	{/if}
{/if}
