<script lang="ts">
	import { resolve } from '$app/paths';
	import AppShell from '$lib/components/AppShell.svelte';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	const navLinks = [
		{ href: resolve('/home'), label: 'DASHBOARD', icon: 'home' },
		{ href: resolve('/leaderboard'), label: 'LEADERBOARD', icon: 'trophy' },
		{ href: resolve('/analytics'), label: 'ANALYTICS', icon: 'stats' },
		{ href: resolve('/our-team'), label: 'OUR TEAM', icon: 'users' }
	];
</script>

<AppShell {navLinks} user={data.user} navLabel="Learner Sections" searchAction={resolve('/home')}>
	{@render children()}
</AppShell>
