<script lang="ts">
	import { resolve } from '$app/paths';
	import AppShell from '$lib/components/AppShell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const navLinks = [
		{ href: resolve('/home'), label: 'DASHBOARD' },
		{ href: resolve('/leaderboard'), label: 'LEADERBOARD' },
		{ href: resolve('/analytics'), label: 'ANALYTICS' }
	];
</script>

<AppShell {navLinks} user={data.user} navLabel="Learner Sections" searchAction={resolve('/home')}>
	{@render children()}
</AppShell>
