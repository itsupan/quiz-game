<script lang="ts">
	import { afterNavigate } from '$app/navigation';
	import { flip } from 'svelte/animate';
	import { backOut, cubicOut } from 'svelte/easing';
	import { toast } from './toast-store.svelte';

	/**
	 * `afterNavigate`, not `onMount`: this component lives in the root layout, which
	 * SvelteKit keeps mounted across client-side navigations rather than recreating, so
	 * `onMount` would only ever fire once and miss the very redirect a queued toast is
	 * waiting for.
	 */
	afterNavigate(() => {
		toast.flushQueued();
	});

	const tones = {
		success: {
			card: 'border-success bg-success-soft',
			text: 'text-success',
			icon: 'fi-rs-check-circle'
		},
		danger: {
			card: 'border-danger bg-danger-soft',
			text: 'text-danger',
			icon: 'fi-rs-circle-xmark'
		}
	} as const;

	const labels = { success: 'Success', danger: 'Error' } as const;

	/** Rises and pops slightly past full size before settling — the "arrival" a toast needs. */
	function popIn(_node: HTMLElement, { delay = 0 }: { delay?: number } = {}) {
		return {
			delay,
			duration: 400,
			easing: backOut,
			css: (t: number) => `
				transform: translateY(${(1 - t) * 20}px) scale(${0.9 + t * 0.1});
				opacity: ${t};
			`
		};
	}

	/** Slides toward the close button's side and shrinks — the direction dismissal reads as. */
	// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Svelte's `out:` calls this with the node; it isn't needed here.
	function slideOut(_node: HTMLElement) {
		return {
			duration: 200,
			easing: cubicOut,
			css: (t: number) => `
				transform: translateX(${(1 - t) * 60}px) scale(${0.95 + t * 0.05});
				opacity: ${t};
			`
		};
	}
</script>

<div
	class="pointer-events-none fixed inset-x-0 bottom-0 z-100 flex flex-col items-stretch gap-2 p-4 sm:inset-x-auto sm:right-0 sm:items-end"
	aria-live="polite"
>
	{#each toast.items as item, i (item.id)}
		{@const tone = tones[item.tone]}
		{@const isNewest = i === toast.items.length - 1}
		<div
			role="status"
			animate:flip={{ duration: 250, easing: cubicOut }}
			in:popIn
			out:slideOut
			onmouseenter={() => toast.pause(item.id)}
			onmouseleave={() => toast.resume(item.id)}
			onfocusin={() => toast.pause(item.id)}
			onfocusout={() => toast.resume(item.id)}
			class="group pointer-events-auto flex w-full items-start gap-3 border-2 p-4 shadow-hard transition-[opacity,transform,box-shadow] duration-200 hover:-translate-y-0.5 hover:shadow-hard-lg sm:w-96 {tone.card}"
			style:opacity={isNewest ? 1 : 0.82}
		>
			<i class="fi {tone.icon} mt-0.5 text-lg {tone.text}" aria-hidden="true"></i>
			<div class="flex-1">
				<p class="text-[10px] font-black tracking-widest uppercase {tone.text}">
					{labels[item.tone]}
				</p>
				<p class="mt-0.5 text-sm font-semibold text-ink">{item.message}</p>
			</div>
			<button
				type="button"
				onclick={() => toast.dismiss(item.id)}
				aria-label="Dismiss notification"
				class="text-ink/50 opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100 hover:text-ink"
			>
				<i class="fi fi-rs-cross-small flex text-base" aria-hidden="true"></i>
			</button>
		</div>
	{/each}
</div>
