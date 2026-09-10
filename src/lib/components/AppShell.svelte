<script lang="ts">
	import type { Snippet } from 'svelte';
	import { page } from '$app/state';
	import { resolve } from '$app/paths';
	import NavLink from './NavLink.svelte';

	export type ShellNavLink = { href: string; label: string };

	type Props = {
		children: Snippet;
		navLinks: ShellNavLink[];
		user: { displayName: string; role: string } | null;
		/** Sections nav label, for assistive technology. */
		navLabel: string;
		/** Render the search box only where there is something to search. */
		searchAction?: string;
	};

	let { children, navLinks, user, navLabel, searchAction }: Props = $props();

	let userMenuOpen = $state(false);

	const toggleUserMenu = () => (userMenuOpen = !userMenuOpen);
	const closeUserMenu = () => (userMenuOpen = false);

	/**
	 * A section index is a prefix of every page beneath it, so it would match them all.
	 * Compare it exactly and let only the deeper links use a prefix match.
	 */
	const isCurrent = (href: string, index: number) =>
		index === 0
			? page.url.pathname === href
			: page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<div
	class="flex min-h-screen flex-col bg-paper text-ink selection:bg-brand-red selection:text-white"
>
	<header class="sticky top-0 z-30 w-full border-b border-ink bg-white">
		<div
			class="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
		>
			<div class="flex items-center gap-8 lg:gap-12">
				<a href={resolve('/home')} class="flex items-center gap-2">
					<span class="h-6 w-1.5 bg-brand-red"></span>
					<span class="text-xl font-black tracking-[0.18em] text-brand-red uppercase select-none">
						QUIZGAME
					</span>
				</a>

				<nav aria-label={navLabel} class="hidden items-center gap-6 md:flex lg:gap-8">
					{#each navLinks as link, i (link.href)}
						<NavLink
							href={link.href}
							current={isCurrent(link.href, i)}
							class="py-1 text-xs font-bold tracking-widest uppercase transition-colors {isCurrent(
								link.href,
								i
							)
								? 'border-b-2 border-brand-red text-ink'
								: 'text-stone-500 hover:text-ink'}"
						>
							{link.label}
						</NavLink>
					{/each}
				</nav>
			</div>

			<div class="flex items-center gap-3 sm:gap-4">
				{#if searchAction}
					<!-- eslint-disable-next-line svelte/no-navigation-without-resolve -->
					<form
						action={searchAction}
						method="GET"
						class="hidden items-center border border-ink bg-white px-2.5 py-1 sm:flex"
						role="search"
					>
						<input
							type="text"
							name="q"
							placeholder="SEARCH TOPICS..."
							class="w-36 border-0 bg-transparent p-0 text-xs tracking-wider text-ink uppercase placeholder:text-stone-400 focus:outline-none md:w-56"
						/>
						<button
							type="submit"
							aria-label="Submit search"
							class="p-0.5 text-ink hover:text-brand-red"
						>
							<svg
								class="h-3.5 w-3.5"
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								viewBox="0 0 24 24"
							>
								<circle cx="11" cy="11" r="8"></circle>
								<line x1="21" y1="21" x2="16.65" y2="16.65"></line>
							</svg>
						</button>
					</form>
				{/if}

				<div class="relative">
					<button
						type="button"
						onclick={toggleUserMenu}
						aria-expanded={userMenuOpen}
						aria-label="User menu"
						class="flex h-8 w-8 items-center justify-center border border-ink bg-white p-0.5 transition-colors hover:border-brand-red"
					>
						<div
							class="flex h-full w-full items-center justify-center bg-stone-100 text-xs font-bold text-ink"
						>
							{#if user?.displayName}
								{user.displayName.slice(0, 1).toUpperCase()}
							{:else}
								<svg class="h-4 w-4 text-stone-600" fill="currentColor" viewBox="0 0 20 20">
									<path
										fill-rule="evenodd"
										d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z"
										clip-rule="evenodd"
									></path>
								</svg>
							{/if}
						</div>
					</button>

					{#if userMenuOpen}
						<div
							class="fixed inset-0 z-40"
							onclick={closeUserMenu}
							onkeydown={(e) => e.key === 'Escape' && closeUserMenu()}
							tabindex="0"
							role="button"
							aria-label="Close menu"
						></div>

						<div
							class="absolute right-0 z-50 mt-2 flex w-56 flex-col gap-2 border-2 border-ink bg-white px-3 py-2 shadow-lg"
						>
							{#if user}
								<div class="border-b border-stone-200 pb-2">
									<p class="truncate text-xs font-black tracking-wider text-ink uppercase">
										{user.displayName}
									</p>
									<p class="font-mono text-[10px] tracking-wider text-stone-500 uppercase">
										ROLE: {user.role}
									</p>
								</div>

								{#if user.role === 'ADMIN'}
									<a
										href={resolve('/admin')}
										onclick={closeUserMenu}
										class="flex items-center justify-between py-1 text-xs font-bold tracking-wider text-stone-800 uppercase hover:text-brand-red"
									>
										<span>Admin Dashboard</span>
										<span class="bg-stone-200 px-1 py-0.5 text-[10px]">ADMIN</span>
									</a>
								{/if}

								<!-- POST, so a link or an image cannot sign someone out, and SvelteKit's
								     origin check applies. -->
								<form method="POST" action={resolve('/auth/signout')} class="pt-1">
									<button
										type="submit"
										class="w-full py-1 text-left text-xs font-bold tracking-wider text-brand-red uppercase hover:bg-stone-50"
									>
										Sign out
									</button>
								</form>
							{:else}
								<a
									href={resolve('/login')}
									onclick={closeUserMenu}
									class="py-1 text-xs font-bold tracking-wider text-stone-800 uppercase hover:text-brand-red"
								>
									Log in
								</a>
							{/if}
						</div>
					{/if}
				</div>
			</div>
		</div>

		<div
			class="flex gap-4 overflow-x-auto border-t border-stone-200 bg-stone-50 px-4 py-2 md:hidden"
		>
			{#each navLinks as link, i (link.href)}
				<NavLink
					href={link.href}
					current={isCurrent(link.href, i)}
					class="text-[11px] font-bold tracking-wider whitespace-nowrap uppercase {isCurrent(
						link.href,
						i
					)
						? 'text-brand-red underline'
						: 'text-stone-600'}"
				>
					{link.label}
				</NavLink>
			{/each}
		</div>
	</header>

	<div class="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
		{@render children()}
	</div>

	<footer class="mt-auto w-full">
		<div class="h-1 w-full bg-brand-red"></div>
		<div
			class="flex items-center justify-between bg-ink px-4 py-2.5 font-mono text-[11px] tracking-widest text-white uppercase sm:px-6 lg:px-8"
		>
			<span>SYSTEM STATUS: ACTIVE</span>
			<div class="flex items-center gap-1.5" aria-hidden="true">
				<span class="inline-block h-3 w-3 bg-brand-red"></span>
				<span class="inline-block h-3 w-3 bg-white"></span>
				<span class="inline-block h-3 w-3 border border-white bg-transparent"></span>
			</div>
		</div>
	</footer>
</div>
