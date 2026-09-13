<script lang="ts">
	import { onNavigate } from '$app/navigation';
	import './layout.css';
	import Toast from '$lib/components/Toast.svelte';
	import type { LayoutProps } from './$types';

	let { children }: LayoutProps = $props();

	/** Crossfades between pages instead of the abrupt swap a plain client-side nav gives. */
	onNavigate((navigation) => {
		if (!document.startViewTransition) return;

		return new Promise((resolve) => {
			document.startViewTransition(async () => {
				resolve();
				await navigation.complete;
			});
		});
	});
</script>

<svelte:head>
	<title>QuizGame</title>
	<meta
		name="description"
		content="QuizGame — learn Japanese through engaging, progress-driven quizzes."
	/>
	<meta name="application-name" content="QuizGame" />
	<meta name="theme-color" content="#b6251f" />
	<meta property="og:site_name" content="QuizGame" />
	<link rel="icon" href="/brand/logo_icon.png" type="image/png" />
</svelte:head>

<!--
	Chrome lives in `$lib/components/AppShell.svelte`, mounted by the layouts that want
	it — the `(main)` group and `/admin`. It used to live here behind a hand-maintained
	list of pathnames, which meant `/admin` rendered two stacked headers and any new
	learner route would have done the same.
-->
{@render children()}
<Toast />
