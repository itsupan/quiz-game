<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import { SvelteSet } from 'svelte/reactivity';
	import Badge from '$lib/components/Badge.svelte';
	import Button from '$lib/components/Button.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import QuestionForm from '$lib/features/questions/QuestionForm.svelte';
	import type { JlptLevel, Section } from '$lib/domain/enums';

	type QuizSection = { id: number; section: Section };
	type AttachedQuestion = {
		quizQuestionId: number;
		quizSectionId: number;
		publicId: string;
		stem: string;
		position: number;
		points: number;
	};
	type CreateQuestionForm = {
		ok?: boolean;
		message?: string;
		quizSectionId?: number;
		errors?: Record<string, string>;
		values?: Record<string, string>;
		submitted?: { options: { id: number | null; body: string }[]; correctOption: number };
		created?: { publicId: string; questionId: number; stem: string; blockers: string[] };
	} | null;

	let {
		quizPublicId,
		level,
		sections,
		attached,
		form = null
	}: {
		quizPublicId: string;
		level: JlptLevel;
		sections: QuizSection[];
		attached: AttachedQuestion[];
		form?: CreateQuestionForm;
	} = $props();

	const attachedIn = (quizSectionId: number) =>
		attached.filter((question) => question.quizSectionId === quizSectionId);

	// Which section's "new question" panel is open. Auto-opens whichever section a
	// createQuestion/publishAndAttach submit just responded for, so the result (errors or
	// the publish confirmation) appears where the admin is already looking.
	let openSectionId = $state<number | null>(null);
	// Sections whose create result the admin has dismissed with "Add another question" —
	// tracked separately from `form` itself, which only clears on the next submit.
	const dismissed = new SvelteSet<number>();

	$effect(() => {
		if (form?.quizSectionId !== undefined) {
			openSectionId = form.quizSectionId;
		}
	});

	function toggleCreate(sectionId: number) {
		if (openSectionId === sectionId) {
			openSectionId = null;
		} else {
			openSectionId = sectionId;
			dismissed.delete(sectionId);
		}
	}

	function createAnother(sectionId: number) {
		dismissed.add(sectionId);
	}

	function importHref(sectionId: number) {
		return `${resolve('/admin/quizzes/[publicId]/import', { publicId: quizPublicId })}?section=${sectionId}`;
	}
</script>

<h2 class="mt-8 text-lg font-black tracking-tight uppercase">Questions</h2>
<p class="mt-0 mb-4 text-sm text-muted">
	The paper itself, in the order a learner meets it. Only published questions at this quiz's level
	and the section's own content section can be added.
</p>

{#if sections.length === 0}
	<p class="border-2 border-dashed border-line p-6 text-center text-muted">
		Choose a section above first — questions hang off sections, not off the quiz.
	</p>
{:else}
	{#each sections as section (section.id)}
		{@const questions = attachedIn(section.id)}
		{@const sectionForm = form?.quizSectionId === section.id ? form : null}
		{@const justCreated =
			sectionForm?.created && !dismissed.has(section.id) ? sectionForm.created : null}
		<section class="mt-5 border-2 border-ink bg-white p-5">
			<div class="flex flex-wrap items-center justify-between gap-3">
				<h3 class="m-0 text-base font-black tracking-tight uppercase">
					{section.section}
					<span class="font-medium text-muted normal-case">
						— {questions.length}
						{questions.length === 1 ? 'question' : 'questions'}
					</span>
				</h3>
				<div class="flex gap-2">
					<Button type="button" variant="ghost" size="sm" onclick={() => toggleCreate(section.id)}>
						<i class="fi fi-rs-plus" aria-hidden="true"></i>
						{openSectionId === section.id ? 'Close' : 'New question'}
					</Button>
					<Button href={importHref(section.id)} variant="ghost" size="sm">
						<i class="fi fi-rs-upload" aria-hidden="true"></i> Import CSV
					</Button>
				</div>
			</div>

			{#if questions.length > 0}
				<div class="mt-4 overflow-x-auto border-2 border-line">
					<table>
						<thead>
							<tr>
								<th scope="col">#</th>
								<th scope="col">Question</th>
								<th scope="col">Points</th>
								<th scope="col"><span class="visually-hidden">Actions</span></th>
							</tr>
						</thead>
						<tbody>
							{#each questions as question (question.quizQuestionId)}
								<tr>
									<th scope="row">{question.position}</th>
									<td>
										<a
											href={resolve('/admin/questions/[publicId]', {
												publicId: question.publicId
											})}>{question.stem}</a
										>
									</td>
									<td>{question.points}</td>
									<td>
										<form method="POST" action="?/detachQuestion" use:enhance>
											<input type="hidden" name="quizQuestionId" value={question.quizQuestionId} />
											<Button type="submit" variant="ghost" size="sm">Remove</Button>
										</form>
									</td>
								</tr>
							{/each}
						</tbody>
					</table>
				</div>
			{:else}
				<p class="mt-4 border-2 border-dashed border-line p-4 text-center text-muted">
					No questions on this section yet, so the quiz cannot be published.
				</p>
			{/if}

			{#if openSectionId === section.id}
				<div class="mt-6 border-t-2 border-dashed border-line pt-6">
					{#if justCreated}
						<div class="border-2 border-ink bg-stone-50 p-5">
							<div class="flex items-center gap-2">
								<Badge tone="warning">Draft</Badge>
								<p class="m-0 text-sm font-semibold text-ink">“{justCreated.stem}”</p>
							</div>

							{#if justCreated.blockers.length > 0}
								<ul class="mt-3 list-disc space-y-1 pl-5 text-sm text-warning">
									{#each justCreated.blockers as blocker (blocker)}
										<li>{blocker}</li>
									{/each}
								</ul>
								<p class="mt-2 text-xs text-muted">
									Fix these on the question's own page, then come back and add it to the paper.
								</p>
								<div class="mt-4 flex gap-2">
									<Button
										href={resolve('/admin/questions/[publicId]', {
											publicId: justCreated.publicId
										})}
										variant="secondary"
										size="sm">Finish editing this question</Button
									>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onclick={() => createAnother(section.id)}>Add another question</Button
									>
								</div>
							{:else}
								<form method="POST" action="?/publishAndAttach" use:enhance class="mt-4 flex gap-2">
									<input type="hidden" name="quizSectionId" value={section.id} />
									<input type="hidden" name="questionId" value={justCreated.questionId} />
									<Button type="submit" size="sm">Publish & add to paper</Button>
									<Button
										type="button"
										variant="ghost"
										size="sm"
										onclick={() => createAnother(section.id)}>Add another question</Button
									>
								</form>
							{/if}
						</div>
					{:else}
						{#if sectionForm?.message}
							<Notice tone="danger" alert>{sectionForm.message}</Notice>
						{/if}
						<QuestionForm
							action="?/createQuestion"
							errors={sectionForm?.errors ?? {}}
							values={sectionForm?.values ?? {}}
							submitted={sectionForm?.submitted}
							lockedLevel={level}
							lockedSection={section.section}
							initial={{
								stem: '',
								explanation: '',
								level,
								section: section.section,
								points: 1,
								options: []
							}}
						/>
						<input
							type="hidden"
							form="edit-question-form"
							name="quizSectionId"
							value={section.id}
						/>
						<div class="mt-4 flex justify-end">
							<Button type="submit" form="edit-question-form" size="md">Create as draft</Button>
						</div>
					{/if}
				</div>
			{/if}
		</section>
	{/each}
{/if}
