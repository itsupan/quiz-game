<script lang="ts">
	import { enhance } from '$app/forms';
	import { untrack } from 'svelte';
	import ConfirmSubmit from '$lib/components/ConfirmSubmit.svelte';
	import Notice from '$lib/components/Notice.svelte';
	import Countdown from '$lib/features/quiz/Countdown.svelte';
	import OptionList from '$lib/features/quiz/OptionList.svelte';
	import QuestionMedia from '$lib/features/quiz/QuestionMedia.svelte';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	/**
	 * Listening choices start disabled in SSR as well as in the browser. The media
	 * component opens them only after `canplay`, so slow and broken audio cannot be skipped
	 * merely by submitting the server-rendered form before hydration.
	 */
	// eslint-disable-next-line svelte/prefer-writable-derived
	let optionsDisabled = $state(untrack(() => data.question.audio !== null));

	$effect(() => {
		optionsDisabled = data.question.audio !== null;
	});

	function onaudioready() {
		optionsDisabled = false;
	}

	let submitFormEl: HTMLFormElement | undefined = $state();
	let advanceFormEl: HTMLFormElement | undefined = $state();

	/**
	 * `requestSubmit()` with no argument fires the form's own submit event directly,
	 * which skips `ConfirmSubmit`'s button-click handler entirely — exactly what an
	 * automatic expiry submit needs. If this never runs at all (the tab is gone, the
	 * network is down), `enforceDeadline` settles the same clock the next time anyone
	 * loads this attempt or its result.
	 */
	function onexpire() {
		if (data.deadlineKind === 'section') {
			advanceFormEl?.requestSubmit();
		} else {
			submitFormEl?.requestSubmit();
		}
	}

	// Derived logic for split stem
	const lines = $derived(data.question.stem.split('\n'));
	const mainText = $derived(lines[0]);
	const instruction = $derived(
		data.question.image
			? data.question.stem
			: lines.length > 1
				? lines[lines.length - 1]
				: 'Select the correct answer.'
	);
</script>

<svelte:head>
	<title>{data.quiz.title} | QuizGame</title>
</svelte:head>

<div class="flex min-h-screen flex-col bg-white">
	<!-- Custom Edge-to-Edge Header -->
	<header class="relative flex items-center justify-between border-b border-ink bg-white px-8 py-4">
		<div class="flex items-center gap-4">
			<div class="flex items-center text-brand-red">
				<div class="h-6 w-1 bg-brand-red"></div>
			</div>
			<h1 class="text-xl font-black tracking-[0.18em] text-brand-red uppercase">QuizGame</h1>

			<span class="ml-4 text-[10px] font-bold tracking-widest text-stone-500 uppercase"
				>/ {data.quiz.title}</span
			>
		</div>

		<div class="flex items-center gap-6">
			<!-- Discreet timer -->
			<Countdown deadline={data.deadline ? new Date(data.deadline) : null} {onexpire} />

			<div class="flex items-center">
				<span class="text-[10px] font-bold tracking-widest text-ink uppercase">Progress</span>
				<div class="mx-4 h-1 w-32 bg-stone-200">
					<div
						class="h-full bg-brand-red transition-all duration-300"
						style="width: {(data.index / data.total) * 100}%"
					></div>
				</div>
				<span class="text-xs font-bold text-ink"
					>{String(data.index).padStart(2, '0')}/{String(data.total).padStart(2, '0')}</span
				>
			</div>

			<button
				type="button"
				class="flex h-10 w-10 items-center justify-center border border-ink bg-white text-ink transition-colors hover:bg-stone-100"
				onclick={() => submitFormEl?.requestSubmit()}
			>
				<svg class="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"
					><path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" /></svg
				>
			</button>
		</div>
	</header>

	{#if form?.message}
		<div class="px-6 pt-6">
			<Notice tone="danger" alert>{form.message}</Notice>
		</div>
	{/if}

	<!-- Main Content Area: Edge-to-edge split (All White) -->
	<div class="grid w-full flex-1 grid-cols-1 lg:grid-cols-[1fr_1fr]">
		<!-- Left Column: Reading Passage -->
		<div class="flex flex-col border-b border-ink bg-white p-12 lg:border-r lg:border-b-0 xl:p-16">
			<!-- Badges -->
			<div class="mb-12 flex items-center gap-4">
				<span
					class="bg-brand-red px-3 py-1 text-[10px] font-bold tracking-widest text-white uppercase"
				>
					{data.question.section}
				</span>
				<span
					class="border-b border-stone-300 pb-1 text-[10px] font-bold tracking-widest text-stone-500 uppercase"
				>
					Passage {String(data.index).padStart(2, '0')}
				</span>
			</div>

			<!-- Main Text with Red Left Border -->
			<div class="flex-1">
				{#if data.question.image}
					<QuestionMedia image={data.question.image} audio={null} />
				{:else}
					<div class="border-l-4 border-brand-red py-2 pl-8">
						<!-- Mockup text used if mainText is short, otherwise use mainText -->
						<h2 class="text-4xl leading-[1.8] font-bold text-ink">
							{mainText.length < 20
								? '昨日、新しい靴を買いました。とても歩きやすくて、デザインも気に入っています。明日はこの靴を履いて、友達と山へ行きます。'
								: mainText}
						</h2>
					</div>
				{/if}
			</div>

			<!-- Translation Placeholder -->
			<div class="mt-12 border-t border-stone-200 pt-8">
				<p class="text-sm leading-relaxed text-stone-500 italic">
					"I bought new shoes yesterday. They are very comfortable to walk in, and I like the
					design. Tomorrow, I will wear these shoes and go to the mountains with my friends."
				</p>
			</div>
		</div>

		<!-- Right Column: Question & Options -->
		<div class="flex flex-col justify-between bg-white p-12 xl:p-24">
			<div class="flex-1">
				<!-- Question Header -->
				<div class="mb-16 flex items-start gap-4">
					<span class="shrink-0 text-6xl font-black text-brand-red"
						>{String(data.index).padStart(2, '0')}/</span
					>
					<div class="mx-2 w-px self-stretch bg-stone-300"></div>
					<div class="pt-2">
						<h2 class="mb-2 text-2xl font-bold text-ink">
							{instruction}
						</h2>
						<p class="text-sm text-stone-500">What is this person doing tomorrow?</p>
					</div>
				</div>

				{#if data.question.audio}
					<div class="mb-12">
						<QuestionMedia image={null} audio={data.question.audio} {onaudioready} />
					</div>
				{/if}

				<form method="POST" action="?/answer" use:enhance class="flex flex-col">
					<input type="hidden" name="attemptQuestionId" value={data.question.attemptQuestionId} />

					<OptionList
						name="selectedOptionId"
						options={data.question.options}
						selectedOptionId={data.question.selectedOptionId}
						disabled={optionsDisabled}
					/>

					<!-- Navigation Buttons -->
					<div
						class="mt-16 flex w-full items-center justify-between border-t border-stone-200 pt-8"
					>
						<div class="w-32 lg:w-40">
							{#if data.index > 1}
								<button
									type="submit"
									name="nextIndex"
									value={String(data.index - 1)}
									class="flex items-center justify-center gap-2 border border-ink bg-white px-6 py-2 text-xs font-bold tracking-widest text-ink uppercase transition-colors hover:bg-stone-50"
								>
									&larr; Prev
								</button>
							{/if}
						</div>

						<!-- Skip button -->
						<button
							type="button"
							onclick={() => submitFormEl?.requestSubmit()}
							class="text-[10px] font-bold tracking-widest text-stone-500 uppercase underline transition-colors hover:text-ink"
						>
							Skip
						</button>

						<div class="flex w-32 justify-end lg:w-40">
							{#if data.index < data.total}
								<button
									type="submit"
									name="nextIndex"
									value={String(data.index + 1)}
									disabled={optionsDisabled}
									class="flex items-center justify-center gap-2 bg-brand-red px-8 py-2 text-xs font-bold tracking-widest text-white uppercase transition-colors hover:bg-brand-red-dark disabled:opacity-50"
								>
									Next &rarr;
								</button>
							{:else}
								<button
									type="submit"
									name="nextIndex"
									value={String(data.index)}
									disabled={optionsDisabled}
									class="flex items-center justify-center gap-2 bg-brand-red px-8 py-2 text-xs font-bold tracking-widest text-white uppercase transition-colors hover:bg-brand-red-dark disabled:opacity-50"
								>
									Save &rarr;
								</button>
							{/if}
						</div>
					</div>
				</form>
			</div>
		</div>
	</div>

	<form method="POST" action="?/submit" bind:this={submitFormEl} use:enhance>
		<ConfirmSubmit
			label="Submit attempt"
			title="Submit this attempt?"
			message={data.answeredCount < data.total
				? `You have answered ${data.answeredCount} of ${data.total} questions. Anything left blank is scored as unanswered.`
				: 'You can review your answers on the result page afterwards, but this attempt closes once submitted.'}
			confirmLabel="Submit attempt"
		/>
	</form>

	<form method="POST" action="?/advance" bind:this={advanceFormEl} use:enhance hidden></form>
</div>
