import {
	JLPT_LEVELS,
	QUESTION_FORMATS,
	SECTIONS,
	type GroupFormat,
	type JlptLevel,
	type QuestionFormat,
	type Section
} from '$lib/domain/enums';
import { apiProblem } from '$lib/features/admin/api/http.server';
import type { Database } from '$lib/server/db';
import type { MediaAsset, Question, QuestionGroup, QuestionOption } from '$lib/server/db/schema';
import type { ValidationIssue } from '$lib/server/http/problem';
import { getGroupRefByPublicId } from './groups.server';
import { readMediaRef, resolveMediaRefs } from './media-ref.server';
import type { QuestionInput, QuestionOptionInput } from './validation';
import { formatContentErrors } from './validation';

/** A single issue becomes the problem's own `detail`; several fall back to a summary. */
function fail(errors: ValidationIssue[]): never {
	const detail = errors.length === 1 ? errors[0].message : 'The request body is invalid.';
	apiProblem(422, 'validation_failed', 'Validation failed', detail, errors);
}

export const QUESTION_BODY_FIELDS = [
	'stem',
	'explanation',
	'level',
	'section',
	'format',
	'promptTranslation',
	'focusText',
	'focusReading',
	'contextText',
	'contextTransliteration',
	'points',
	'imageId',
	'audioId',
	'groupId',
	'groupPosition',
	'options'
] as const;

/** Which group format each question format may attach to. `null` means "may not attach a group". */
const REQUIRED_GROUP_FORMAT: Partial<Record<QuestionFormat, GroupFormat>> = {
	READING_COMPREHENSION: 'READING_PASSAGE',
	LISTENING_COMPREHENSION: 'LISTENING_CLIP'
};

/** Formats a `GRAMMAR_CLOZE` question may optionally attach to, beyond the required map above. */
const OPTIONAL_GROUP_FORMAT: Partial<Record<QuestionFormat, GroupFormat>> = {
	GRAMMAR_CLOZE: 'CONCEPT_REVIEW'
};

type OptionCandidate = { body: string; isCorrect: boolean };

function readOptions(
	body: Record<string, unknown>,
	errors: ValidationIssue[]
): OptionCandidate[] | undefined {
	if (!('options' in body)) return undefined;

	const value = body.options;
	if (!Array.isArray(value) || value.length < 2) {
		errors.push({ field: 'options', message: 'options must be an array of at least two entries.' });
		return undefined;
	}

	const parsed: OptionCandidate[] = [];
	for (const [index, entry] of value.entries()) {
		if (
			typeof entry !== 'object' ||
			entry === null ||
			typeof (entry as Record<string, unknown>).body !== 'string' ||
			(entry as Record<string, unknown>).body === '' ||
			typeof (entry as Record<string, unknown>).isCorrect !== 'boolean'
		) {
			errors.push({
				field: `options.${index}`,
				message: 'Each option needs a non-empty string body and a boolean isCorrect.'
			});
			continue;
		}

		parsed.push({
			body: ((entry as Record<string, unknown>).body as string).trim(),
			isCorrect: (entry as Record<string, unknown>).isCorrect as boolean
		});
	}

	if (parsed.length !== value.length) return undefined;
	if (parsed.some((option) => option.body === '')) {
		errors.push({ field: 'options', message: 'An option body cannot be blank.' });
		return undefined;
	}
	if (parsed.filter((option) => option.isCorrect).length !== 1) {
		errors.push({ field: 'options', message: 'Exactly one option must be marked isCorrect.' });
		return undefined;
	}

	return parsed;
}

function readStem(body: Record<string, unknown>, errors: ValidationIssue[]): string | undefined {
	if (!('stem' in body)) return undefined;
	const { stem } = body;
	if (typeof stem !== 'string' || stem.trim() === '') {
		errors.push({ field: 'stem', message: 'stem must be a non-empty string.' });
		return undefined;
	}
	return stem.trim();
}

/** A nullable free-text field: omitted = unset, `null` or `""` = clear, otherwise a string. */
function readNullableText(
	body: Record<string, unknown>,
	field: string,
	errors: ValidationIssue[]
): string | null | undefined {
	if (!(field in body)) return undefined;
	const value = body[field];
	if (value !== null && typeof value !== 'string') {
		errors.push({ field, message: `${field} must be a string or null.` });
		return undefined;
	}
	return value === '' ? null : value;
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

function readPoints(body: Record<string, unknown>, errors: ValidationIssue[]): number | undefined {
	if (!('points' in body)) return undefined;
	const { points } = body;
	if (typeof points !== 'number' || !Number.isInteger(points) || points < 1) {
		errors.push({ field: 'points', message: 'points must be a whole number of 1 or more.' });
		return undefined;
	}
	return points;
}

/** `undefined` = omitted, `null` = detach, string = a group public id. */
function readGroupId(
	body: Record<string, unknown>,
	errors: ValidationIssue[]
): string | null | undefined {
	if (!('groupId' in body)) return undefined;
	const value = body.groupId;
	if (value !== null && typeof value !== 'string') {
		errors.push({ field: 'groupId', message: 'groupId must be a group id string or null.' });
		return undefined;
	}
	return value;
}

function readGroupPosition(
	body: Record<string, unknown>,
	errors: ValidationIssue[]
): number | null | undefined {
	if (!('groupPosition' in body)) return undefined;
	const value = body.groupPosition;
	if (value === null) return null;
	if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) {
		errors.push({
			field: 'groupPosition',
			message: 'groupPosition must be a positive integer or null.'
		});
		return undefined;
	}
	return value;
}

/**
 * Resolves a question's `groupId`/`groupPosition` against its own (already-merged)
 * format, level and section — the format-to-group-type compatibility and the
 * "identical level and section" rule from the coverage plan.
 */
async function resolveGroup(
	db: Database,
	format: QuestionFormat,
	level: JlptLevel,
	section: Section,
	groupId: string | null,
	groupPosition: number | null
): Promise<number | null> {
	if (groupId === null) {
		const requiredFormat = REQUIRED_GROUP_FORMAT[format];
		if (requiredFormat) {
			fail([{ field: 'groupId', message: `${format} requires a groupId.` }]);
		}
		if (groupPosition !== null) {
			fail([{ field: 'groupPosition', message: 'groupPosition requires a groupId.' }]);
		}
		return null;
	}

	const allowedFormat = REQUIRED_GROUP_FORMAT[format] ?? OPTIONAL_GROUP_FORMAT[format];
	if (!allowedFormat) {
		fail([{ field: 'groupId', message: `groupId is not supported for the ${format} format.` }]);
	}

	if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(groupId)) {
		fail([{ field: 'groupId', message: 'groupId must be a 26-character ULID.' }]);
	}

	const group = await getGroupRefByPublicId(db, groupId);
	if (!group) {
		fail([{ field: 'groupId', message: 'That question group does not exist.' }]);
	}

	if (group.level !== level || group.section !== section) {
		fail([
			{
				field: 'groupId',
				message: 'The attached group must have the same level and section as the question.'
			}
		]);
	}

	if (group.format !== allowedFormat) {
		fail([{ field: 'groupId', message: `${format} requires a ${allowedFormat} group.` }]);
	}

	return group.id;
}

function toOptionInputs(options: OptionCandidate[]): QuestionOptionInput[] {
	return options.map((option, index) => ({
		id: null,
		body: option.body,
		isCorrect: option.isCorrect,
		position: index + 1
	}));
}

/** Every field is required: a create has nothing to fall back to. */
export async function parseQuestionCreateBody(
	db: Database,
	body: Record<string, unknown>
): Promise<QuestionInput> {
	const errors: ValidationIssue[] = [];

	for (const field of ['stem', 'level', 'section', 'options'] as const) {
		if (!(field in body)) errors.push({ field, message: `${field} is required.` });
	}

	const stem = readStem(body, errors);
	const explanation = readNullableText(body, 'explanation', errors);
	const level = readEnum(body, 'level', JLPT_LEVELS, errors);
	const section = readEnum(body, 'section', SECTIONS, errors);
	const format = readEnum(body, 'format', QUESTION_FORMATS, errors);
	const promptTranslation = readNullableText(body, 'promptTranslation', errors);
	const focusText = readNullableText(body, 'focusText', errors);
	const focusReading = readNullableText(body, 'focusReading', errors);
	const contextText = readNullableText(body, 'contextText', errors);
	const contextTransliteration = readNullableText(body, 'contextTransliteration', errors);
	const points = readPoints(body, errors);
	const imageId = readMediaRef(body, 'imageId', errors);
	const audioId = readMediaRef(body, 'audioId', errors);
	const groupId = readGroupId(body, errors);
	const groupPosition = readGroupPosition(body, errors);
	const options = readOptions(body, errors);

	if (errors.length > 0) fail(errors);

	const resolvedFormat = (format ?? 'STANDARD') as QuestionFormat;
	const contentErrors = formatContentErrors({
		format: resolvedFormat,
		focusText: focusText ?? null,
		contextText: contextText ?? null
	});
	if (contentErrors.length > 0) {
		fail(contentErrors.map((message) => ({ field: 'format', message })));
	}

	const media = await resolveMediaRefs(db, imageId ?? null, audioId ?? null);
	const resolvedGroupId = await resolveGroup(
		db,
		resolvedFormat,
		level as JlptLevel,
		section as Section,
		groupId ?? null,
		groupPosition ?? null
	);

	return {
		stem: stem as string,
		explanation: explanation ?? null,
		level: level as JlptLevel,
		section: section as Section,
		format: resolvedFormat,
		promptTranslation: promptTranslation ?? null,
		focusText: focusText ?? null,
		focusReading: focusReading ?? null,
		contextText: contextText ?? null,
		contextTransliteration: contextTransliteration ?? null,
		points: points ?? 1,
		imageMediaId: media.imageMediaId,
		audioMediaId: media.audioMediaId,
		groupId: resolvedGroupId,
		groupPosition: groupPosition ?? null,
		options: toOptionInputs(options as OptionCandidate[])
	};
}

export type CurrentQuestion = {
	stem: string;
	explanation: string | null;
	level: JlptLevel;
	section: Section;
	format: QuestionFormat;
	promptTranslation: string | null;
	focusText: string | null;
	focusReading: string | null;
	contextText: string | null;
	contextTransliteration: string | null;
	points: number;
	imageId: string | null;
	audioId: string | null;
	groupId: string | null;
	groupPosition: number | null;
};

export function currentQuestionFrom(
	question: Question,
	image: MediaAsset | null,
	audio: MediaAsset | null,
	group: QuestionGroup | null
): CurrentQuestion {
	return {
		stem: question.stem,
		explanation: question.explanation,
		level: question.level,
		section: question.section,
		format: question.format,
		promptTranslation: question.promptTranslation,
		focusText: question.focusText,
		focusReading: question.focusReading,
		contextText: question.contextText,
		contextTransliteration: question.contextTransliteration,
		points: question.points,
		imageId: image?.publicId ?? null,
		audioId: audio?.publicId ?? null,
		groupId: group?.publicId ?? null,
		groupPosition: question.groupPosition
	};
}

/**
 * Merges a patch onto the current question. `options`, when provided, replaces the whole
 * set — the public API has no stable identifier for an individual option to target a
 * partial edit at, so a patch either leaves every option untouched or replaces all of
 * them. `existingOptions` is what keeps the "untouched" half real: it is fed back to
 * `updateQuestion` with its original ids and positions so an update that only changes,
 * say, `points` does not disturb the option rows at all.
 *
 * Every other field follows the same "omitted keeps current, explicit null clears" rule,
 * including `groupId` — an update that does not mention `groupId` must not silently
 * detach an attached group.
 */
export async function parseQuestionPatchBody(
	db: Database,
	current: CurrentQuestion,
	existingOptions: QuestionOption[],
	body: Record<string, unknown>
): Promise<QuestionInput> {
	const errors: ValidationIssue[] = [];

	const stem = readStem(body, errors);
	const explanation = readNullableText(body, 'explanation', errors);
	const level = readEnum(body, 'level', JLPT_LEVELS, errors);
	const section = readEnum(body, 'section', SECTIONS, errors);
	const format = readEnum(body, 'format', QUESTION_FORMATS, errors);
	const promptTranslation = readNullableText(body, 'promptTranslation', errors);
	const focusText = readNullableText(body, 'focusText', errors);
	const focusReading = readNullableText(body, 'focusReading', errors);
	const contextText = readNullableText(body, 'contextText', errors);
	const contextTransliteration = readNullableText(body, 'contextTransliteration', errors);
	const points = readPoints(body, errors);
	const imageId = readMediaRef(body, 'imageId', errors);
	const audioId = readMediaRef(body, 'audioId', errors);
	const groupId = readGroupId(body, errors);
	const groupPosition = readGroupPosition(body, errors);
	const options = readOptions(body, errors);

	if (errors.length > 0) fail(errors);

	const resolvedFormat = (format ?? current.format) as QuestionFormat;
	const resolvedFocusText = focusText === undefined ? current.focusText : focusText;
	const resolvedContextText = contextText === undefined ? current.contextText : contextText;
	const contentErrors = formatContentErrors({
		format: resolvedFormat,
		focusText: resolvedFocusText,
		contextText: resolvedContextText
	});
	if (contentErrors.length > 0) {
		fail(contentErrors.map((message) => ({ field: 'format', message })));
	}

	const media = await resolveMediaRefs(
		db,
		imageId === undefined ? current.imageId : imageId,
		audioId === undefined ? current.audioId : audioId
	);
	const resolvedGroupId = groupId === undefined ? current.groupId : groupId;
	// A position inherited from `current` is meaningless once the group itself is
	// detached — an explicit `groupId: null` clears it even when `groupPosition` was
	// left out of the patch, rather than forcing every detach to also repeat that field.
	const resolvedGroupPosition =
		resolvedGroupId === null
			? null
			: groupPosition === undefined
				? current.groupPosition
				: groupPosition;
	const groupInternalId = await resolveGroup(
		db,
		resolvedFormat,
		(level ?? current.level) as JlptLevel,
		(section ?? current.section) as Section,
		resolvedGroupId,
		resolvedGroupPosition
	);

	return {
		stem: stem ?? current.stem,
		explanation: explanation === undefined ? current.explanation : explanation,
		level: level ?? current.level,
		section: section ?? current.section,
		format: resolvedFormat,
		promptTranslation:
			promptTranslation === undefined ? current.promptTranslation : promptTranslation,
		focusText: resolvedFocusText,
		focusReading: focusReading === undefined ? current.focusReading : focusReading,
		contextText: resolvedContextText,
		contextTransliteration:
			contextTransliteration === undefined
				? current.contextTransliteration
				: contextTransliteration,
		points: points ?? current.points,
		imageMediaId: media.imageMediaId,
		audioMediaId: media.audioMediaId,
		groupId: groupInternalId,
		groupPosition: resolvedGroupPosition,
		options: options
			? toOptionInputs(options)
			: existingOptions.map((option) => ({
					id: option.id,
					body: option.body,
					isCorrect: option.isCorrect,
					position: option.position
				}))
	};
}

export function toQuestionListItemDto(item: {
	publicId: string;
	stem: string;
	level: JlptLevel;
	section: Section;
	format: QuestionFormat;
	status: string;
	points: number;
	optionCount: number;
	hasAnswerKey: boolean;
	hasImage: boolean;
	hasAudio: boolean;
	createdAt: Date;
	updatedAt: Date;
}) {
	return {
		id: item.publicId,
		stem: item.stem,
		level: item.level,
		section: item.section,
		format: item.format,
		status: item.status,
		points: item.points,
		optionCount: item.optionCount,
		hasAnswerKey: item.hasAnswerKey,
		hasImage: item.hasImage,
		hasAudio: item.hasAudio,
		createdAt: item.createdAt.toISOString(),
		updatedAt: item.updatedAt.toISOString()
	};
}

function toMediaRefDto(asset: MediaAsset | null, kind: 'IMAGE' | 'AUDIO') {
	if (!asset) return null;
	return {
		id: asset.publicId,
		url: `/media/${asset.publicId}`,
		altText: kind === 'IMAGE' ? asset.altText : undefined,
		transcript: kind === 'AUDIO' ? asset.transcript : undefined
	};
}

export function toQuestionDetailDto(input: {
	question: Question;
	options: QuestionOption[];
	image: MediaAsset | null;
	audio: MediaAsset | null;
	group: QuestionGroup | null;
	blockers: string[];
}) {
	return {
		id: input.question.publicId,
		stem: input.question.stem,
		explanation: input.question.explanation,
		level: input.question.level,
		section: input.question.section,
		format: input.question.format,
		promptTranslation: input.question.promptTranslation,
		focusText: input.question.focusText,
		focusReading: input.question.focusReading,
		contextText: input.question.contextText,
		contextTransliteration: input.question.contextTransliteration,
		points: input.question.points,
		status: input.question.status,
		image: toMediaRefDto(input.image, 'IMAGE'),
		audio: toMediaRefDto(input.audio, 'AUDIO'),
		groupId: input.group?.publicId ?? null,
		groupPosition: input.question.groupPosition,
		options: input.options.map((option) => ({
			body: option.body,
			isCorrect: option.isCorrect,
			position: option.position
		})),
		blockers: input.blockers,
		createdAt: input.question.createdAt.toISOString(),
		updatedAt: input.question.updatedAt.toISOString()
	};
}
