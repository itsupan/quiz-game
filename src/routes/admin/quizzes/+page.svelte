<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import Notice from '$lib/components/Notice.svelte';
	import FilterBar from '$lib/features/admin/FilterBar.svelte';
	import { CONTENT_STATUS, JLPT_LEVELS, QUIZ_MODES } from '$lib/domain/enums';
	import type { PageProps } from './$types';

	let { data, form }: PageProps = $props();

	function pageHref(number: number) {
		const query = new URLSearchParams({
			...Object.fromEntries(page.url.searchParams),
			page: String(number)
		});
		return resolve(`/admin/quizzes?${query}`);
	}

	function formatUpdated(date: Date) {
		const diff = Date.now() - date.getTime();
		const days = Math.floor(diff / (1000 * 60 * 60 * 24));
		if (days === 0) return 'Today';
		if (days < 7) return `${days}d ago`;
		if (days < 30) return `${Math.floor(days / 7)}w ago`;
		return new Intl.DateTimeFormat('en-US', { month: 'short', day: 'numeric' }).format(date);
	}
</script>

<div class="mx-auto max-w-[1400px] px-8 py-8">
	<!-- Header -->
	<div class="mb-8 flex items-end justify-between border-b border-ink pb-6">
		<div>
			<h1 class="m-0 text-3xl font-black tracking-tight text-ink">Manage Quiz Sets</h1>
			<p class="m-0 mt-1 text-sm text-muted">
				Organize, edit, and create new assessment modules. Ensure all content is tagged correctly
				for the learning engine.
			</p>
		</div>
		<a
			href={resolve('/admin/quizzes/new')}
			class="flex items-center gap-2 bg-brand-red px-4 py-2 text-xs font-bold tracking-widest text-white uppercase no-underline transition-colors hover:bg-brand-red-dark"
		>
			<i class="fi fi-rs-plus-circle" aria-hidden="true"></i> New Set
		</a>
	</div>

	{#if form?.message}
		<Notice tone={form.ok ? 'success' : 'danger'} alert>{form.message}</Notice>
	{/if}

	<!-- Filters -->
	<FilterBar>
		<label>
			Status
			<select name="status" onchange={(e) => e.currentTarget.form?.submit()}>
				<option value="">All</option>
				{#each CONTENT_STATUS as status (status)}
					<option value={status} selected={data.filters.status === status}>{status}</option>
				{/each}
			</select>
		</label>
		<label>
			Level
			<select name="level" onchange={(e) => e.currentTarget.form?.submit()}>
				<option value="">All</option>
				{#each JLPT_LEVELS as level (level)}
					<option value={level} selected={data.filters.level === level}>{level}</option>
				{/each}
			</select>
		</label>
		<label>
			Mode
			<select name="mode" onchange={(e) => e.currentTarget.form?.submit()}>
				<option value="">All</option>
				{#each QUIZ_MODES as mode (mode)}
					<option value={mode} selected={data.filters.mode === mode}>{mode}</option>
				{/each}
			</select>
		</label>
		<label>
			Sort
			<select name="sort" onchange={(e) => e.currentTarget.form?.submit()}>
				<option value="" selected={data.filters.sort !== 'oldest'}>Newest first</option>
				<option value="oldest" selected={data.filters.sort === 'oldest'}>Oldest first</option>
			</select>
		</label>
	</FilterBar>

	{#if data.items.length === 0}
		<p class="border-2 border-dashed border-line p-6 text-center text-muted" data-testid="empty">
			No quizzes match these filters. <a
				class="font-semibold text-brand-red"
				href={resolve('/admin/quizzes/new')}>Add one</a
			>.
		</p>
	{:else}
		<!-- Grid of Cards -->
		<div class="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
			{#each data.items as quiz, i (quiz.publicId)}
				<a
					href={resolve('/admin/quizzes/[publicId]', { publicId: quiz.publicId })}
					class="group flex flex-col border border-ink bg-white p-6 no-underline transition-colors hover:bg-stone-50"
				>
					<div class="mb-6 flex items-start justify-between">
						<!-- Big red number -->
						<div class="text-[2.5rem] leading-none font-black tracking-tighter text-brand-red">
							{String(i + 1).padStart(2, '0')}/
						</div>
						<!-- JLPT Level Badge -->
						<div
							class="border border-ink bg-stone-100 px-2 py-0.5 text-[10px] font-bold tracking-widest text-ink uppercase"
						>
							{quiz.level ? `JLPT ${quiz.level}` : 'ANY LEVEL'}
						</div>
					</div>

					<h2 class="m-0 mb-3 text-xl font-black tracking-tight text-ink">{quiz.title}</h2>

					<!-- Tags -->
					<div class="mb-4 flex flex-wrap gap-2">
						{#each quiz.sections as section (section)}
							{#if section === 'VOCAB_KANJI'}
								<span
									class="bg-stone-200 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-ink uppercase"
									>VOCABULARY</span
								>
							{:else if section === 'LISTENING'}
								<span
									class="bg-brand-red px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-white uppercase"
									>LISTENING</span
								>
							{:else if section === 'GRAMMAR_READING'}
								<span
									class="bg-brand-red px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-white uppercase"
									>GRAMMAR</span
								>
								<span
									class="bg-stone-200 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-ink uppercase"
									>READING</span
								>
							{/if}
						{/each}
						{#if quiz.sections.length === 0}
							<span
								class="bg-stone-200 px-1.5 py-0.5 text-[8px] font-bold tracking-widest text-ink uppercase"
								>NO SECTIONS</span
							>
						{/if}
					</div>

					<!-- Description -->
					<p class="m-0 mb-8 line-clamp-3 flex-1 text-sm text-muted">
						{quiz.description || 'No description available for this quiz set.'}
					</p>

					<!-- Footer Stats -->
					<div class="mt-auto flex items-center justify-between border-t border-ink pt-4">
						<div>
							<div class="mb-1 text-[10px] font-bold tracking-widest text-muted uppercase">
								Questions
							</div>
							<div class="text-lg leading-none font-bold text-ink">{quiz.questionCount}</div>
						</div>
						<div class="text-right">
							<div class="mb-1 text-[10px] font-bold tracking-widest text-muted uppercase">
								Updated
							</div>
							<div class="text-sm leading-none font-medium text-ink">
								{formatUpdated(quiz.updatedAt)}
							</div>
						</div>
					</div>
				</a>
			{/each}
		</div>

		<!-- Pagination -->
		<div class="flex items-center justify-between border-t border-ink bg-stone-100 p-3">
			<div class="text-[10px] font-bold tracking-widest text-muted uppercase">
				Showing page {data.page} of {data.pageCount || 1}
			</div>
			<div class="flex gap-1">
				<a
					href={pageHref(Math.max(1, data.page - 1))}
					aria-label="Previous page"
					class="flex h-6 w-6 items-center justify-center border border-ink bg-white text-[10px] transition-colors hover:bg-stone-50"
					><i class="fi fi-rs-angle-left" aria-hidden="true"></i></a
				>
				<span
					class="flex h-6 w-6 items-center justify-center border border-ink bg-brand-red text-[10px] font-bold text-white"
					>{data.page}</span
				>
				{#if data.page < (data.pageCount || 1)}
					<a
						href={pageHref(data.page + 1)}
						class="flex h-6 w-6 items-center justify-center border border-ink bg-white text-[10px] font-bold transition-colors hover:bg-stone-50"
						>{data.page + 1}</a
					>
				{/if}
				<a
					href={pageHref(Math.min(data.pageCount || 1, data.page + 1))}
					aria-label="Next page"
					class="flex h-6 w-6 items-center justify-center border border-ink bg-white text-[10px] transition-colors hover:bg-stone-50"
					><i class="fi fi-rs-angle-right" aria-hidden="true"></i></a
				>
			</div>
		</div>
	{/if}
</div>
