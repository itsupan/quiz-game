import { JLPT_LEVELS, SECTIONS, type JlptLevel, type Section } from '$lib/domain/enums';
import { apiProblem } from '$lib/features/admin/api/http.server';
import { getAssetByPublicId } from '$lib/features/media/media.server';
import type { Database } from '$lib/server/db';
import type { MediaAsset, Question, QuestionOption } from '$lib/server/db/schema';
import type { ValidationIssue } from '$lib/server/http/problem';
import { checkMediaSlots } from './questions.server';
import type { QuestionInput, QuestionOptionInput } from './validation';

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
	'points',
	'imageId',
	'audioId',
	'options'
] as const;

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

function readExplanation(
	body: Record<string, unknown>,
	errors: ValidationIssue[]
): string | null | undefined {
	if (!('explanation' in body)) return undefined;
	const { explanation } = body;
	if (explanation !== null && typeof explanation !== 'string') {
		errors.push({ field: 'explanation', message: 'explanation must be a string or null.' });
		return undefined;
	}
	return explanation === '' ? null : explanation;
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

/** `undefined` = omitted (leave unchanged on a patch), `null` = clear, string = a media public id. */
function readMediaRef(
	body: Record<string, unknown>,
	field: 'imageId' | 'audioId',
	errors: ValidationIssue[]
): string | null | undefined {
	if (!(field in body)) return undefined;
	const value = body[field];
	if (value !== null && typeof value !== 'string') {
		errors.push({ field, message: `${field} must be a media id string or null.` });
		return undefined;
	}
	return value;
}

async function resolveMediaRef(
	db: Database,
	publicId: string | null,
	field: 'imageId' | 'audioId'
): Promise<{ id: number | null; asset: MediaAsset | null }> {
	if (publicId === null) return { id: null, asset: null };

	if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(publicId)) {
		fail([{ field, message: `${field} must be a 26-character ULID.` }]);
	}

	const asset = await getAssetByPublicId(db, publicId);
	if (!asset) {
		fail([{ field, message: 'That file does not exist.' }]);
	}

	return { id: asset.id, asset };
}

const MEDIA_FIELD_BY_SLOT: Record<'imageMediaId' | 'audioMediaId', 'imageId' | 'audioId'> = {
	imageMediaId: 'imageId',
	audioMediaId: 'audioId'
};

async function resolveMedia(
	db: Database,
	imageId: string | null,
	audioId: string | null
): Promise<{ imageMediaId: number | null; audioMediaId: number | null }> {
	const image = await resolveMediaRef(db, imageId, 'imageId');
	const audio = await resolveMediaRef(db, audioId, 'audioId');
	const imageMediaId = image.id;
	const audioMediaId = audio.id;

	const slotErrors = await checkMediaSlots(db, { imageMediaId, audioMediaId });
	if (Object.keys(slotErrors).length > 0) {
		fail(
			Object.entries(slotErrors).map(([slot, message]) => ({
				field: MEDIA_FIELD_BY_SLOT[slot as 'imageMediaId' | 'audioMediaId'],
				message
			}))
		);
	}

	return { imageMediaId, audioMediaId };
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
	const explanation = readExplanation(body, errors);
	const level = readEnum(body, 'level', JLPT_LEVELS, errors);
	const section = readEnum(body, 'section', SECTIONS, errors);
	const points = readPoints(body, errors);
	const imageId = readMediaRef(body, 'imageId', errors);
	const audioId = readMediaRef(body, 'audioId', errors);
	const options = readOptions(body, errors);

	if (errors.length > 0) fail(errors);

	const media = await resolveMedia(db, imageId ?? null, audioId ?? null);

	return {
		stem: stem as string,
		explanation: explanation ?? null,
		level: level as JlptLevel,
		section: section as Section,
		points: points ?? 1,
		imageMediaId: media.imageMediaId,
		audioMediaId: media.audioMediaId,
		options: toOptionInputs(options as OptionCandidate[])
	};
}

export type CurrentQuestion = {
	stem: string;
	explanation: string | null;
	level: JlptLevel;
	section: Section;
	points: number;
	imageId: string | null;
	audioId: string | null;
};

export function currentQuestionFrom(
	question: Question,
	image: MediaAsset | null,
	audio: MediaAsset | null
): CurrentQuestion {
	return {
		stem: question.stem,
		explanation: question.explanation,
		level: question.level,
		section: question.section,
		points: question.points,
		imageId: image?.publicId ?? null,
		audioId: audio?.publicId ?? null
	};
}

/**
 * Merges a patch onto the current question. `options`, when provided, replaces the whole
 * set — the public API has no stable identifier for an individual option to target a
 * partial edit at, so a patch either leaves every option untouched or replaces all of
 * them. `existingOptions` is what keeps the "untouched" half real: it is fed back to
 * `updateQuestion` with its original ids and positions so an update that only changes,
 * say, `points` does not disturb the option rows at all.
 */
export async function parseQuestionPatchBody(
	db: Database,
	current: CurrentQuestion,
	existingOptions: QuestionOption[],
	body: Record<string, unknown>
): Promise<QuestionInput> {
	const errors: ValidationIssue[] = [];

	const stem = readStem(body, errors);
	const explanation = readExplanation(body, errors);
	const level = readEnum(body, 'level', JLPT_LEVELS, errors);
	const section = readEnum(body, 'section', SECTIONS, errors);
	const points = readPoints(body, errors);
	const imageId = readMediaRef(body, 'imageId', errors);
	const audioId = readMediaRef(body, 'audioId', errors);
	const options = readOptions(body, errors);

	if (errors.length > 0) fail(errors);

	const media = await resolveMedia(
		db,
		imageId === undefined ? current.imageId : imageId,
		audioId === undefined ? current.audioId : audioId
	);

	return {
		stem: stem ?? current.stem,
		explanation: explanation === undefined ? current.explanation : explanation,
		level: level ?? current.level,
		section: section ?? current.section,
		points: points ?? current.points,
		imageMediaId: media.imageMediaId,
		audioMediaId: media.audioMediaId,
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
	status: string;
	points: number;
	optionCount: number;
	hasAnswerKey: boolean;
	createdAt: Date;
	updatedAt: Date;
}) {
	return {
		id: item.publicId,
		stem: item.stem,
		level: item.level,
		section: item.section,
		status: item.status,
		points: item.points,
		optionCount: item.optionCount,
		hasAnswerKey: item.hasAnswerKey,
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
	blockers: string[];
}) {
	return {
		id: input.question.publicId,
		stem: input.question.stem,
		explanation: input.question.explanation,
		level: input.question.level,
		section: input.question.section,
		points: input.question.points,
		status: input.question.status,
		image: toMediaRefDto(input.image, 'IMAGE'),
		audio: toMediaRefDto(input.audio, 'AUDIO'),
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
