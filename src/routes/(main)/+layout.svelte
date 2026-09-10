<script lang="ts">
	import { resolve } from '$app/paths';
	import { page } from '$app/state';
	import type { LayoutProps } from './$types';

	let { data, children }: LayoutProps = $props();

	let userMenuOpen = $state(false);

	const navLinks = [
		{ href: resolve('/home'), label: 'DASHBOARD' },
		{ href: resolve('/practice'), label: 'PRACTICE' },
		{ href: resolve('/leaderboard'), label: 'LEADERBOARD' },
		{ href: resolve('/analytics'), label: 'ANALYTICS' }
	];

	function toggleUserMenu() {
		userMenuOpen = !userMenuOpen;
	}

	function closeUserMenu() {
		userMenuOpen = false;
	}

	const isCurrent = (href: string) =>
		page.url.pathname === href || page.url.pathname.startsWith(href + '/');
</script>

<div
	class="flex min-h-screen flex-col bg-[#FDFDFC] font-sans text-[#202121] selection:bg-[#B6251F] selection:text-white"
>
	<!-- Top Navigation Bar -->
	<header class="sticky top-0 z-30 w-full border-b border-[#202121] bg-white">
		<div
			class="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8"
		>
			<!-- Brand & Main Nav -->
			<div class="flex items-center gap-8 lg:gap-12">
				<a href={resolve('/home')} class="group flex items-center gap-2">
					<span class="h-6 w-1.5 bg-[#B6251F]"></span>
					<span class="text-xl font-black tracking-[0.18em] text-[#B6251F] uppercase select-none">
						QUIZGAME
					</span>
				</a>

				<nav aria-label="Learner Sections" class="hidden items-center gap-6 md:flex lg:gap-8">
					{#each navLinks as link (link.href)}
						<a
							href={link.href}
							class="py-1 text-xs font-bold tracking-widest uppercase transition-colors {isCurrent(
								link.href
							)
								? 'border-b-2 border-[#B6251F] text-[#202121]'
								: 'text-stone-500 hover:text-[#202121]'}"
							aria-current={isCurrent(link.href) ? 'page' : undefined}
						>
							{link.label}
						</a>
					{/each}
				</nav>
			</div>

			<!-- Utilities / Actions -->
			<div class="flex items-center gap-3 sm:gap-4">
				<!-- Search box -->
				<form
					action={resolve('/home')}
					method="GET"
					class="hidden items-center border border-[#202121] bg-white px-2.5 py-1 sm:flex"
					role="search"
				>
					<input
						type="text"
						name="q"
						placeholder="SEARCH TOPICS..."
						class="w-36 bg-transparent text-xs tracking-wider text-[#202121] uppercase placeholder:text-stone-400 focus:outline-none md:w-56"
					/>
					<button
						type="submit"
						aria-label="Submit search"
						class="p-0.5 text-[#202121] hover:text-[#B6251F]"
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

				<!-- Notifications Bell -->
				<button
					type="button"
					aria-label="Notifications"
					class="flex h-8 w-8 items-center justify-center text-[#202121] transition-colors hover:text-[#B6251F]"
				>
					<svg
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path>
						<path d="M13.73 21a2 2 0 0 1-3.46 0"></path>
					</svg>
				</button>

				<!-- Settings Gear -->
				<button
					type="button"
					aria-label="Settings"
					class="flex h-8 w-8 items-center justify-center text-[#202121] transition-colors hover:text-[#B6251F]"
				>
					<svg
						class="h-4 w-4"
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						viewBox="0 0 24 24"
					>
						<circle cx="12" cy="12" r="3"></circle>
						<path
							d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"
						></path>
					</svg>
				</button>

				<!-- User Profile Avatar Box with Dropdown -->
				<div class="relative">
					<button
						type="button"
						onclick={toggleUserMenu}
						aria-expanded={userMenuOpen}
						aria-label="User menu"
						class="flex h-8 w-8 items-center justify-center border border-[#202121] bg-white p-0.5 transition-colors hover:border-[#B6251F]"
					>
						<div
							class="flex h-full w-full items-center justify-center bg-stone-100 text-xs font-bold text-[#202121]"
						>
							{#if data.user?.displayName}
								{data.user.displayName.slice(0, 1).toUpperCase()}
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
						<!-- Backdrop to close -->
						<div
							class="fixed inset-0 z-40"
							onclick={closeUserMenu}
							onkeydown={(e) => e.key === 'Escape' && closeUserMenu()}
							tabindex="0"
							role="button"
							aria-label="Close menu"
						></div>

						<!-- Dropdown menu -->
						<div
							class="absolute right-0 z-50 mt-2 flex w-56 flex-col gap-2 border-2 border-[#202121] bg-white px-3 py-2 shadow-lg"
						>
							<div class="border-b border-stone-200 pb-2">
								<p class="truncate text-xs font-black tracking-wider text-[#202121] uppercase">
									{data.user?.displayName ?? 'Learner'}
								</p>
								<p class="font-mono text-[10px] tracking-wider text-stone-500 uppercase">
									ROLE: {data.user?.role ?? 'USER'}
								</p>
							</div>

							{#if data.user?.role === 'ADMIN'}
								<a
									href={resolve('/admin')}
									onclick={closeUserMenu}
									class="flex items-center justify-between py-1 text-xs font-bold tracking-wider text-stone-800 uppercase hover:text-[#B6251F]"
								>
									<span>Admin Dashboard</span>
									<span class="bg-stone-200 px-1 py-0.5 text-[10px]">ADMIN</span>
								</a>
							{/if}

							<form method="POST" action={resolve('/auth/signout')} class="pt-1">
								<button
									type="submit"
									class="w-full py-1 text-left text-xs font-bold tracking-wider text-[#B6251F] uppercase hover:bg-stone-50"
								>
									Sign out
								</button>
							</form>
						</div>
					{/if}
				</div>
			</div>
		</div>

		<!-- Mobile Sub-navigation Bar -->
		<div
			class="flex gap-4 overflow-x-auto border-t border-stone-200 bg-stone-50 px-4 py-2 md:hidden"
		>
			{#each navLinks as link (link.href)}
				<a
					href={link.href}
					class="text-[11px] font-bold tracking-wider whitespace-nowrap uppercase {isCurrent(
						link.href
					)
						? 'text-[#B6251F] underline'
						: 'text-stone-600'}"
				>
					{link.label}
				</a>
			{/each}
		</div>
	</header>

	<!-- Main Content Slot -->
	<div class="mx-auto w-full max-w-[1280px] flex-1 px-4 py-8 sm:px-6 lg:px-8">
		{@render children()}
	</div>

	<!-- Brutalist Status Footer -->
	<footer class="mt-auto w-full">
		<div class="h-1 w-full bg-[#B6251F]"></div>
		<div
			class="flex items-center justify-between bg-[#202121] px-4 py-2.5 font-mono text-[11px] tracking-widest text-white uppercase sm:px-6 lg:px-8"
		>
			<div class="flex items-center gap-2">
				<span>SYSTEM STATUS: ACTIVE</span>
			</div>
			<div class="flex items-center gap-1.5" aria-hidden="true">
				<span class="inline-block h-3 w-3 bg-[#B6251F]"></span>
				<span class="inline-block h-3 w-3 bg-white"></span>
				<span class="inline-block h-3 w-3 border border-white bg-transparent"></span>
			</div>
		</div>
	</footer>
</div>
