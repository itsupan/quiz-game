<script lang="ts">
	import { resolve } from '$app/paths';
	import Button from '$lib/components/Button.svelte';
	import Notice from '$lib/components/Notice.svelte';

	/**
	 * A question's image and/or audio.
	 *
	 * A listening question must not let the learner move on before the audio can actually
	 * play — `onaudioready` fires once that's true, and a caller wires it to disable
	 * `OptionList` until then. A broken file stays closed: treating `error` as readiness
	 * would let the learner continue without the listening material. They can retry the
	 * request or submit the attempt without answering this question.
	 *
	 * The transcript is a prop, not something this component fetches: during an attempt
	 * the caller simply never passes one, because for a listening question the transcript
	 * *is* the answer. It only arrives once `revealTranscript` is true, on the result page.
	 */
	let {
		image,
		audio,
		revealTranscript = false,
		onaudioready
	}: {
		image: { publicId: string; altText: string | null } | null;
		audio: { publicId: string; transcript?: string | null } | null;
		revealTranscript?: boolean;
		onaudioready?: () => void;
	} = $props();

	let audioEl: HTMLAudioElement | undefined = $state();
	let broken = $state(false);
	let paused = $state(true);
	let currentTime = $state(0);
	let duration = $state(0);

	function togglePlay() {
		if (!audioEl) return;
		if (paused) {
			audioEl.play().catch(() => {});
		} else {
			audioEl.pause();
		}
	}

	function onerror() {
		broken = true;
	}

	function oncanplay() {
		broken = false;
		onaudioready?.();
	}

	function retry() {
		broken = false;
		audioEl?.load();
	}

	function replay() {
		if (!audioEl) return;
		audioEl.currentTime = 0;
		audioEl.play().catch(() => {});
	}

	function formatTime(seconds: number) {
		if (isNaN(seconds)) return '00:00';
		const m = Math.floor(seconds / 60);
		const s = Math.floor(seconds % 60);
		return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
	}

	function seek(event: MouseEvent) {
		if (!audioEl || !duration) return;
		const bar = event.currentTarget as HTMLElement;
		const rect = bar.getBoundingClientRect();
		const x = Math.max(0, Math.min(event.clientX - rect.left, rect.width));
		const percentage = x / rect.width;
		audioEl.currentTime = percentage * duration;
	}

	$effect(() => {
		// Nothing to wait for: an image-only question, or one with no media at all, opens
		// straight away.
		if (!audio) {
			onaudioready?.();
		}
	});
</script>

{#if image}
	<img
		src={resolve('/media/[publicId]', { publicId: image.publicId })}
		alt={image.altText ?? ''}
		class="h-auto w-full object-contain"
	/>
{/if}

{#if audio}
	<div class="mb-4">
		<!-- Custom Audio Player -->
		<div class="flex items-center gap-4 border-2 border-ink bg-white p-2 shadow-[8px_8px_0_0_#000]">
			<button
				type="button"
				class="flex h-12 w-12 shrink-0 items-center justify-center bg-brand-red transition-colors hover:bg-brand-red-dark"
				onclick={togglePlay}
				aria-label={paused ? 'Play' : 'Pause'}
			>
				{#if paused}
					<!-- Play Icon -->
					<svg class="ml-1 h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24"
						><path d="M5 3l14 9-14 9V3z" /></svg
					>
				{:else}
					<!-- Pause Icon -->
					<svg class="h-5 w-5 text-white" fill="currentColor" viewBox="0 0 24 24"
						><path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" /></svg
					>
				{/if}
			</button>

			<div class="flex flex-1 items-center gap-3 px-2">
				<span class="font-mono text-[10px] font-bold tracking-widest text-ink"
					>{formatTime(currentTime)}</span
				>
				<!-- svelte-ignore a11y_click_events_have_key_events -->
				<!-- svelte-ignore a11y_no_static_element_interactions -->
				<div class="h-1.5 flex-1 cursor-pointer bg-stone-200" onclick={seek}>
					<div
						class="h-full bg-brand-red"
						style="width: {duration > 0 ? (currentTime / duration) * 100 : 0}%"
					></div>
				</div>
				<span class="font-mono text-[10px] font-bold tracking-widest text-stone-500"
					>{formatTime(duration)}</span
				>
			</div>

			<div class="flex items-center px-2 text-ink">
				<!-- Volume Icon (static for now, matches design) -->
				<svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"
					><path
						stroke-linecap="round"
						stroke-linejoin="round"
						stroke-width="2"
						d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
					/></svg
				>
			</div>
		</div>

		<Button type="button" variant="ghost" size="sm" onclick={replay} class="mt-2">
			Replay from the start
		</Button>

		<!-- Hidden Native Audio Element -->
		<audio
			bind:this={audioEl}
			bind:currentTime
			bind:duration
			bind:paused
			preload="metadata"
			src={resolve('/media/[publicId]', { publicId: audio.publicId })}
			{oncanplay}
			{onerror}
			class="hidden"
		></audio>

		{#if broken}
			<div class="mt-4">
				<Notice tone="warning" alert>
					This audio could not be loaded. Retry the audio, or submit the attempt without answering
					this question.
				</Notice>
				<Button type="button" variant="ghost" size="sm" onclick={retry}>Retry audio</Button>
			</div>
		{/if}

		{#if revealTranscript && audio.transcript}
			<details class="mt-4">
				<summary class="cursor-pointer text-xs font-bold tracking-widest uppercase">
					Transcript
				</summary>
				<p class="mt-2 text-sm whitespace-pre-line">{audio.transcript}</p>
			</details>
		{/if}
	</div>
{/if}
