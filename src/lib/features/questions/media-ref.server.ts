import { apiProblem } from '$lib/features/admin/api/http.server';
import { getAssetByPublicId } from '$lib/features/media/media.server';
import type { Database } from '$lib/server/db';
import type { MediaAsset } from '$lib/server/db/schema';
import type { ValidationIssue } from '$lib/server/http/problem';
import { checkMediaSlots } from './questions.server';

/** A single issue becomes the problem's own `detail`; several fall back to a summary. */
function fail(errors: ValidationIssue[]): never {
	const detail = errors.length === 1 ? errors[0].message : 'The request body is invalid.';
	apiProblem(422, 'validation_failed', 'Validation failed', detail, errors);
}

/** `undefined` = omitted (leave unchanged on a patch), `null` = clear, string = a media public id. */
export function readMediaRef(
	body: Record<string, unknown>,
	field: string,
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
	field: string
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

/**
 * Resolves `imageId`/`audioId` media public ids to internal ids and checks that each
 * slot's asset exists and is the right kind — shared by every content type (questions,
 * question groups) that attaches an image and an audio asset the same way.
 */
export async function resolveMediaRefs(
	db: Database,
	imageId: string | null,
	audioId: string | null,
	fieldNames: { image: string; audio: string } = { image: 'imageId', audio: 'audioId' }
): Promise<{ imageMediaId: number | null; audioMediaId: number | null }> {
	const image = await resolveMediaRef(db, imageId, fieldNames.image);
	const audio = await resolveMediaRef(db, audioId, fieldNames.audio);
	const imageMediaId = image.id;
	const audioMediaId = audio.id;

	const slotErrors = await checkMediaSlots(db, { imageMediaId, audioMediaId });
	if (Object.keys(slotErrors).length > 0) {
		fail(
			Object.entries(slotErrors).map(([slot, message]) => ({
				field: slot === 'imageMediaId' ? fieldNames.image : fieldNames.audio,
				message
			}))
		);
	}

	return { imageMediaId, audioMediaId };
}
