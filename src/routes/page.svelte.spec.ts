import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import Page from './+page.svelte';
import type { PageData, PageProps } from './$types';

type QuizCard = PageData['quizzes'][number];

const quiz = (id: number, title: string): QuizCard => ({
	publicId: `01JSEEDQZ${String(id).padStart(17, '0')}`,
	title,
	level: 'N4',
	mode: 'JLPT_PRACTICE',
	createdAt: new Date('2026-01-01')
});

const props = (quizzes: QuizCard[]): PageProps => ({
	data: { quizzes, user: null },
	params: {},
	form: null
});

describe('home page', () => {
	it('greets the visitor', async () => {
		const screen = render(Page, props([]));

		await expect
			.element(screen.getByRole('heading', { level: 1 }))
			.toHaveTextContent('Hello world');
	});

	it('lists every quiz it is given', async () => {
		const screen = render(Page, props([quiz(1, 'JLPT N4 模擬本試験'), quiz(2, 'N3 語彙ドリル')]));

		await expect.element(screen.getByText('JLPT N4 模擬本試験')).toBeInTheDocument();
		await expect.element(screen.getByText('N3 語彙ドリル')).toBeInTheDocument();
	});

	it('explains how to seed an empty database', async () => {
		const screen = render(Page, props([]));

		await expect.element(screen.getByTestId('empty')).toHaveTextContent('pnpm db:migrate:local');
	});

	it('points a visitor at the admin dashboard', async () => {
		// There is no navigation anywhere else yet, so this list is the only route into
		// the dashboard. Losing it makes /admin unreachable without typing the URL.
		const screen = render(Page, props([]));

		await expect
			.element(screen.getByRole('link', { name: 'Open the admin dashboard' }))
			.toHaveAttribute('href', '/admin');
	});

	it('links each area of the dashboard', async () => {
		const screen = render(Page, props([]));

		for (const [name, href] of [
			['Questions', '/admin/questions'],
			['Quizzes', '/admin/quizzes'],
			['Media', '/admin/media']
		]) {
			await expect.element(screen.getByRole('link', { name })).toHaveAttribute('href', href);
		}
	});

	it('says what signing in is for', async () => {
		const screen = render(Page, props([]));

		// Matched on the element, not on a text node: the sentence wraps across lines in
		// the source, and toHaveTextContent normalises the whitespace.
		await expect
			.element(screen.getByTestId('auth-note'))
			.toHaveTextContent(/sign in with google to save your history/i);
	});
});
