import type { JlptLevel, Section } from '$lib/domain/enums';
import type { Database } from '$lib/server/db';
import { parseQuestionCsv, toQuestionInput, type CsvRow } from './csv-import';
import { checkMediaSlots, createQuestion, getQuestionRefByPublicId } from './questions.server';
import type { QuestionInput } from './validation';

/** A CSV larger than this is almost certainly the wrong file, not a big quiz. */
export const MAX_IMPORT_ROWS = 500;

export type ImportRowOutcome =
	| { line: number; ok: true; stem: string; optionCount: number; value: QuestionInput }
	| { line: number; ok: false; errors: string[] };

export type ImportValidation =
	{ ok: true; rows: ImportRowOutcome[] } | { ok: false; error: string };

/**
 * Parses and fully validates a question-import CSV — shape, format rules, and (unlike
 * `csv-import.ts`'s pure `toQuestionInput`) whether every referenced Media ID actually
 * exists and is the right kind. Nothing is written yet; this is the preview step.
 */
export async function validateImportCsv(
	db: Database,
	csvText: string,
	context: { level: JlptLevel; section: Section }
): Promise<ImportValidation> {
	const parsed = parseQuestionCsv(csvText);
	if (!parsed.ok) return { ok: false, error: parsed.error };

	if (parsed.rows.length === 0) {
		return { ok: false, error: 'The file has a header row but no data rows.' };
	}
	if (parsed.rows.length > MAX_IMPORT_ROWS) {
		return {
			ok: false,
			error: `This file has ${parsed.rows.length} rows; imports are capped at ${MAX_IMPORT_ROWS} at a time.`
		};
	}

	const rows: ImportRowOutcome[] = [];

	for (const row of parsed.rows) {
		const converted = toQuestionInput(row as CsvRow, context);

		if (!converted.ok) {
			rows.push({ line: converted.line, ok: false, errors: converted.errors });
			continue;
		}

		const mediaErrors = await checkMediaSlots(db, converted.value);
		const messages = Object.values(mediaErrors);

		if (messages.length > 0) {
			rows.push({ line: converted.line, ok: false, errors: messages });
			continue;
		}

		rows.push({
			line: converted.line,
			ok: true,
			stem: converted.value.stem,
			optionCount: converted.value.options.length,
			value: converted.value
		});
	}

	return { ok: true, rows };
}

/** The client-facing shape of one preview row, stripped of the full `QuestionInput`. */
export type ImportPreviewRow =
	| { line: number; ok: true; stem: string; optionCount: number }
	| { line: number; ok: false; errors: string[] };

export function toPreviewRow(outcome: ImportRowOutcome): ImportPreviewRow {
	return outcome.ok
		? { line: outcome.line, ok: true, stem: outcome.stem, optionCount: outcome.optionCount }
		: { line: outcome.line, ok: false, errors: outcome.errors };
}

export type ImportCommitResult = { line: number; publicId: string; questionId: number };

/**
 * Creates every valid row as a DRAFT bank question — never attached, never published,
 * matching `createQuestionForSection`'s single-question path. The quiz-page import screen
 * runs `publishAndAttachMany` (see `authoring.server.ts`) over the returned question ids
 * as its own explicit follow-up step.
 */
export async function commitImportedQuestions(
	db: Database,
	actorUserId: number | null,
	rows: { line: number; value: QuestionInput }[]
): Promise<ImportCommitResult[]> {
	const results: ImportCommitResult[] = [];

	for (const row of rows) {
		const created = await createQuestion(db, actorUserId, row.value);
		if (created.ok) {
			// createQuestion only hands back a public id; the internal id is needed to
			// attach it to a quiz section next, so it's fetched once, right after the
			// insert that produced it.
			const ref = await getQuestionRefByPublicId(db, created.value);
			if (ref) {
				results.push({ line: row.line, publicId: created.value, questionId: ref.id });
			}
		}
	}

	return results;
}
