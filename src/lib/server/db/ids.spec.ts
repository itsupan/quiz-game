import { describe, expect, it } from 'vitest';

import { PUBLIC_ID_LENGTH, newPublicId } from './ids';

const CROCKFORD = /^[0-9A-HJKMNP-TV-Z]{26}$/;

describe('newPublicId', () => {
	it('returns 26 Crockford base32 characters', () => {
		expect(newPublicId()).toMatch(CROCKFORD);
		expect(newPublicId()).toHaveLength(PUBLIC_ID_LENGTH);
	});

	it('omits the letters that get misread aloud', () => {
		const sample = Array.from({ length: 200 }, () => newPublicId()).join('');

		// Crockford drops I, L, O and U so an id can be dictated without ambiguity.
		expect(sample).not.toMatch(/[ILOU]/);
	});

	it('does not collide across a large batch', () => {
		const ids = Array.from({ length: 10_000 }, () => newPublicId());

		expect(new Set(ids).size).toBe(ids.length);
	});

	it('sorts by creation time, so the unique index stays append-mostly', () => {
		const earlier = newPublicId(Date.parse('2026-01-01T00:00:00Z'));
		const later = newPublicId(Date.parse('2026-09-07T00:00:00Z'));

		expect(earlier < later).toBe(true);
	});

	it('encodes the timestamp in the first ten characters only', () => {
		const at = Date.parse('2026-09-07T12:00:00Z');

		// Same millisecond, different randomness: the prefixes match, the ids do not.
		const a = newPublicId(at);
		const b = newPublicId(at);

		expect(a.slice(0, 10)).toBe(b.slice(0, 10));
		expect(a).not.toBe(b);
	});

	it('leaves no guessable relationship between consecutive ids', () => {
		const at = Date.parse('2026-09-07T12:00:00Z');
		const suffixes = new Set(Array.from({ length: 500 }, () => newPublicId(at).slice(10)));

		// 80 bits of randomness: 500 draws in one millisecond should never repeat.
		expect(suffixes.size).toBe(500);
	});
});
