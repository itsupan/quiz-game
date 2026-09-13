<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import { SECTIONS, type Section } from '$lib/domain/enums';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const SECTION_LABELS: Record<Section, string> = {
		VOCAB_KANJI: 'Vocab / Kanji',
		GRAMMAR_READING: 'Grammar / Reading',
		LISTENING: 'Listening'
	};

	function sectionHref(section: Section | null) {
		const params: Record<string, string> = { ...Object.fromEntries(page.url.searchParams) };
		delete params.page;
		if (section) params.section = section;
		else delete params.section;
		return `${resolve('/admin/questions')}?${new URLSearchParams(params)}`;
	}
</script>

<div class="flex max-h-screen bg-stone-50 text-ink">
	<!-- Left Side: Question Repository -->
	<div class="flex w-1/3 max-w-[480px] min-w-[360px] flex-col border-r border-ink bg-stone-50">
		<div class="border-b border-ink p-6">
			<h1 class="m-0 mb-4 text-2xl font-black tracking-tight text-ink">Question Repository</h1>
			<form method="GET" action={resolve('/admin/questions')} class="mb-4 flex gap-2">
				<div class="flex flex-1 items-center border border-ink bg-white px-3 py-1">
					<i class="fi fi-rs-search text-muted" aria-hidden="true"></i>
					<input
						type="search"
						name="q"
						value={data.filters.q ?? ''}
						placeholder="Search questions..."
						class="w-full border-none bg-transparent px-2 py-1 text-xs outline-none"
					/>
				</div>
				{#if data.filters.section}
					<input type="hidden" name="section" value={data.filters.section} />
				{/if}
				<button
					type="submit"
					class="flex items-center gap-2 border border-ink bg-white px-3 py-1 text-[10px] font-bold tracking-widest uppercase transition-colors hover:bg-stone-100"
				>
					<i class="fi fi-rs-search text-muted" aria-hidden="true"></i> Search
				</button>
			</form>
			<!-- eslint-disable svelte/no-navigation-without-resolve -->
			<div class="flex flex-wrap gap-1 text-[8px] font-bold tracking-widest uppercase">
				<a
					href={sectionHref(null)}
					class="px-2 py-1 no-underline {data.filters.section
						? 'bg-ink text-white'
						: 'bg-brand-red text-white'}">ALL</a
				>
				{#each SECTIONS as section (section)}
					<a
						href={sectionHref(section)}
						class="px-2 py-1 no-underline {data.filters.section === section
							? 'bg-brand-red text-white'
							: 'bg-ink text-white'}">{SECTION_LABELS[section]}</a
					>
				{/each}
			</div>
			<!-- eslint-enable svelte/no-navigation-without-resolve -->
		</div>

		<!-- List of cards -->
		<div class="flex-1 space-y-4 overflow-y-auto p-4">
			{#each data.items as question, i (question.publicId)}
				<a
					href={resolve(`/admin/questions/${question.publicId}`)}
					class="relative block border bg-white p-4 no-underline transition-colors hover:bg-stone-50 {page
						.params.publicId === question.publicId
						? 'border-brand-red'
						: 'border-ink'}"
				>
					<div class="mb-3 flex items-center justify-between">
						<div class="flex items-center gap-2">
							<div
								class="text-3xl leading-none font-black tracking-tighter {page.params.publicId ===
								question.publicId
									? 'text-brand-red'
									: 'text-ink'}"
							>
								{String(i + 1).padStart(2, '0')}/
							</div>
							<div
								class="bg-ink px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-white uppercase"
							>
								{question.section}
							</div>
							<div
								class="border border-ink bg-stone-100 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-ink uppercase"
							>
								{question.level}
							</div>
						</div>
						<i class="fi fi-rs-pencil text-muted" aria-hidden="true"></i>
					</div>
					<p class="m-0 line-clamp-2 text-sm text-ink">
						{question.stem}
					</p>
				</a>
			{/each}
		</div>
	</div>

	<!-- Right Side: Edit Question / Slot -->
	<div class="flex-1 overflow-y-auto bg-white">
		{@render children()}
	</div>
</div>
