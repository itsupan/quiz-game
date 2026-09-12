import { describe, expect, it } from 'vitest';

import { quizPublishBlockers } from '$lib/features/quiz/admin/quizzes.server';

type BlockerSection = Parameters<typeof quizPublishBlockers>[1][number];

const section = (overrides: Partial<BlockerSection> = {}): BlockerSection => ({
	section: 'VOCAB_KANJI',
	position: 1,
	drawCount: null,
	timeLimitSeconds: null,
	questionCount: 1,
	bankCount: 10,
	...overrides
});

const fixed = { selectionMode: 'FIXED' as const, timeLimitSeconds: null };
const random = { selectionMode: 'RANDOM' as const, timeLimitSeconds: null };

describe('quizPublishBlockers', () => {
	it('refuses a quiz with no sections at all', () => {
		expect(quizPublishBlockers(fixed, [])).toEqual(['Add at least one section before publishing.']);
	});

	it('lets a complete fixed quiz through', () => {
		expect(quizPublishBlockers(fixed, [section(), section({ section: 'LISTENING' })])).toEqual([]);
	});

	describe('a fixed quiz needs questions on the paper', () => {
		it('names the empty sections', () => {
			// Until the attach UI existed there was no way to put a question on a fixed
			// paper, so an empty one published cleanly and served every learner nothing.
			const blockers = quizPublishBlockers(fixed, [
				section(),
				section({ section: 'LISTENING', questionCount: 0 })
			]);

			expect(blockers).toHaveLength(1);
			expect(blockers[0]).toContain('LISTENING');
			expect(blockers[0]).not.toContain('VOCAB_KANJI');
		});

		it('does not ask a random quiz for attached questions', () => {
			// A RANDOM quiz draws from the bank; quiz_questions is empty by design.
			expect(quizPublishBlockers(random, [section({ questionCount: 0, drawCount: 5 })])).toEqual(
				[]
			);
		});
	});

	describe('a random quiz needs a draw it can actually make', () => {
		it('still refuses a section with no draw count', () => {
			const blockers = quizPublishBlockers(random, [section({ drawCount: null })]);

			expect(blockers).toHaveLength(1);
			expect(blockers[0]).toContain('draw count');
		});

		it('refuses a draw larger than the published bank', () => {
			// Otherwise every learner silently gets a shorter paper than the quiz claims.
			const blockers = quizPublishBlockers(random, [section({ drawCount: 20, bankCount: 7 })]);

			expect(blockers).toHaveLength(1);
			expect(blockers[0]).toContain('needs 20');
			expect(blockers[0]).toContain('bank has 7');
		});

		it('accepts a bank exactly as large as the draw', () => {
			expect(quizPublishBlockers(random, [section({ drawCount: 7, bankCount: 7 })])).toEqual([]);
		});
	});

	describe('section clocks have to fit the sitting', () => {
		const sections = [
			section({ section: 'VOCAB_KANJI', position: 1, timeLimitSeconds: 1500 }),
			section({ section: 'GRAMMAR_READING', position: 2, timeLimitSeconds: 3300 }),
			section({ section: 'LISTENING', position: 3, timeLimitSeconds: 2100 })
		];

		it('accepts the seeded N4 exam, whose sections sum exactly to its limit', () => {
			expect(quizPublishBlockers({ ...fixed, timeLimitSeconds: 6900 }, sections)).toEqual([]);
		});

		it('refuses sections promising more time than the quiz has', () => {
			const blockers = quizPublishBlockers({ ...fixed, timeLimitSeconds: 6000 }, sections);

			expect(blockers).toHaveLength(1);
			expect(blockers[0]).toContain('cut short');
		});
	});

	it('reports every reason at once rather than one per attempt to publish', () => {
		// An administrator fixing these one round-trip at a time is the failure mode.
		const blockers = quizPublishBlockers({ selectionMode: 'RANDOM', timeLimitSeconds: 600 }, [
			section({ drawCount: null, timeLimitSeconds: 900 })
		]);

		expect(blockers).toHaveLength(2);
	});
});
