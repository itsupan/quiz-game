<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const links = [
		{ href: resolve('/admin'), label: 'Overview' },
		{ href: resolve('/admin/quizzes'), label: 'Quizzes' },
		{ href: resolve('/admin/questions'), label: 'Questions' },
		{ href: resolve('/admin/media'), label: 'Media' }
	];

	/** Overview is the only prefix of every other link, so it matches exactly. */
	const isCurrent = (href: string) =>
		href === resolve('/admin') ? page.url.pathname === href : page.url.pathname.startsWith(href);
</script>

<svelte:head>
	<title>Admin · quiz-game</title>
	<!-- Nothing under /admin should ever be indexed or cached by an intermediary. -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<div class="shell">
	<header>
		<a class="brand" href={resolve('/')}>quiz-game</a>

		<nav aria-label="Admin sections">
			<ul>
				{#each links as link (link.href)}
					<li>
						<a href={link.href} aria-current={isCurrent(link.href) ? 'page' : undefined}>
							{link.label}
						</a>
					</li>
				{/each}
			</ul>
		</nav>

		<p class="who">
			{data.admin.displayName}
			<span>{data.admin.email}</span>
		</p>
	</header>

	<main>
		{@render children()}
	</main>
</div>

<style>
	.shell {
		min-height: 100vh;
		display: flex;
		flex-direction: column;
	}

	header {
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		gap: 1rem 1.5rem;
		padding: 0.75rem 1.5rem;
		background: var(--surface);
		border-bottom: 1px solid var(--line);
	}

	.brand {
		font-weight: 700;
		color: var(--ink);
		text-decoration: none;
		letter-spacing: -0.01em;
	}

	nav ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.25rem;
		list-style: none;
		margin: 0;
		padding: 0;
	}

	nav a {
		display: block;
		padding: 0.375rem 0.75rem;
		border-radius: var(--radius-sm);
		color: var(--ink-muted);
		text-decoration: none;
		font-size: 0.9375rem;
		font-weight: 550;
	}

	nav a:hover {
		background: var(--surface-sunken);
		color: var(--ink);
	}

	nav a[aria-current='page'] {
		background: var(--accent-soft);
		color: var(--accent);
	}

	.who {
		margin: 0 0 0 auto;
		font-size: 0.8125rem;
		line-height: 1.3;
		text-align: right;
	}

	.who span {
		display: block;
		color: var(--ink-faint);
	}

	main {
		flex: 1;
		width: 100%;
		max-width: 68rem;
		margin: 0 auto;
		padding: 1.75rem 1.5rem 4rem;
	}
</style>
