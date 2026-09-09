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
	data: { overview: data, user: { displayName: '管理者テスト', role: 'ADMIN' } },
	params: {},
	form: null
});

describe('admin overview', () => {
	it('shows the total for each area of the dashboard', async () => {
		const screen = render(Page, props(overview()));

		await expect.element(screen.getByTestId('total-quizzes')).toHaveTextContent('3');
		await expect.element(screen.getByTestId('total-questions')).toHaveTextContent('13');
		await expect.element(screen.getByTestId('total-learners')).toHaveTextContent('2');
		await expect.element(screen.getByTestId('total-attempts')).toHaveTextContent('0');
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
			props(overview({ questions: { total: 13, published: 9, draft: 4 } }))
		);

		const questions = screen.getByRole('listitem').filter({ hasText: 'Questions' });

		await expect.element(questions.getByText('9')).toBeInTheDocument();
		await expect.element(questions.getByText('4')).toBeInTheDocument();
	});

	it('links the areas that have a management screen', async () => {
		const screen = render(Page, props(overview()));

		await expect
			.element(screen.getByRole('link', { name: 'Quizzes' }))
			.toHaveAttribute('href', '/admin/quizzes');
		await expect
			.element(screen.getByRole('link', { name: 'Questions' }))
			.toHaveAttribute('href', '/admin/questions');

		// Learners and attempts have no screens yet — user management is issue #15 — so
		// they are counts, not dead links.
		expect(screen.getByRole('link', { name: 'Learners' }).elements()).toHaveLength(0);
	});
});
