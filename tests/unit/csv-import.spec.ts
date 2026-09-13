import { describe, expect, it } from 'vitest';

import { CSV_COLUMNS, parseQuestionCsv, toQuestionInput } from '$lib/features/questions/csv-import';

const HEADER = CSV_COLUMNS.join(',');
const context = { level: 'N4' as const, section: 'VOCAB_KANJI' as const };

function row(fields: Partial<Record<(typeof CSV_COLUMNS)[number], string>>) {
	return CSV_COLUMNS.map((column) => fields[column] ?? '').join(',');
}

describe('parseQuestionCsv', () => {
	it('rejects an empty file', () => {
		const result = parseQuestionCsv('');
		expect(result.ok).toBe(false);
	});

	it('rejects a file missing a required column', () => {
		const result = parseQuestionCsv('stem,option_a,option_b\nhello,a,b');
		expect(result).toEqual({ ok: false, error: expect.stringContaining('correct_option') });
	});

	it('parses a well-formed file into one row per data line', () => {
		const csv = `${HEADER}\n${row({ stem: 'What is this?', option_a: 'A', option_b: 'B', correct_option: 'A' })}`;
		const result = parseQuestionCsv(csv);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].line).toBe(2);
		expect(result.rows[0].raw.stem).toBe('What is this?');
	});

	it('keeps a comma inside a quoted field as part of the value', () => {
		const csv = `${HEADER}\n${row({ stem: '"Hello, world"', option_a: 'A', option_b: 'B', correct_option: 'A' })}`;
		const result = parseQuestionCsv(csv);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.rows[0].raw.stem).toBe('Hello, world');
	});

	it('keeps a newline inside a quoted field as part of the value', () => {
		const csv = `${HEADER}\n${row({ stem: '"line one\nline two"', option_a: 'A', option_b: 'B', correct_option: 'A' })}`;
		const result = parseQuestionCsv(csv);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.rows).toHaveLength(1);
		expect(result.rows[0].raw.stem).toBe('line one\nline two');
	});

	it('unescapes a doubled quote inside a quoted field', () => {
		const csv = `${HEADER}\n${row({ stem: '"She said ""hi"""', option_a: 'A', option_b: 'B', correct_option: 'A' })}`;
		const result = parseQuestionCsv(csv);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.rows[0].raw.stem).toBe('She said "hi"');
	});

	it('numbers data rows starting at line 2, after the header', () => {
		const csv = `${HEADER}\n${row({ stem: 'first', option_a: 'A', option_b: 'B', correct_option: 'A' })}\n${row({ stem: 'second', option_a: 'A', option_b: 'B', correct_option: 'A' })}`;
		const result = parseQuestionCsv(csv);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.rows.map((r) => r.line)).toEqual([2, 3]);
	});
});

describe('toQuestionInput', () => {
	it('accepts a minimal two-option row', () => {
		const parsed = parseQuestionCsv(
			`${HEADER}\n${row({ stem: 'Q', option_a: 'A', option_b: 'B', correct_option: 'B' })}`
		);
		if (!parsed.ok) throw new Error('expected parse to succeed');

		const result = toQuestionInput(parsed.rows[0], context);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.options).toHaveLength(2);
		expect(result.value.options[1].isCorrect).toBe(true);
		expect(result.value.points).toBe(1);
		expect(result.value.level).toBe('N4');
		expect(result.value.section).toBe('VOCAB_KANJI');
	});

	it('rejects a blank stem', () => {
		const parsed = parseQuestionCsv(
			`${HEADER}\n${row({ option_a: 'A', option_b: 'B', correct_option: 'A' })}`
		);
		if (!parsed.ok) throw new Error('expected parse to succeed');

		const result = toQuestionInput(parsed.rows[0], context);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors.join(' ')).toContain('stem is required');
	});

	it('rejects a blank option that leaves a gap before a later filled one', () => {
		const parsed = parseQuestionCsv(
			`${HEADER}\n${row({ stem: 'Q', option_a: 'A', option_b: '', option_c: 'C', correct_option: 'A' })}`
		);
		if (!parsed.ok) throw new Error('expected parse to succeed');

		const result = toQuestionInput(parsed.rows[0], context);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors.join(' ')).toContain('option_b is blank');
	});

	it('rejects fewer than two options', () => {
		const parsed = parseQuestionCsv(
			`${HEADER}\n${row({ stem: 'Q', option_a: 'A', correct_option: 'A' })}`
		);
		if (!parsed.ok) throw new Error('expected parse to succeed');

		const result = toQuestionInput(parsed.rows[0], context);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors.join(' ')).toContain('At least two options');
	});

	it('rejects a correct_option letter outside A-F', () => {
		const parsed = parseQuestionCsv(
			`${HEADER}\n${row({ stem: 'Q', option_a: 'A', option_b: 'B', correct_option: 'Z' })}`
		);
		if (!parsed.ok) throw new Error('expected parse to succeed');

		const result = toQuestionInput(parsed.rows[0], context);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors.join(' ')).toContain('A-F');
	});

	it('rejects a correct_option pointing at a blank option', () => {
		const parsed = parseQuestionCsv(
			`${HEADER}\n${row({ stem: 'Q', option_a: 'A', option_b: 'B', correct_option: 'C' })}`
		);
		if (!parsed.ok) throw new Error('expected parse to succeed');

		const result = toQuestionInput(parsed.rows[0], context);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors.join(' ')).toContain('does not match a filled option');
	});

	it('rejects a non-integer points value', () => {
		const parsed = parseQuestionCsv(
			`${HEADER}\n${row({ stem: 'Q', option_a: 'A', option_b: 'B', correct_option: 'A', points: 'two' })}`
		);
		if (!parsed.ok) throw new Error('expected parse to succeed');

		const result = toQuestionInput(parsed.rows[0], context);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors.join(' ')).toContain('points must be');
	});

	it('defaults points to 1 when blank', () => {
		const parsed = parseQuestionCsv(
			`${HEADER}\n${row({ stem: 'Q', option_a: 'A', option_b: 'B', correct_option: 'A' })}`
		);
		if (!parsed.ok) throw new Error('expected parse to succeed');

		const result = toQuestionInput(parsed.rows[0], context);

		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.points).toBe(1);
	});

	it('rejects a non-numeric media id', () => {
		const parsed = parseQuestionCsv(
			`${HEADER}\n${row({ stem: 'Q', option_a: 'A', option_b: 'B', correct_option: 'A', image_media_id: 'abc' })}`
		);
		if (!parsed.ok) throw new Error('expected parse to succeed');

		const result = toQuestionInput(parsed.rows[0], context);

		expect(result.ok).toBe(false);
		if (result.ok) return;
		expect(result.errors.join(' ')).toContain('image_media_id');
	});

	it('carries explanation through, and leaves it null when blank', () => {
		const withExplanation = parseQuestionCsv(
			`${HEADER}\n${row({ stem: 'Q', option_a: 'A', option_b: 'B', correct_option: 'A', explanation: 'Because.' })}`
		);
		if (!withExplanation.ok) throw new Error('expected parse to succeed');
		const result = toQuestionInput(withExplanation.rows[0], context);
		expect(result.ok).toBe(true);
		if (!result.ok) return;
		expect(result.value.explanation).toBe('Because.');

		const blank = parseQuestionCsv(
			`${HEADER}\n${row({ stem: 'Q', option_a: 'A', option_b: 'B', correct_option: 'A' })}`
		);
		if (!blank.ok) throw new Error('expected parse to succeed');
		const blankResult = toQuestionInput(blank.rows[0], context);
		expect(blankResult.ok).toBe(true);
		if (!blankResult.ok) return;
		expect(blankResult.value.explanation).toBeNull();
	});
});
