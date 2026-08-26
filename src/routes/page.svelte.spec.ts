import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';
import type { Quiz } from '$lib/server/db/schema';
import Page from './+page.svelte';
import type { PageProps } from './$types';

const quiz = (id: number, title: string): Quiz => ({
	id,
	title,
	createdAt: new Date('2026-01-01')
});

const props = (quizzes: Quiz[]): PageProps => ({
	data: { quizzes },
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
		const screen = render(Page, props([quiz(1, 'Capital cities'), quiz(2, 'Periodic table')]));

		await expect.element(screen.getByText('Capital cities')).toBeInTheDocument();
		await expect.element(screen.getByText('Periodic table')).toBeInTheDocument();
	});

	it('explains how to seed an empty database', async () => {
		const screen = render(Page, props([]));

		await expect.element(screen.getByTestId('empty')).toHaveTextContent('pnpm db:migrate:local');
	});
});
