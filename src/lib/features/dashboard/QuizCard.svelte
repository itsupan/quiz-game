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
		class="group relative z-0 flex flex-1 animate-fade-up flex-col justify-between overflow-hidden bg-white p-6 opacity-0 transition-all duration-300 ease-out before:absolute before:inset-[-150%] before:z-[-2] before:animate-[spin_4s_linear_infinite] before:bg-[conic-gradient(from_90deg_at_50%_50%,var(--color-ink)_0%,#facc15_50%,var(--color-ink)_100%)] before:content-[''] after:absolute after:inset-[2px] after:z-[-1] after:bg-white after:content-[''] hover:-translate-y-1 hover:shadow-hard-lg"
	>
		{#if card.cornerTriangle}
			<div
				class="pointer-events-none absolute top-0 right-0 z-10 h-0 w-0 border-t-[28px] border-r-[28px] border-b-[28px] border-l-[28px] border-t-brand-red border-r-brand-red border-b-transparent border-l-transparent"
				aria-hidden="true"
			></div>
		{/if}

		<div class="relative z-10 flex h-full flex-col justify-between">
			<div>
				<div class="mb-4 flex items-center justify-between">
					{#if card.categoryStyle === 'boxed'}
						<span
							class="border border-ink bg-white px-2 py-0.5 text-[11px] font-bold tracking-widest text-ink uppercase"
							>{card.category}</span
						>
					{:else}
						<span
							class="inline-block border-b border-ink pb-0.5 text-xs font-bold tracking-widest text-ink uppercase"
							>{card.category}</span
						>
					{/if}

					<div class="text-brand-red">
						{#if card.icon === 'book'}
							<svg
								class="h-5 w-5"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path>
								<path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path>
							</svg>
						{:else if card.icon === 'flask'}
							<svg
								class="h-5 w-5"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<path d="M10 2v7.31L4.69 18.66A2 2 0 0 0 6.4 22h11.2a2 2 0 0 0 1.71-3.34L14 9.31V2"
								></path>
								<line x1="8.5" y1="2" x2="15.5" y2="2"></line>
								<line x1="7" y1="16" x2="17" y2="16"></line>
							</svg>
						{:else}
							<svg
								class="h-5 w-5 text-ink"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								viewBox="0 0 24 24"
								aria-hidden="true"
							>
								<rect x="3" y="3" width="18" height="18" rx="1"></rect>
								<line x1="3" y1="9" x2="21" y2="9"></line>
								<line x1="9" y1="21" x2="9" y2="9"></line>
							</svg>
						{/if}
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
					class="mb-3 flex items-center justify-between text-xs font-bold tracking-wider text-stone-700 uppercase"
				>
					<span>{card.mode.replace('_', ' ')}</span>
					<span>{duration}</span>
				</div>
				<a
					href={resolve('/(main)/quiz/[publicId]', { publicId: card.id })}
					class="flex cursor-pointer items-center justify-center border-2 border-transparent bg-brand-red px-3 py-2.5 text-center text-xs font-black tracking-wider text-white uppercase no-underline transition-colors hover:border-ink hover:bg-brand-red-dark"
					>Start</a
				>
			</div>
		</div>
	</article>
</li>
