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
			{#each data.quizzes as quiz (quiz.publicId)}
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

	<h2>Getting started</h2>
	<p>
		This is still the placeholder homepage — the real one, with the hero, level filters and quiz
		cards, is its own piece of work. What exists today is the content side.
	</p>

	<ol class="guide">
		<li>
			<a href={resolve('/admin')}>Open the admin dashboard</a> to see totals for quizzes, questions, learners
			and attempts.
		</li>
		<li>
			<a href={resolve('/admin/questions')}>Questions</a> is the shared bank. Each one needs at least
			two options and exactly one marked correct before it can be published.
		</li>
		<li>
			<a href={resolve('/admin/quizzes')}>Quizzes</a> sets mode, JLPT level and time limits, then adds
			the sections that make up the paper. A quiz needs at least one section to publish.
		</li>
		<li>
			<a href={resolve('/admin/media')}>Media</a> holds images and listening audio. An image needs alt
			text and audio needs a transcript before a question using it can be published.
		</li>
	</ol>

	<p class="note" data-testid="auth-note">
		Content is archived rather than deleted, so past attempts keep working. Sign in with Google to
		save your history; the dashboard is open to administrators only.
	</p>

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

	.guide {
		padding-left: 1.25rem;
	}

	.guide li {
		margin-bottom: 0.5rem;
	}

	.note {
		padding: 0.75rem 1rem;
		border-left: 3px solid #c3cbd8;
		background: #f4f6f9;
		color: #5b6472;
		font-size: 0.9375rem;
	}
</style>
