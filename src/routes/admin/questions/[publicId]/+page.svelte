<script lang="ts">
	import { enhance } from '$app/forms';
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import StatusBadge from '$lib/components/StatusBadge.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import BlockerList from '$lib/features/admin/BlockerList.svelte';
	import QuestionForm from '$lib/features/questions/QuestionForm.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();
</script>

<div class="flex h-full flex-col">
	<div class="flex flex-wrap items-center justify-between gap-3 border-b border-ink p-6">
		<div class="flex items-center gap-3">
			<i class="fi fi-rs-pencil text-xl text-brand-red" aria-hidden="true"></i>
			<h2 class="m-0 text-xl font-black tracking-tight text-ink">Edit Question</h2>
			<StatusBadge status={data.question.status} />
		</div>
		<div class="flex items-center gap-2">
			<Button href={resolve('/admin/questions')} variant="ghost" size="sm">Discard</Button>
			<form method="POST" use:enhance class="m-0 flex items-center gap-2">
				{#if data.question.status !== 'PUBLISHED'}
					<Button type="submit" formaction="?/publish" variant="secondary" size="sm">
						Publish
					</Button>
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
			<Button type="submit" form="edit-question-form" variant="primary" size="sm">
				Save changes
			</Button>
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
			currentImage={data.image
				? { url: `/media/${data.image.publicId}`, description: data.image.altText }
				: null}
			currentAudio={data.audio
				? { url: `/media/${data.audio.publicId}`, description: data.audio.transcript }
				: null}
			initial={{
				stem: data.question.stem,
				explanation: data.question.explanation ?? '',
				level: data.question.level,
				section: data.question.section,
				points: data.question.points,
				options: data.options.map((option) => ({
					id: option.id,
					body: option.body,
					isCorrect: option.isCorrect
				}))
			}}
		/>
	</div>
</div>
