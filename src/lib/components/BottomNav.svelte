<script lang="ts">
	import NavLink from './NavLink.svelte';

	export type BottomNavItem = {
		href: string;
		label: string;
		icon?: string;
	};

	type Props = {
		items: BottomNavItem[];
		isCurrent: (href: string, index: number) => boolean;
		ariaLabel?: string;
	};

	let { items, isCurrent, ariaLabel = 'Mobile navigation' }: Props = $props();

	const DEFAULT_ICONS: Record<string, string> = {
		dashboard: 'home',
		home: 'home',
		leaderboard: 'trophy',
		rankings: 'trophy',
		analytics: 'stats',
		stats: 'stats',
		metrics: 'stats',
		'our team': 'users',
		team: 'users',
		users: 'users',
		profile: 'user',
		account: 'user',
		settings: 'settings'
	};

	function resolveIcon(item: BottomNavItem): string {
		if (item.icon) return item.icon;
		const key = item.label.toLowerCase().trim();
		return DEFAULT_ICONS[key] || 'apps';
	}
</script>

<nav
	aria-label={ariaLabel}
	class="fixed inset-x-0 bottom-0 z-40 border-t-2 border-ink bg-white md:hidden"
	style="padding-bottom: env(safe-area-inset-bottom, 0px);"
>
	<div class="mx-auto flex h-16 max-w-[1536px] items-stretch justify-around px-1 sm:px-3">
		{#each items as item, i (item.href)}
			{@const current = isCurrent(item.href, i)}
			<NavLink
				href={item.href}
				{current}
				class="group relative flex flex-1 flex-col items-center justify-center gap-1 overflow-hidden px-1 py-1.5 text-center transition-colors select-none {current
					? 'text-brand-red'
					: 'text-stone-500 hover:text-ink active:text-brand-red'}"
			>
				{#if current}
					<span
						class="absolute inset-x-3 top-0 h-[3px] bg-brand-red transition-all"
						aria-hidden="true"
					></span>
				{/if}

				<i
					class="fi fi-rs-{resolveIcon(
						item
					)} text-[1.35rem] leading-none transition-transform group-active:scale-90"
					aria-hidden="true"
				></i>

				<span
					class="max-w-full truncate text-[9px] font-black tracking-[0.22em] uppercase transition-all {current
						? 'text-brand-red'
						: 'text-stone-600 group-hover:text-ink'}"
				>
					{item.label}
				</span>
			</NavLink>
		{/each}
	</div>
</nav>
