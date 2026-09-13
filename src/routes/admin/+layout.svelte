<script lang="ts">
	import { resolve } from '$app/paths';
	import AdminShell from '$lib/features/admin/AdminShell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const navLinks = [
		{ href: resolve('/admin'), label: 'Overview', icon: 'apps' },
		{ href: resolve('/admin/users'), label: 'User Management', icon: 'users' },
		{ href: resolve('/admin/quizzes'), label: 'Quiz Sets', icon: 'document' },
		{ href: resolve('/admin/questions'), label: 'Question Bank', icon: 'interrogation' },
		{ href: resolve('/admin/logs'), label: 'System Logs', icon: 'computer' }
	];
</script>

<svelte:head>
	<title>Admin · QuizGame</title>
	<!-- Nothing under /admin should ever be indexed or cached by an intermediary. -->
	<meta name="robots" content="noindex, nofollow" />
</svelte:head>

<AdminShell {navLinks} user={data.user}>
	{@render children()}
</AdminShell>
