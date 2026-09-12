import { describe, expect, it } from 'vitest';

import {
	attemptDeadline,
	isExpired,
	remainingMs,
	sectionDeadlines,
	sectionLimitsFit,
	sectionOpen,
	type SectionLimit
} from '$lib/features/quiz/timing';

const START = new Date('2026-09-12T09:00:00.000Z');

/** The seeded N4 full exam: three sections whose limits sum to the quiz's own 6900. */
const N4_SECTIONS: SectionLimit[] = [
	{ section: 'VOCAB_KANJI', position: 1, timeLimitSeconds: 1500 },
	{ section: 'GRAMMAR_READING', position: 2, timeLimitSeconds: 3300 },
	{ section: 'LISTENING', position: 3, timeLimitSeconds: 2100 }
];

const after = (seconds: number) => new Date(START.getTime() + seconds * 1000);

/** The N4 exam's own limit, which the three sections sum to exactly. */
const EXPIRES = new Date(START.getTime() + 6900 * 1000);

describe('attemptDeadline', () => {
	it('ends the attempt one time limit after it started', () => {
		expect(attemptDeadline(START, 6900)).toEqual(after(6900));
	});

	it('leaves an attempt with no time limit untimed', () => {
		expect(attemptDeadline(START, null)).toBeNull();
	});
});

describe('sectionDeadlines', () => {
	it('accumulates each section onto the ones before it', () => {
		expect(sectionDeadlines(START, EXPIRES, N4_SECTIONS)).toEqual([
			{ section: 'VOCAB_KANJI', deadline: after(1500) },
			{ section: 'GRAMMAR_READING', deadline: after(1500 + 3300) },
			{ section: 'LISTENING', deadline: after(1500 + 3300 + 2100) }
		]);
	});

	it('lands the last section on the quiz-level deadline', () => {
		// The seeds encode this, and it is the check that the cumulative model is the one
		// the content was authored against: 1500 + 3300 + 2100 === 6900.
		const deadlines = sectionDeadlines(START, EXPIRES, N4_SECTIONS);

		expect(deadlines.at(-1)?.deadline).toEqual(attemptDeadline(START, 6900));
	});

	it('orders by position rather than by the order rows arrived in', () => {
		const shuffled = [N4_SECTIONS[2], N4_SECTIONS[0], N4_SECTIONS[1]];

		expect(sectionDeadlines(START, EXPIRES, shuffled).map((entry) => entry.section)).toEqual([
			'VOCAB_KANJI',
			'GRAMMAR_READING',
			'LISTENING'
		]);
	});

	it('bounds an unlimited section, and everything after it, by the attempt itself', () => {
		// Once a section can run indefinitely there is no instant left to accumulate from,
		// so cutting the following section short would be a deadline nobody was shown.
		const sections: SectionLimit[] = [
			{ section: 'VOCAB_KANJI', position: 1, timeLimitSeconds: null },
			{ section: 'LISTENING', position: 2, timeLimitSeconds: 2100 }
		];

		expect(sectionDeadlines(START, EXPIRES, sections)).toEqual([
			{ section: 'VOCAB_KANJI', deadline: EXPIRES },
			{ section: 'LISTENING', deadline: EXPIRES }
		]);
	});

	it('does not mutate the sections it was given', () => {
		const sections = [N4_SECTIONS[2], N4_SECTIONS[0]];

		sectionDeadlines(START, EXPIRES, sections);

		expect(sections[0].section).toBe('LISTENING');
	});
});

describe('remainingMs', () => {
	it('counts down towards the deadline', () => {
		expect(remainingMs(after(900), after(1500))).toBe(600_000);
	});

	it('floors at zero rather than going negative', () => {
		// A countdown that renders "-04:12" tells a learner the clock is still theirs.
		expect(remainingMs(after(2000), after(1500))).toBe(0);
	});

	it('has nothing to count down when there is no deadline', () => {
		expect(remainingMs(START, null)).toBeNull();
	});
});

describe('isExpired', () => {
	it('is open before the deadline', () => {
		expect(isExpired(after(1499), after(1500))).toBe(false);
	});

	it('is expired exactly on the deadline', () => {
		// The allowed time has been spent; a request landing on the millisecond must not
		// get to write an answer the clock no longer covers.
		expect(isExpired(after(1500), after(1500))).toBe(true);
	});

	it('never expires without a deadline', () => {
		expect(isExpired(after(999_999), null)).toBe(false);
	});
});

describe('sectionOpen', () => {
	const deadlines = sectionDeadlines(START, EXPIRES, N4_SECTIONS);

	it('closes a section whose own clock ran out while the attempt is still running', () => {
		const now = after(2000);

		expect(sectionOpen(now, deadlines, 'VOCAB_KANJI')).toBe(false);
		expect(sectionOpen(now, deadlines, 'GRAMMAR_READING')).toBe(true);
		expect(isExpired(now, attemptDeadline(START, 6900))).toBe(false);
	});

	it('treats a section the quiz never configured as open', () => {
		// The attempt's own deadline still governs; this only decides per-section clocks.
		expect(sectionOpen(after(2000), [], 'LISTENING')).toBe(true);
	});
});

describe('sectionDeadlines clamping', () => {
	it('never lets a section outlive the attempt', () => {
		// Misconfigured content: 5000 + 5000 against a 6900 second sitting. Showing the
		// learner a listening clock that runs past the end of the exam would be a lie.
		const sections: SectionLimit[] = [
			{ section: 'VOCAB_KANJI', position: 1, timeLimitSeconds: 5000 },
			{ section: 'LISTENING', position: 2, timeLimitSeconds: 5000 }
		];

		expect(sectionDeadlines(START, EXPIRES, sections)).toEqual([
			{ section: 'VOCAB_KANJI', deadline: after(5000) },
			{ section: 'LISTENING', deadline: EXPIRES }
		]);
	});

	it('leaves sections untimed when the attempt itself is untimed', () => {
		const sections: SectionLimit[] = [
			{ section: 'VOCAB_KANJI', position: 1, timeLimitSeconds: null }
		];

		expect(sectionDeadlines(START, null, sections)).toEqual([
			{ section: 'VOCAB_KANJI', deadline: null }
		]);
	});
});

describe('sectionLimitsFit', () => {
	it('accepts sections that sum exactly to the quiz limit', () => {
		// The seeded N4 exam. Equality is the normal case, not an edge one.
		expect(sectionLimitsFit(6900, N4_SECTIONS)).toBe(true);
	});

	it('rejects sections that promise more time than the sitting has', () => {
		expect(sectionLimitsFit(6000, N4_SECTIONS)).toBe(false);
	});

	it('accepts anything when the quiz is untimed', () => {
		expect(sectionLimitsFit(null, N4_SECTIONS)).toBe(true);
	});

	it('counts an unlimited section as nothing, since the attempt bounds it', () => {
		expect(
			sectionLimitsFit(600, [{ section: 'VOCAB_KANJI', position: 1, timeLimitSeconds: null }])
		).toBe(true);
	});
});
