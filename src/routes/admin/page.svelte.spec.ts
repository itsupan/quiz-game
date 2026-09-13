import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';

import Page from './+page.svelte';
import type { PageData, PageProps } from './$types';

const overview = (overrides: Partial<PageData['overview']> = {}): PageData['overview'] => ({
	quizzes: { total: 3, published: 3, draft: 0 },
	questions: { total: 13, published: 13, draft: 0 },
	users: { total: 2, admins: 1, suspended: 0 },
	attempts: { total: 0, submitted: 0, lastSevenDays: 0 },
	...overrides
});

const props = (data: PageData['overview']): PageProps => ({
	data: {
		overview: data,
		recentActivity: [],
		user: { displayName: '管理者テスト', avatarUrl: null, role: 'ADMIN' }
	},
	params: {},
	form: null
});

describe('admin overview', () => {
	it('shows the total for each area of the dashboard', async () => {
		const screen = render(Page, props(overview()));

		await expect.element(screen.getByTestId('total-quizzes')).toHaveTextContent('3');
		await expect.element(screen.getByTestId('total-questions')).toHaveTextContent('13');
		await expect.element(screen.getByTestId('total-users')).toHaveTextContent('2');
	});

	it('renders a zero as a zero, not as an empty tile', async () => {
		// A blank where a count should be reads as "failed to load", which is a different
		// thing from "none yet".
		const screen = render(Page, props(overview({ quizzes: { total: 0, published: 0, draft: 0 } })));

		await expect.element(screen.getByTestId('total-quizzes')).toHaveTextContent('0');
	});

	it('breaks each total down by status', async () => {
		const screen = render(
			Page,
			props(overview({ quizzes: { total: 13, published: 9, draft: 4 } }))
		);

		await expect.element(screen.getByText('4 SYNCING')).toBeInTheDocument();
	});
});
