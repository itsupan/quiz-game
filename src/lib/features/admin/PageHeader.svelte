<script lang="ts">
	import type { Snippet } from 'svelte';
	import NavLink from '$lib/components/NavLink.svelte';

	type Props = {
		title: string;
		/** Supporting line under the title — a count, a scope, a caveat. */
		lede?: string;
		/** Breadcrumb back to the section index. `href` must already go through resolve(). */
		back?: { href: string; label: string };
		/** A status line under the title — badge, timestamps. */
		meta?: Snippet;
		/** The page's single primary action, if it has one. */
		action?: Snippet;
	};

	let { title, lede, back, meta, action }: Props = $props();
</script>

<div class="mb-6 border-b-2 border-ink pb-4">
	{#if back}
		<NavLink
			href={back.href}
			class="mb-1 inline-block text-xs font-bold tracking-widest text-muted uppercase no-underline hover:text-brand-red"
		>
			← {back.label}
		</NavLink>
	{/if}

	<div class="flex flex-wrap items-end justify-between gap-4">
		<div>
			<h1 class="m-0 text-3xl font-black tracking-tight text-ink uppercase">{title}</h1>
			{#if lede}
				<p class="m-0 mt-1 text-sm text-muted">{lede}</p>
			{/if}
			{#if meta}
				<p
					class="m-0 mt-2 flex flex-wrap items-center gap-3 text-[10px] font-bold tracking-widest text-muted uppercase"
				>
					{@render meta()}
				</p>
			{/if}
		</div>

		{#if action}
			{@render action()}
		{/if}
	</div>
</div>
