<script lang="ts">
	import { setMuted, soundSettings } from './sound.svelte';

	let {
		class: className = '',
		onchange
	}: {
		class?: string;
		/** Called after the preference flips, with the new muted state. */
		onchange?: (muted: boolean) => void;
	} = $props();

	function toggle() {
		setMuted(!soundSettings.muted);
		onchange?.(soundSettings.muted);
	}
</script>

<button
	type="button"
	class="inline-flex min-h-8 min-w-8 cursor-pointer items-center justify-center border-2 border-line-strong bg-white px-2 text-ink transition-colors hover:border-ink focus-visible:outline-3 focus-visible:outline-offset-4 {className}"
	aria-label="Mute sounds"
	aria-pressed={soundSettings.muted}
	title={soundSettings.muted ? 'Unmute sounds' : 'Mute sounds'}
	onclick={toggle}
>
	<i
		class="fi {soundSettings.muted ? 'fi-rs-volume-mute' : 'fi-rs-volume'} flex text-base"
		aria-hidden="true"
	></i>
</button>
