<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import BlockerList from '$lib/features/admin/BlockerList.svelte';
	import QuestionForm from '$lib/features/questions/QuestionForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<div class="flex h-full flex-col">
	<div class="flex items-center justify-between border-b border-ink p-6">
		<div class="flex items-center gap-3">
			<i class="fi fi-rs-pencil text-xl text-brand-red" aria-hidden="true"></i>
			<h2 class="m-0 text-xl font-black tracking-tight text-ink">Edit Question</h2>
			<StatusBadge status={data.question.status} />
		</div>
		<div class="flex items-center gap-4">
			<form method="POST" use:enhance class="m-0 flex items-center gap-2">
				{#if data.question.status !== 'PUBLISHED'}
					<button
						type="submit"
						formaction="?/publish"
						class="border border-brand-red bg-white px-6 py-2 text-[10px] font-bold tracking-widest text-brand-red uppercase transition-colors hover:bg-stone-50"
					>
						Publish
					</button>
				{/if}
				{#if data.question.status !== 'ARCHIVED'}
					<ConfirmSubmit
						label="Archive"
						formaction="?/archive"
						title="Archive this question?"
						message="It stops appearing in new quizzes. Past attempts that used it keep working, and you can publish it again later."
						confirmLabel="Archive question"
					/>
				{/if}
			</form>

			<a
				href={resolve('/admin/questions')}
				class="border border-ink bg-white px-6 py-2 text-[10px] font-bold tracking-widest text-ink uppercase no-underline transition-colors hover:bg-stone-100"
			>
				Discard
			</a>
			<button
				type="submit"
				form="edit-question-form"
				class="border border-brand-red bg-brand-red px-6 py-2 text-[10px] font-bold tracking-widest text-white uppercase transition-colors hover:bg-brand-red-dark"
			>
				Save Changes
			</button>
		</div>
	</div>

	<div class="flex-1 overflow-y-auto p-8">
		{#if form?.message}
			<Notice tone={form.ok ? 'success' : 'danger'} alert>{form.message}</Notice>
		{/if}

		{#if data.question.status !== 'PUBLISHED'}
			<BlockerList blockers={data.blockers} label="Blocking publication" />
		{/if}

		<QuestionForm
			action="?/update"
			errors={form?.errors ?? {}}
			values={form?.values ?? {}}
			submitted={form?.submitted}
			media={data.media}
			initial={{
				stem: data.question.stem,
				explanation: data.question.explanation ?? '',
				level: data.question.level,
				section: data.question.section,
				points: data.question.points,
				imageMediaId: data.question.imageMediaId,
				audioMediaId: data.question.audioMediaId,
				options: data.options.map((option) => ({
					id: option.id,
					body: option.body,
					isCorrect: option.isCorrect
				}))
			}}
		/>

		<!-- Secondary Actions -->
		<div class="mt-8 flex justify-end gap-2 border-t border-line pt-6">
			<form method="POST" use:enhance class="flex gap-2">
				{#if data.question.status !== 'PUBLISHED'}
					<button
						type="submit"
						formaction="?/publish"
						class="border border-ink bg-white px-4 py-2 text-[10px] font-bold tracking-widest text-ink uppercase transition-colors hover:bg-stone-50"
					>
						Publish
					</button>
				{/if}
				{#if data.question.status !== 'ARCHIVED'}
					<ConfirmSubmit
						label="Archive"
						formaction="?/archive"
						title="Archive this question?"
						message="It stops appearing in new quizzes. Past attempts that used it keep working, and you can publish it again later."
						confirmLabel="Archive question"
					/>
				{/if}
			</form>
		</div>
	</div>
</div>
