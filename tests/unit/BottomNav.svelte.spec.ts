import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import BottomNav from '$lib/components/BottomNav.svelte';

describe('BottomNav', () => {
	const items = [
		{ href: '/home', label: 'DASHBOARD', icon: 'home' },
		{ href: '/leaderboard', label: 'LEADERBOARD', icon: 'trophy' },
		{ href: '/analytics', label: 'ANALYTICS', icon: 'stats' },
		{ href: '/our-team', label: 'OUR TEAM', icon: 'users' }
	];

	it('renders all navigation items with their labels and icons', async () => {
		const screen = render(BottomNav, {
			items,
			isCurrent: (href: string) => href === '/home',
			ariaLabel: 'Mobile navigation'
		});

		const nav = screen.getByRole('navigation', { name: 'Mobile navigation' });
		await expect.element(nav).toBeVisible();

		for (const item of items) {
			await expect.element(screen.getByRole('link', { name: item.label })).toBeVisible();
		}
	});

	it('marks the current active item correctly with aria-current="page"', async () => {
		const screen = render(BottomNav, {
			items,
			isCurrent: (href: string) => href === '/leaderboard'
		});

		const activeLink = screen.getByRole('link', { name: 'LEADERBOARD' });
		const inactiveLink = screen.getByRole('link', { name: 'DASHBOARD' });

		await expect.element(activeLink).toHaveAttribute('aria-current', 'page');
		await expect.element(inactiveLink).not.toHaveAttribute('aria-current', 'page');
	});

	it('uses fallback icons when not explicitly provided', async () => {
		const itemsWithoutIcons = [
			{ href: '/home', label: 'Home' },
			{ href: '/profile', label: 'Profile' }
		];

		const screen = render(BottomNav, {
			items: itemsWithoutIcons,
			isCurrent: () => false
		});

		const homeLink = screen.getByRole('link', { name: 'Home' });
		const profileLink = screen.getByRole('link', { name: 'Profile' });

		await expect.element(homeLink).toBeVisible();
		await expect.element(profileLink).toBeVisible();
	});
});
