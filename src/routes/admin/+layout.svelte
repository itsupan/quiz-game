<script lang="ts">
	import { resolve } from '$app/paths';
	import AppShell from '$lib/components/AppShell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const navLinks = [
		{ href: resolve('/admin'), label: 'Overview' },
		{ href: resolve('/admin/quizzes'), label: 'Quizzes' },
		{ href: resolve('/admin/questions'), label: 'Questions' },
		{ href: resolve('/admin/media'), label: 'Media' }
	];
</script>

<svelte:head>
	<title>Admin · QuizGame</title>
	<!-- Nothing under /admin should ever be indexed or cached by an intermediary. -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<AppShell {navLinks} user={data.user} navLabel="Admin sections">
	{@render children()}
</AppShell>
