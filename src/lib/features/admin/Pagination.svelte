<script lang="ts">
	type Props = {
		page: number;
		pageCount: number;
		/** Builds the URL for a page number; must already go through resolve(). */
		href: (page: number) => string;
	};

	let { page, pageCount, href }: Props = $props();
</script>

{#if pageCount > 1}
	<nav class="mt-4 flex flex-wrap gap-1" aria-label="Pagination">
		{#each Array.from({ length: pageCount }, (_, i) => i + 1) as n (n)}
			<a
				href={href(n)}
				aria-current={n === page ? 'page' : undefined}
				aria-label="Page {n}"
				class="min-w-8 border border-line-strong px-2 py-1 text-center text-sm font-bold no-underline {n ===
				page
					? 'border-brand-red bg-brand-red text-white'
					: 'bg-white text-ink'}">{n}</a
			>
		{/each}
	</nav>
{/if}
