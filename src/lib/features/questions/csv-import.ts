import type { JlptLevel, Section } from '$lib/domain/enums';
import type { QuestionInput } from './validation';

/** The exact header row a question-import CSV must have. Order does not matter. */
export const CSV_COLUMNS = [
	'stem',
	'option_a',
	'option_b',
	'option_c',
	'option_d',
	'option_e',
	'option_f',
	'correct_option',
	'points',
	'explanation',
	'image_media_id',
	'audio_media_id'
] as const;

const OPTION_COLUMNS = [
	'option_a',
	'option_b',
	'option_c',
	'option_d',
	'option_e',
	'option_f'
] as const;

export type CsvRow = { line: number; raw: Record<string, string> };

export type ParsedCsv = { ok: true; rows: CsvRow[] } | { ok: false; error: string };

/**
 * A small RFC4180 field/row splitter: quoted fields, embedded commas and newlines, and
 * `""` as an escaped quote. Written by hand because the Workers runtime has no `node:`
 * CSV module and this project takes no other CSV dependency.
 */
function splitCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = '';
	let inQuotes = false;
	// Normalize line endings up front so \r\n inside a quoted field doesn't need its own case.
	const input = text.replace(/\r\n/g, '\n');

	for (let i = 0; i < input.length; i++) {
		const char = input[i];

		if (inQuotes) {
			if (char === '"') {
				if (input[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += char;
			}
			continue;
		}

		if (char === '"') {
			inQuotes = true;
		} else if (char === ',') {
			row.push(field);
			field = '';
		} else if (char === '\n') {
			row.push(field);
			rows.push(row);
			row = [];
			field = '';
		} else {
			field += char;
		}
	}

	// The final field/row has no trailing delimiter to close it.
	if (field !== '' || row.length > 0) {
		row.push(field);
		rows.push(row);
	}

	return rows.filter((cells) => !(cells.length === 1 && cells[0].trim() === ''));
}

/**
 * Splits the file and pairs each data row with the header, so every later validation
 * error can name the CSV line it came from rather than an opaque row index.
 */
export function parseQuestionCsv(text: string): ParsedCsv {
	const table = splitCsv(text);

	if (table.length === 0) {
		return { ok: false, error: 'The file is empty.' };
	}

	const header = table[0].map((cell) => cell.trim().toLowerCase());
	const missing = CSV_COLUMNS.filter((column) => !header.includes(column));

	if (missing.length > 0) {
		return {
			ok: false,
			error: `Missing column${missing.length === 1 ? '' : 's'}: ${missing.join(', ')}.`
		};
	}

	const rows: CsvRow[] = table.slice(1).map((cells, index) => {
		const raw: Record<string, string> = {};
		header.forEach((column, columnIndex) => {
			raw[column] = (cells[columnIndex] ?? '').trim();
		});
		// Line 1 is the header, so the first data row is line 2 — matching what an admin
		// sees if they open the file in a spreadsheet or text editor.
		return { line: index + 2, raw };
	});

	return { ok: true, rows };
}

export type ImportRowResult =
	{ ok: true; line: number; value: QuestionInput } | { ok: false; line: number; errors: string[] };

/**
 * Row shape and content validation only — `format` is always `STANDARD`, matching the
 * one format the admin dashboard's question form itself authors (see `validation.ts`).
 * Media ids are parsed here but not checked against the database; the caller
 * (`import.server.ts`) does that once, in bulk, against the DB.
 */
export function toQuestionInput(
	row: CsvRow,
	context: { level: JlptLevel; section: Section }
): ImportRowResult {
	const errors: string[] = [];
	const stem = row.raw.stem;

	if (!stem) errors.push('stem is required.');

	const optionValues = OPTION_COLUMNS.map((column) => row.raw[column] ?? '');
	let lastFilled = -1;
	for (let i = 0; i < optionValues.length; i++) {
		if (optionValues[i] !== '') lastFilled = i;
	}
	for (let i = 0; i < lastFilled; i++) {
		if (optionValues[i] === '') {
			errors.push(`${OPTION_COLUMNS[i]} is blank but a later option column is filled.`);
		}
	}
	const options = optionValues.slice(0, lastFilled + 1);
	if (options.length < 2) {
		errors.push('At least two options (option_a, option_b, …) are required.');
	}

	const correctLetter = row.raw.correct_option.trim().toUpperCase();
	const correctIndex = correctLetter.charCodeAt(0) - 'A'.charCodeAt(0);
	const validLetter = /^[A-F]$/.test(correctLetter);
	if (!validLetter) {
		errors.push('correct_option must be a single letter A-F.');
	} else if (correctIndex >= options.length || options[correctIndex] === '') {
		errors.push(`correct_option (${correctLetter}) does not match a filled option.`);
	}

	let points = 1;
	if (row.raw.points !== '') {
		const parsed = Number(row.raw.points);
		if (!Number.isInteger(parsed) || parsed < 1) {
			errors.push('points must be a whole number of 1 or more.');
		} else {
			points = parsed;
		}
	}

	const mediaId = (column: 'image_media_id' | 'audio_media_id'): number | null | undefined => {
		const raw = row.raw[column];
		if (raw === '') return null;
		const parsed = Number(raw);
		if (!Number.isInteger(parsed) || parsed < 1) {
			errors.push(`${column} must be a whole number matching a Media ID, or blank.`);
			return undefined;
		}
		return parsed;
	};

	const imageMediaId = mediaId('image_media_id');
	const audioMediaId = mediaId('audio_media_id');

	if (errors.length > 0) {
		return { ok: false, line: row.line, errors };
	}

	return {
		ok: true,
		line: row.line,
		value: {
			stem,
			explanation: row.raw.explanation || null,
			level: context.level,
			section: context.section,
			format: 'STANDARD',
			promptTranslation: null,
			focusText: null,
			focusReading: null,
			contextText: null,
			contextTransliteration: null,
			points,
			imageMediaId: imageMediaId ?? null,
			audioMediaId: audioMediaId ?? null,
			groupId: null,
			groupPosition: null,
			options: options.map((body, index) => ({
				id: null,
				body,
				isCorrect: index === correctIndex,
				position: index + 1
			}))
		}
	};
}
