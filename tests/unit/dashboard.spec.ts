import { describe, expect, it } from 'vitest';

import { availableLevels, calculateStreakDays } from '$lib/features/dashboard/dashboard';

const now = new Date('2026-09-12T18:00:00.000Z');

describe('calculateStreakDays', () => {
	it('counts distinct consecutive completion days', () => {
		expect(
			calculateStreakDays(
				[
					new Date('2026-09-12T02:00:00.000Z'),
					new Date('2026-09-12T20:00:00.000Z'),
					new Date('2026-09-11T09:00:00.000Z'),
					new Date('2026-09-10T23:59:00.000Z')
				],
				now
			)
		).toBe(3);
	});

	it('keeps a streak alive when the latest completion was yesterday', () => {
		expect(calculateStreakDays([new Date('2026-09-11T09:00:00.000Z')], now)).toBe(1);
	});

	it('returns zero when the streak has gone stale', () => {
		expect(calculateStreakDays([new Date('2026-09-10T09:00:00.000Z')], now)).toBe(0);
	});
});

describe('availableLevels', () => {
	it('deduplicates levels and returns them in canonical N5 to N1 order', () => {
		expect(availableLevels([{ level: 'N3' }, { level: 'N4' }, { level: 'N3' }])).toEqual([
			'N4',
			'N3'
		]);
	});

	it('returns no levels for an empty dataset', () => {
		expect(availableLevels([])).toEqual([]);
	});
});
