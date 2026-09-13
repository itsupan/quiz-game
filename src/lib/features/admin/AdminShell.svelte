<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';

	export type ShellNavLink = { href: string; label: string; icon?: string };

	type Props = {
		children: Snippet;
		navLinks: ShellNavLink[];
		user: { displayName: string; avatarUrl: string | null; role: string } | null;
	};

	let { children, navLinks, user }: Props = $props();

	const isCurrent = (href: string, index: number) =>
		index === 0
			? page.url.pathname === href
			: page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<div class="flex min-h-screen bg-paper text-ink selection:bg-brand-red selection:text-white">
	<!-- Sidebar -->
	<aside class="fixed inset-y-0 left-0 z-40 flex w-64 flex-col border-r border-ink bg-stone-100">
		<div class="flex items-center gap-3 border-b border-ink px-6 py-6">
			<div
				class="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden border-2 border-ink bg-white"
			>
				{#if user?.avatarUrl}
					<img src={user.avatarUrl} alt="" class="h-full w-full object-cover" />
				{:else}
					<i class="fi fi-rs-user flex text-2xl" aria-hidden="true"></i>
				{/if}
			</div>
			<div>
				<div class="text-sm leading-tight font-bold tracking-wider text-brand-red uppercase">
					Admin Portal
				</div>
				<div class="mt-0.5 text-[10px] tracking-widest text-muted uppercase">System Control</div>
			</div>
		</div>

		<div class="border-b border-ink">
			<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
			<a
				href={resolve('/admin/quizzes/new')}
				class="flex w-full items-center justify-between bg-brand-red px-6 py-4 text-xs font-bold tracking-wider text-white no-underline transition-colors hover:bg-brand-red-dark"
			>
				<span>CREATE NEW QUIZ</span>
				<i class="fi fi-rs-plus flex text-lg leading-none" aria-hidden="true"></i>
			</a>
		</div>

		<nav class="flex flex-1 flex-col overflow-y-auto py-2">
			{#each navLinks as link, i (link.href)}
				<!-- eslint-disable svelte/no-navigation-without-resolve -->
				<a
					href={link.href}
					class="flex items-center gap-3 border border-transparent px-6 py-3 text-xs font-bold tracking-widest uppercase transition-all {isCurrent(
						link.href,
						i
					)
						? 'translate-x-1 border-brand-red bg-brand-red text-white'
						: 'text-stone-700 hover:border-ink hover:bg-stone-200 hover:text-ink'}"
				>
					{#if link.icon}
						<i class="fi fi-rs-{link.icon} flex text-lg" aria-hidden="true"></i>
					{/if}
					{link.label}
				</a>
			{/each}
		</nav>

		<div class="border-t border-ink py-2">
			<a
				href={resolve('/admin')}
				class="flex items-center gap-3 px-6 py-3 text-xs font-bold tracking-widest text-stone-700 uppercase transition-colors hover:bg-stone-200 hover:text-ink"
			>
				<i class="fi fi-rs-settings flex text-lg" aria-hidden="true"></i>
				SETTINGS
			</a>
			<form method="POST" action={resolve('/auth/signout')} class="m-0">
				<button
					type="submit"
					class="flex w-full items-center gap-3 border-none bg-transparent px-6 py-3 text-left text-xs font-bold tracking-widest text-brand-red uppercase transition-colors hover:bg-stone-200"
				>
					<i class="fi fi-rs-sign-out-alt flex text-lg" aria-hidden="true"></i>
					LOGOUT
				</button>
			</form>
		</div>
	</aside>

	<!-- Main Content -->
	<main class="ml-64 flex-1">
		{@render children()}
	</main>
</div>
