<script lang="ts">
	import { resolve } from '$app/paths';
	import type { QuizCardItem } from './dashboard';

	let { card }: { card: QuizCardItem } = $props();

	const duration = $derived(
		card.timeLimitSeconds === null ? 'Untimed' : `${Math.round(card.timeLimitSeconds / 60)} min`
	);
</script>

<li class="flex">
	<article
		class="relative flex flex-1 flex-col justify-between border-2 border-ink bg-white p-6 transition-shadow hover:shadow-lg"
	>
		<div>
			<div class="mb-4 flex items-center justify-between">
				{#if card.categoryStyle === 'boxed'}
					<span
						class="border border-ink px-2 py-0.5 text-[11px] font-bold tracking-widest text-ink uppercase"
						>{card.category}</span
					>
				{:else}
					<span
						class="inline-block border-b border-ink pb-0.5 text-xs font-bold tracking-widest text-ink uppercase"
						>{card.category}</span
					>
				{/if}

				<div class="text-brand-red">
					<i class="fi fi-rs-{card.icon} flex text-xl" aria-hidden="true"></i>
				</div>
			</div>

			<h3 class="mb-2 text-xl leading-snug font-black tracking-tight text-ink">{card.title}</h3>
			<p class="line-clamp-2 min-h-[2.5rem] text-xs leading-relaxed text-stone-600 sm:text-sm">
				{card.description}
			</p>
		</div>

		<div class="mt-6">
			<div class="mb-5 border-b-2 border-dotted border-ink" aria-hidden="true"></div>
			<div
				class="mb-3 flex items-center justify-between text-xs font-bold tracking-wider text-stone-500 uppercase"
			>
				<span>{card.mode.replace('_', ' ')}</span>
				<span>{duration}</span>
			</div>
			<a
				href={resolve('/(main)/quiz/[publicId]', { publicId: card.id })}
				class="flex cursor-pointer items-center justify-center bg-brand-red px-3 py-2.5 text-center text-xs font-black tracking-wider text-white uppercase no-underline transition-colors hover:bg-brand-red-dark"
				>Start</a
			>
		</div>
	</article>
</li>
