<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import Field from '$lib/components/Field.svelte';
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

	let {
		level,
		sections,
		attached,
		attachable
	}: {
		level: JlptLevel;
		sections: QuizSection[];
		attached: AttachedQuestion[];
		attachable: Record<number, { id: number; stem: string }[]>;
	} = $props();

	const attachedIn = (quizSectionId: number) =>
		attached.filter((question) => question.quizSectionId === quizSectionId);
</script>

<h2 class="mt-8 text-lg font-black tracking-tight uppercase">Questions</h2>
<p class="mt-0 mb-4 text-sm text-muted">
	The paper itself, in the order a learner meets it. Only published questions at this quiz's level
	and the section's own content section can be added.
</p>

{#if sections.length === 0}
	<p class="border-2 border-dashed border-line p-6 text-center text-muted">
		Add a section first — questions hang off sections, not off the quiz.
	</p>
{:else}
	{#each sections as section (section.id)}
		{@const questions = attachedIn(section.id)}
		{@const choices = attachable[section.id] ?? []}
		<section class="mt-5 border-2 border-ink bg-white p-5">
			<h3 class="mt-0 text-base font-black tracking-tight uppercase">
				{section.section}
				<span class="font-medium text-muted normal-case">
					— {questions.length}
					{questions.length === 1 ? 'question' : 'questions'}
				</span>
			</h3>

			{#if questions.length > 0}
				<div class="overflow-x-auto border-2 border-line">
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
				<p class="border-2 border-dashed border-line p-4 text-center text-muted">
					No questions on this section yet, so the quiz cannot be published.
				</p>
			{/if}

			{#if choices.length > 0}
				<form
					method="POST"
					action="?/attachQuestion"
					class="mt-4 flex flex-wrap items-end gap-3"
					use:enhance
				>
					<input type="hidden" name="quizSectionId" value={section.id} />
					<div class="min-w-[18rem] flex-1">
						<Field id="question-{section.id}" label="Add a question">
							{#snippet control(props)}
								<select {...props} name="questionId">
									{#each choices as choice (choice.id)}
										<option value={choice.id}>{choice.stem}</option>
									{/each}
								</select>
							{/snippet}
						</Field>
					</div>
					<Button type="submit" size="md">Add to paper</Button>
				</form>
			{:else}
				<p class="mt-4 text-sm text-muted">
					Every published {section.section} question at {level} is already on this paper.
				</p>
			{/if}
		</section>
	{/each}
{/if}
