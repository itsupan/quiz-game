import {
	JLPT_LEVELS,
	QUIZ_ICONS,
	QUIZ_MODES,
	SECTIONS,
	SELECTION_MODES,
	type JlptLevel,
	type QuizMode,
	type Section,
	type SelectionMode
} from '$lib/domain/enums';
import { apiProblem } from '$lib/features/admin/api/http.server';
import type { ValidationIssue } from '$lib/server/http/problem';
import { drawCountRule, quizModeRequiresTimeLimit } from './validation';
import type { QuizInput, QuizSectionInput } from './validation';

export const QUIZ_BODY_FIELDS = [
	'title',
	'description',
	'mode',
	'level',
	'selectionMode',
	'icon',
	'timeLimitSeconds',
	'showStudyAidsDuringAttempt',
	'xpReward'
] as const;

export const QUIZ_SECTION_BODY_FIELDS = [
	'section',
	'position',
	'timeLimitSeconds',
	'drawCount'
] as const;

/** A single issue becomes the problem's own `detail`; several fall back to a summary. */
function fail(errors: ValidationIssue[]): never {
	const detail = errors.length === 1 ? errors[0].message : 'The request body is invalid.';
	apiProblem(422, 'validation_failed', 'Validation failed', detail, errors);
}

function readTitle(body: Record<string, unknown>, errors: ValidationIssue[]): string | undefined {
	if (!('title' in body)) return undefined;
	const { title } = body;
	if (typeof title !== 'string' || title.trim() === '') {
		errors.push({ field: 'title', message: 'title must be a non-empty string.' });
		return undefined;
	}
	return title;
}

function readDescription(
	body: Record<string, unknown>,
	errors: ValidationIssue[]
): string | null | undefined {
	if (!('description' in body)) return undefined;
	const { description } = body;
	if (description !== null && typeof description !== 'string') {
		errors.push({ field: 'description', message: 'description must be a string or null.' });
		return undefined;
	}
	return description === '' ? null : description;
}

function readEnum<const Values extends readonly string[]>(
	body: Record<string, unknown>,
	field: string,
	values: Values,
	errors: ValidationIssue[]
): Values[number] | undefined {
	if (!(field in body)) return undefined;
	const value = body[field];
	if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
		errors.push({ field, message: `${field} must be one of: ${values.join(', ')}.` });
		return undefined;
	}
	return value as Values[number];
}

/** `null` clears a time limit; omission means "leave unchanged" on a patch. */
function readTimeLimitSeconds(
	body: Record<string, unknown>,
	errors: ValidationIssue[]
): number | null | undefined {
	if (!('timeLimitSeconds' in body)) return undefined;
	const value = body.timeLimitSeconds;
	if (value === null) return null;
	if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
		errors.push({
			field: 'timeLimitSeconds',
			message: 'timeLimitSeconds must be a positive integer or null.'
		});
		return undefined;
	}
	return value;
}

function readPositiveInteger(
	body: Record<string, unknown>,
	field: string,
	errors: ValidationIssue[]
): number | undefined {
	if (!(field in body)) return undefined;
	const value = body[field];
	if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
		errors.push({ field, message: `${field} must be a positive integer.` });
		return undefined;
	}
	return value;
}

function readBoolean(
	body: Record<string, unknown>,
	field: string,
	errors: ValidationIssue[]
): boolean | undefined {
	if (!(field in body)) return undefined;
	const value = body[field];
	if (typeof value !== 'boolean') {
		errors.push({ field, message: `${field} must be a boolean.` });
		return undefined;
	}
	return value;
}

function readNonNegativeInteger(
	body: Record<string, unknown>,
	field: string,
	errors: ValidationIssue[]
): number | undefined {
	if (!(field in body)) return undefined;
	const value = body[field];
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) {
		errors.push({ field, message: `${field} must be a non-negative integer.` });
		return undefined;
	}
	return value;
}

function readNullablePositiveInteger(
	body: Record<string, unknown>,
	field: string,
	errors: ValidationIssue[]
): number | null | undefined {
	if (!(field in body)) return undefined;
	const value = body[field];
	if (value === null) return null;
	if (typeof value !== 'number' || !Number.isInteger(value) || value <= 0) {
		errors.push({ field, message: `${field} must be a positive integer or null.` });
		return undefined;
	}
	return value;
}

/** Builds a fresh `QuizInput` from a create body: every field is required. */
export function parseQuizCreateBody(body: Record<string, unknown>): QuizInput {
	const errors: ValidationIssue[] = [];

	for (const field of ['title', 'mode', 'level', 'selectionMode'] as const) {
		if (!(field in body)) errors.push({ field, message: `${field} is required.` });
	}

	const title = readTitle(body, errors);
	const description = readDescription(body, errors);
	const mode = readEnum(body, 'mode', QUIZ_MODES, errors);
	const level = readEnum(body, 'level', JLPT_LEVELS, errors);
	const selectionMode = readEnum(body, 'selectionMode', SELECTION_MODES, errors);
	const icon = readEnum(body, 'icon', QUIZ_ICONS, errors);
	const timeLimitSeconds = readTimeLimitSeconds(body, errors);
	const showStudyAidsDuringAttempt = readBoolean(body, 'showStudyAidsDuringAttempt', errors);
	const xpReward = readNonNegativeInteger(body, 'xpReward', errors);

	if (errors.length > 0) fail(errors);

	const resolvedTimeLimit = timeLimitSeconds ?? null;
	if (resolvedTimeLimit === null && mode && quizModeRequiresTimeLimit(mode)) {
		fail([
			{
				field: 'timeLimitSeconds',
				message: `A ${mode.replace('_', ' ').toLowerCase()} needs a time limit.`
			}
		]);
	}

	return {
		title: title as string,
		description: description ?? null,
		mode: mode as QuizMode,
		level: level as JlptLevel,
		selectionMode: selectionMode as SelectionMode,
		icon: icon ?? 'book',
		timeLimitSeconds: resolvedTimeLimit,
		showStudyAidsDuringAttempt: showStudyAidsDuringAttempt ?? false,
		xpReward: xpReward ?? 0
	};
}

/**
 * Merges a patch body onto the current quiz and validates the RESULT with the same rule
 * a create runs — so `PATCH { mode: "MOCK_TEST" }` on an untimed practice quiz is rejected
 * exactly as a create with the same combination would be, rather than silently producing
 * an invalid quiz.
 */
export function parseQuizPatchBody(current: QuizInput, body: Record<string, unknown>): QuizInput {
	const errors: ValidationIssue[] = [];

	const title = readTitle(body, errors);
	const description = readDescription(body, errors);
	const mode = readEnum(body, 'mode', QUIZ_MODES, errors);
	const level = readEnum(body, 'level', JLPT_LEVELS, errors);
	const selectionMode = readEnum(body, 'selectionMode', SELECTION_MODES, errors);
	const icon = readEnum(body, 'icon', QUIZ_ICONS, errors);
	const timeLimitSeconds = readTimeLimitSeconds(body, errors);
	const showStudyAidsDuringAttempt = readBoolean(body, 'showStudyAidsDuringAttempt', errors);
	const xpReward = readNonNegativeInteger(body, 'xpReward', errors);

	if (errors.length > 0) fail(errors);

	const merged: QuizInput = {
		title: title ?? current.title,
		description: description === undefined ? current.description : description,
		mode: mode ?? current.mode,
		level: level ?? current.level,
		selectionMode: selectionMode ?? current.selectionMode,
		icon: icon ?? current.icon,
		timeLimitSeconds: timeLimitSeconds === undefined ? current.timeLimitSeconds : timeLimitSeconds,
		showStudyAidsDuringAttempt: showStudyAidsDuringAttempt ?? current.showStudyAidsDuringAttempt,
		xpReward: xpReward ?? current.xpReward
	};

	if (merged.timeLimitSeconds === null && quizModeRequiresTimeLimit(merged.mode)) {
		fail([
			{
				field: 'timeLimitSeconds',
				message: `A ${merged.mode.replace('_', ' ').toLowerCase()} needs a time limit.`
			}
		]);
	}

	return merged;
}

/** A section create body: the section enum plus its configuration. */
export function parseQuizSectionCreateBody(
	body: Record<string, unknown>,
	selectionMode: SelectionMode
): QuizSectionInput {
	const errors: ValidationIssue[] = [];

	for (const field of ['section', 'position'] as const) {
		if (!(field in body)) errors.push({ field, message: `${field} is required.` });
	}

	const section = readEnum(body, 'section', SECTIONS, errors);
	const position = readPositiveInteger(body, 'position', errors);
	const timeLimitSeconds = readNullablePositiveInteger(body, 'timeLimitSeconds', errors);
	const drawCount = readNullablePositiveInteger(body, 'drawCount', errors);

	if (errors.length > 0) fail(errors);

	const drawCountError = drawCountRule(selectionMode, drawCount ?? null);
	if (drawCountError) fail([{ field: 'drawCount', message: drawCountError }]);

	return {
		section: section as Section,
		position: position as number,
		timeLimitSeconds: timeLimitSeconds ?? null,
		drawCount: drawCount ?? null
	};
}

/**
 * A section update body. `section` is the URL identifier, not a body field — a request
 * cannot move a section to a different enum value, since that would just be a different
 * resource under this scheme.
 */
export function parseQuizSectionPatchBody(
	current: Pick<QuizSectionInput, 'position' | 'timeLimitSeconds' | 'drawCount'>,
	body: Record<string, unknown>,
	section: Section,
	selectionMode: SelectionMode
): QuizSectionInput {
	const errors: ValidationIssue[] = [];

	if ('section' in body) {
		errors.push({
			field: 'section',
			message: 'section cannot be changed; it is the URL identifier.'
		});
	}

	const position = readPositiveInteger(body, 'position', errors);
	const timeLimitSeconds = readNullablePositiveInteger(body, 'timeLimitSeconds', errors);
	const drawCount = readNullablePositiveInteger(body, 'drawCount', errors);

	if (errors.length > 0) fail(errors);

	const merged: QuizSectionInput = {
		section,
		position: position ?? current.position,
		timeLimitSeconds: timeLimitSeconds === undefined ? current.timeLimitSeconds : timeLimitSeconds,
		drawCount: drawCount === undefined ? current.drawCount : drawCount
	};

	const drawCountError = drawCountRule(selectionMode, merged.drawCount);
	if (drawCountError) fail([{ field: 'drawCount', message: drawCountError }]);

	return merged;
}
