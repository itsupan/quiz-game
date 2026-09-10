<script lang="ts">
	import { resolve } from '$app/paths';
	import Card from '$lib/components/Card.svelte';
	import PageHeader from '$lib/features/admin/PageHeader.svelte';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();

	const tiles = $derived([
		{
			title: 'Quizzes',
			href: resolve('/admin/quizzes'),
			total: data.overview.quizzes.total,
			breakdown: [
				{ label: 'published', value: data.overview.quizzes.published },
				{ label: 'draft', value: data.overview.quizzes.draft }
			]
		},
		{
			title: 'Questions',
			href: resolve('/admin/questions'),
			total: data.overview.questions.total,
			breakdown: [
				{ label: 'published', value: data.overview.questions.published },
				{ label: 'draft', value: data.overview.questions.draft }
			]
		},
		{
			title: 'Learners',
			href: null,
			total: data.overview.users.total,
			breakdown: [
				{ label: 'admins', value: data.overview.users.admins },
				{ label: 'suspended', value: data.overview.users.suspended }
			]
		},
		{
			title: 'Attempts',
			href: null,
			total: data.overview.attempts.total,
			breakdown: [
				{ label: 'submitted', value: data.overview.attempts.submitted },
				{ label: 'last 7 days', value: data.overview.attempts.lastSevenDays }
			]
		}
	]);
</script>

<PageHeader title="Overview" lede="Everything in the content bank, at a glance." />

<ul class="m-0 grid list-none grid-cols-[repeat(auto-fit,minmax(13rem,1fr))] gap-4 p-0">
	{#each tiles as tile (tile.title)}
		<li>
			<Card raised class="h-full p-5">
				<h2 class="m-0 text-xs font-bold tracking-widest text-muted uppercase">
					{#if tile.href}
						<a class="no-underline hover:text-brand-red" href={tile.href}>{tile.title}</a>
					{:else}
						{tile.title}
					{/if}
				</h2>

				<p
					class="mt-1 mb-3 text-5xl font-black tracking-tight text-brand-red tabular-nums"
					data-testid="total-{tile.title.toLowerCase()}"
				>
					{tile.total}
				</p>

				<dl class="m-0 flex gap-5 text-xs">
					{#each tile.breakdown as part (part.label)}
						<div>
							<dt class="text-muted">{part.label}</dt>
							<dd class="m-0 font-bold tabular-nums">{part.value}</dd>
						</div>
					{/each}
				</dl>
			</Card>
		</li>
	{/each}
</ul>
