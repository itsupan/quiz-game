import { render } from 'vitest-browser-svelte';
import { describe, expect, it } from 'vitest';

import QuestionBody from '$lib/features/quiz/QuestionBody.svelte';
import type { AttemptQuestion } from '$lib/features/quiz/api/types';

const options = [
	{ number: 1, body: 'ピアノ' },
	{ number: 2, body: 'うた' },
	{ number: 3, body: 'ダンス' }
];

function question(number: number, selectedOptionNumber: number | null): AttemptQuestion {
	return {
		attemptId: '01M2C1PBARMMZ9XM6CK09HSPDJ',
		attemptStatus: 'IN_PROGRESS',
		serverTime: '2026-09-13T00:00:00.000Z',
		number,
		section: 'VOCAB_KANJI',
		points: 1,
		stem: `Question ${number}`,
		presentation: {
			type: 'STANDARD',
			prompt: { text: `Question ${number}`, translation: null }
		},
		image: null,
		audio: null,
		options,
		selectedOptionNumber,
		progress: { current: number, total: 2, answered: selectedOptionNumber === null ? 0 : 1 },
		canAnswer: true,
		links: {
			attempt: '/api/v1/attempts/example',
			answer: `/api/v1/attempts/example/answers/${number}`,
			previous: number === 1 ? null : '/api/v1/attempts/example/questions/1',
			next: number === 1 ? '/api/v1/attempts/example/questions/2' : null
		}
	};
}

describe('QuestionBody', () => {
	it('clears the previous radio selection when navigation opens an unanswered question', async () => {
		const screen = render(QuestionBody, {
			question: question(1, 2),
			revealStudyAids: false,
			name: 'selectedOptionNumber',
			selectedOptionId: 2
		});

		await expect.element(screen.getByRole('radio', { name: 'うた' })).toBeChecked();

		await screen.rerender({
			question: question(2, null),
			revealStudyAids: false,
			name: 'selectedOptionNumber',
			selectedOptionId: null
		});

		for (const radio of screen.getByRole('radio').elements()) {
			expect(radio).not.toBeChecked();
		}
	});
});
