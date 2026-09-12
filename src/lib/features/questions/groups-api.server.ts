import {
	GROUP_FORMATS,
	JLPT_LEVELS,
	SECTIONS,
	type JlptLevel,
	type Section
} from '$lib/domain/enums';
import { apiProblem } from '$lib/features/admin/api/http.server';
import type { Database } from '$lib/server/db';
import type { GroupFormat, MediaAsset, QuestionGroup } from '$lib/server/db/schema';
import type { ValidationIssue } from '$lib/server/http/problem';
import type { GroupListItem } from './groups.server';
import type { GroupInput } from './groups-validation';
import { readMediaRef, resolveMediaRefs } from './media-ref.server';

/** A single issue becomes the problem's own `detail`; several fall back to a summary. */
function fail(errors: ValidationIssue[]): never {
	const detail = errors.length === 1 ? errors[0].message : 'The request body is invalid.';
	apiProblem(422, 'validation_failed', 'Validation failed', detail, errors);
}

export const GROUP_BODY_FIELDS = [
	'level',
	'section',
	'format',
	'title',
	'body',
	'instruction',
	'bodyTranslation',
	'exampleText',
	'exampleTransliteration',
	'exampleTranslation',
	'imageId',
	'audioId'
] as const;

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

/** Every field is required: a create has nothing to fall back to. */
export async function parseGroupCreateBody(
	db: Database,
	body: Record<string, unknown>
): Promise<GroupInput> {
	const errors: ValidationIssue[] = [];

	for (const field of ['level', 'section', 'format'] as const) {
		if (!(field in body)) errors.push({ field, message: `${field} is required.` });
	}

	const level = readEnum(body, 'level', JLPT_LEVELS, errors);
	const section = readEnum(body, 'section', SECTIONS, errors);
	const format = readEnum(body, 'format', GROUP_FORMATS, errors);
	const title = readNullableText(body, 'title', errors);
	const groupBody = readNullableText(body, 'body', errors);
	const instruction = readNullableText(body, 'instruction', errors);
	const bodyTranslation = readNullableText(body, 'bodyTranslation', errors);
	const exampleText = readNullableText(body, 'exampleText', errors);
	const exampleTransliteration = readNullableText(body, 'exampleTransliteration', errors);
	const exampleTranslation = readNullableText(body, 'exampleTranslation', errors);
	const imageId = readMediaRef(body, 'imageId', errors);
	const audioId = readMediaRef(body, 'audioId', errors);

	if (errors.length > 0) fail(errors);

	const media = await resolveMediaRefs(db, imageId ?? null, audioId ?? null);

	return {
		level: level as JlptLevel,
		section: section as Section,
		format: format as GroupFormat,
		title: title ?? null,
		body: groupBody ?? null,
		instruction: instruction ?? null,
		bodyTranslation: bodyTranslation ?? null,
		exampleText: exampleText ?? null,
		exampleTransliteration: exampleTransliteration ?? null,
		exampleTranslation: exampleTranslation ?? null,
		imageMediaId: media.imageMediaId,
		audioMediaId: media.audioMediaId
	};
}

export type CurrentGroup = Omit<GroupInput, 'imageMediaId' | 'audioMediaId'> & {
	imageId: string | null;
	audioId: string | null;
};

export function currentGroupFrom(
	group: QuestionGroup,
	image: MediaAsset | null,
	audio: MediaAsset | null
): CurrentGroup {
	return {
		level: group.level,
		section: group.section,
		format: group.format,
		title: group.title,
		body: group.passageText,
		instruction: group.instruction,
		bodyTranslation: group.bodyTranslation,
		exampleText: group.exampleText,
		exampleTransliteration: group.exampleTransliteration,
		exampleTranslation: group.exampleTranslation,
		imageId: image?.publicId ?? null,
		audioId: audio?.publicId ?? null
	};
}

/** Every field follows "omitted keeps current, explicit null clears". */
export async function parseGroupPatchBody(
	db: Database,
	current: CurrentGroup,
	body: Record<string, unknown>
): Promise<GroupInput> {
	const errors: ValidationIssue[] = [];

	const level = readEnum(body, 'level', JLPT_LEVELS, errors);
	const section = readEnum(body, 'section', SECTIONS, errors);
	const format = readEnum(body, 'format', GROUP_FORMATS, errors);
	const title = readNullableText(body, 'title', errors);
	const groupBody = readNullableText(body, 'body', errors);
	const instruction = readNullableText(body, 'instruction', errors);
	const bodyTranslation = readNullableText(body, 'bodyTranslation', errors);
	const exampleText = readNullableText(body, 'exampleText', errors);
	const exampleTransliteration = readNullableText(body, 'exampleTransliteration', errors);
	const exampleTranslation = readNullableText(body, 'exampleTranslation', errors);
	const imageId = readMediaRef(body, 'imageId', errors);
	const audioId = readMediaRef(body, 'audioId', errors);

	if (errors.length > 0) fail(errors);

	const media = await resolveMediaRefs(
		db,
		imageId === undefined ? current.imageId : imageId,
		audioId === undefined ? current.audioId : audioId
	);

	return {
		level: (level ?? current.level) as JlptLevel,
		section: (section ?? current.section) as Section,
		format: (format ?? current.format) as GroupFormat,
		title: title === undefined ? current.title : title,
		body: groupBody === undefined ? current.body : groupBody,
		instruction: instruction === undefined ? current.instruction : instruction,
		bodyTranslation: bodyTranslation === undefined ? current.bodyTranslation : bodyTranslation,
		exampleText: exampleText === undefined ? current.exampleText : exampleText,
		exampleTransliteration:
			exampleTransliteration === undefined
				? current.exampleTransliteration
				: exampleTransliteration,
		exampleTranslation:
			exampleTranslation === undefined ? current.exampleTranslation : exampleTranslation,
		imageMediaId: media.imageMediaId,
		audioMediaId: media.audioMediaId
	};
}

export function toGroupListItemDto(item: GroupListItem) {
	return {
		id: item.publicId,
		level: item.level,
		section: item.section,
		format: item.format,
		title: item.title,
		status: item.status,
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

export function toGroupDetailDto(input: {
	group: QuestionGroup;
	image: MediaAsset | null;
	audio: MediaAsset | null;
	blockers: string[];
}) {
	return {
		id: input.group.publicId,
		level: input.group.level,
		section: input.group.section,
		format: input.group.format,
		title: input.group.title,
		body: input.group.passageText,
		bodyTranslation: input.group.bodyTranslation,
		instruction: input.group.instruction,
		exampleText: input.group.exampleText,
		exampleTransliteration: input.group.exampleTransliteration,
		exampleTranslation: input.group.exampleTranslation,
		image: toMediaRefDto(input.image, 'IMAGE'),
		audio: toMediaRefDto(input.audio, 'AUDIO'),
		status: input.group.status,
		blockers: input.blockers,
		createdAt: input.group.createdAt.toISOString(),
		updatedAt: input.group.updatedAt.toISOString()
	};
}
