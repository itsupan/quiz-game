<script lang="ts">
	import { resolve } from '$app/paths';
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

<h1>Overview</h1>
<p class="lede">Everything in the content bank, at a glance.</p>

<ul class="tiles">
	{#each tiles as tile (tile.title)}
		<li>
			<article>
				<h2>
					{#if tile.href}
						<a href={tile.href}>{tile.title}</a>
					{:else}
						{tile.title}
					{/if}
				</h2>
				<p class="total" data-testid="total-{tile.title.toLowerCase()}">{tile.total}</p>
				<dl>
					{#each tile.breakdown as part (part.label)}
						<div>
							<dt>{part.label}</dt>
							<dd>{part.value}</dd>
						</div>
					{/each}
				</dl>
			</article>
		</li>
	{/each}
</ul>

<style>
	.lede {
		margin: 0 0 1.5rem;
		color: var(--ink-muted);
	}

	.tiles {
		display: grid;
		grid-template-columns: repeat(auto-fit, minmax(13rem, 1fr));
		gap: 1rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	article {
		height: 100%;
		padding: 1.125rem 1.25rem;
		background: var(--surface);
		border: 1px solid var(--line);
		border-radius: var(--radius);
		box-shadow: var(--shadow);
	}

	h2 {
		font-size: 0.8125rem;
		text-transform: uppercase;
		letter-spacing: 0.05em;
		color: var(--ink-muted);
		margin: 0;
	}

	h2 a {
		text-decoration: none;
		color: inherit;
	}

	h2 a:hover {
		color: var(--accent);
	}

	.total {
		margin: 0.25rem 0 0.75rem;
		font-size: 2rem;
		font-weight: 650;
		letter-spacing: -0.02em;
		font-variant-numeric: tabular-nums;
	}

	dl {
		display: flex;
		gap: 1.25rem;
		margin: 0;
		font-size: 0.8125rem;
	}

	dt {
		color: var(--ink-faint);
	}

	dd {
		margin: 0;
		font-weight: 600;
		font-variant-numeric: tabular-nums;
	}
</style>
