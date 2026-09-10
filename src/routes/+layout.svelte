<script lang="ts">
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import favicon from '$lib/assets/favicon.svg';
	import '../app.css';

	let { data, children } = $props();

	// So signing in from a page returns to it rather than dumping you on the homepage.
	const signInHref = $derived(
		resolve(`/auth/google?redirectTo=${encodeURIComponent(page.url.pathname + page.url.search)}`)
	);
</script>

<svelte:head>
	<link rel="icon" href={favicon} />
</svelte:head>

<header class="site">
	<a class="brand" href={resolve('/')}>quiz-game</a>

	<nav aria-label="Account">
		{#if data.user}
			<span class="who">{data.user.displayName}</span>
			{#if data.user.role === 'ADMIN'}
				<a href={resolve('/admin')}>Admin</a>
			{/if}
			<!-- POST, so a link or an image cannot sign someone out, and SvelteKit's
			     origin check applies. -->
			<form method="POST" action={resolve('/auth/signout')}>
				<button type="submit">Sign out</button>
			</form>
		{:else}
			<a class="signin" href={signInHref}>Sign in with Google</a>
		{/if}
	</nav>
</header>

{@render children()}

<style>
	.site {
		display: flex;
		align-items: center;
		gap: 1rem;
		padding: 0.625rem 1.5rem;
		background: var(--surface);
		border-bottom: 1px solid var(--line);
	}

	.brand {
		font-weight: 700;
		color: var(--ink);
		text-decoration: none;
		letter-spacing: -0.01em;
	}

	nav {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		margin-left: auto;
		font-size: 0.9375rem;
	}

	.who {
		color: var(--ink-muted);
	}

	nav a {
		text-decoration: none;
		font-weight: 550;
	}

	.signin {
		padding: 0.4375rem 0.75rem;
		border-radius: var(--radius-sm);
		background: var(--accent);
		color: var(--accent-ink);
	}

	nav form {
		display: contents;
	}

	nav button {
		padding: 0.375rem 0.6875rem;
		border: 1px solid var(--line-strong);
		border-radius: var(--radius-sm);
		background: var(--surface);
		font-size: 0.875rem;
		font-weight: 550;
	}
</style>
