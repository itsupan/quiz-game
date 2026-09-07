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
		const screen = render(Page, props([quiz(1, 'JLPT N4 模擬本試験'), quiz(2, 'N3 語彙ドリル')]));

		await expect.element(screen.getByText('JLPT N4 模擬本試験')).toBeInTheDocument();
		await expect.element(screen.getByText('N3 語彙ドリル')).toBeInTheDocument();
	});

	it('explains how to seed an empty database', async () => {
		const screen = render(Page, props([]));

		await expect.element(screen.getByTestId('empty')).toHaveTextContent('pnpm db:migrate:local');
	});
});
