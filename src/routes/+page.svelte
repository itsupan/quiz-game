<script lang="ts">
	import { resolve } from '$app/paths';
	import type { PageProps } from './$types';

	let { data }: PageProps = $props();
</script>

<svelte:head>
	<title>quiz-game</title>
</svelte:head>

<main>
	<h1>Hello world</h1>
	<p>SvelteKit is running on Cloudflare Workers, reading from D1.</p>

	<h2>Quizzes</h2>
	{#if data.quizzes.length > 0}
		<ul>
			{#each data.quizzes as quiz (quiz.id)}
				<li>
					<strong>{quiz.title}</strong>
					<span>added {quiz.createdAt.toLocaleDateString('en-CA')}</span>
				</li>
			{/each}
		</ul>
	{:else}
		<p data-testid="empty">
			No quizzes yet. Run <code>pnpm db:migrate:local</code> to seed the local database.
		</p>
	{/if}

	<p><a href={resolve('/api/health')}>Check database health</a></p>
</main>

<style>
	main {
		max-width: 40rem;
		margin: 0 auto;
		padding: 2rem 1rem;
		font-family: system-ui, sans-serif;
		line-height: 1.6;
	}

	li span {
		color: #666;
		font-size: 0.875rem;
	}
</style>
