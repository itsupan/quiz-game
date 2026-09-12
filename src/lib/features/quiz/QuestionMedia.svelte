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

	function replay() {
		if (!audioEl) return;

		audioEl.currentTime = 0;
		// A rejection here (autoplay policy, or the element unmounting mid-play) is not an
		// error a learner needs to see — the transport controls are still right there.
		audioEl.play().catch(() => {});
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
		class="mb-4 max-h-80 border border-line"
	/>
{/if}

{#if audio}
	<div class="mb-4">
		<audio
			bind:this={audioEl}
			controls
			preload="metadata"
			src={resolve('/media/[publicId]', { publicId: audio.publicId })}
			{oncanplay}
			{onerror}
			class="mb-2 w-full"
		></audio>

		<Button type="button" variant="ghost" size="sm" onclick={replay}>Replay from the start</Button>

		{#if broken}
			<Notice tone="warning" alert>
				This audio could not be loaded. Retry the audio, or submit the attempt without answering
				this question.
			</Notice>
			<Button type="button" variant="ghost" size="sm" onclick={retry}>Retry audio</Button>
		{/if}

		{#if revealTranscript && audio.transcript}
			<details class="mt-2">
				<summary class="cursor-pointer text-xs font-bold tracking-widest uppercase">
					Transcript
				</summary>
				<p class="mt-2 text-sm whitespace-pre-line">{audio.transcript}</p>
			</details>
		{/if}
	</div>
{/if}
