import { describe, expect, it } from 'vitest';

import { calculateStreakDays } from '$lib/features/dashboard/dashboard';

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
