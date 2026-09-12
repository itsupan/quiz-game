import { apiProblem, assertKnownFields } from '$lib/features/admin/api/http.server';
import type { Database } from '$lib/server/db';
import type { MediaAsset } from '$lib/server/db/schema';
import { ALLOWED_MIME_TYPES } from './media';
import { getAssetByPublicId } from './media.server';

export function toMediaDto(asset: MediaAsset) {
	return {
		id: asset.publicId,
		kind: asset.kind,
		url: `/media/${asset.publicId}`,
		mimeType: asset.mimeType,
		byteSize: asset.byteSize,
		durationMs: asset.durationMs,
		width: asset.width,
		height: asset.height,
		altText: asset.altText,
		transcript: asset.transcript,
		originalFilename: asset.originalFilename,
		createdAt: asset.createdAt.toISOString()
	};
}

/** 404s rather than returning null: every caller of this immediately needs the asset. */
export async function requireMediaByPublicId(db: Database, publicId: string): Promise<MediaAsset> {
	const asset = await getAssetByPublicId(db, publicId);
	if (!asset) {
		apiProblem(404, 'media_not_found', 'Media not found', 'That media file does not exist.');
	}

	return asset;
}

/**
 * The MIME allowlist is a content-type decision, so a rejected type is 415 — distinct
 * from `describeUpload`'s own empty/oversized checks, which run afterwards and are body
 * validation failures (422). Reusing `ALLOWED_MIME_TYPES` here keeps the allowlist itself
 * defined in exactly one place.
 */
export function assertAcceptedMimeType(file: File): void {
	if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
		apiProblem(
			415,
			'unsupported_media_type',
			'Unsupported media type',
			'Upload PNG, JPEG or WebP images, or MP3, M4A or OGG audio.'
		);
	}
}

const UPLOAD_FIELDS = ['file', 'altText', 'transcript'] as const;

export function parseMediaUploadForm(data: FormData): {
	file: File;
	altText: string | null;
	transcript: string | null;
} {
	const unknown = [...data.keys()].find(
		(key) => !(UPLOAD_FIELDS as readonly string[]).includes(key)
	);
	if (unknown) {
		apiProblem(422, 'validation_failed', 'Validation failed', `Unknown field: ${unknown}.`, [
			{ field: unknown, message: 'Unknown field.' }
		]);
	}

	const file = data.get('file');
	if (!(file instanceof File)) {
		apiProblem(422, 'validation_failed', 'Validation failed', 'A file is required.', [
			{ field: 'file', message: 'A file is required.' }
		]);
	}

	const altText = data.get('altText');
	const transcript = data.get('transcript');
	if (altText !== null && typeof altText !== 'string') {
		apiProblem(422, 'validation_failed', 'Validation failed', 'altText must be text.', [
			{ field: 'altText', message: 'altText must be text.' }
		]);
	}
	if (transcript !== null && typeof transcript !== 'string') {
		apiProblem(422, 'validation_failed', 'Validation failed', 'transcript must be text.', [
			{ field: 'transcript', message: 'transcript must be text.' }
		]);
	}

	return {
		file,
		altText: altText ? String(altText).trim() || null : null,
		transcript: transcript ? String(transcript).trim() || null : null
	};
}

/**
 * A description update touches only the field matching the asset's kind — the other slot
 * is meaningless for it, so a request naming it is a validation failure rather than a
 * silently ignored field.
 */
export function parseMediaDescriptionBody(
	asset: Pick<MediaAsset, 'kind' | 'altText' | 'transcript'>,
	body: Record<string, unknown>
): { altText: string | null; transcript: string | null } {
	assertKnownFields(body, ['altText', 'transcript']);

	if (asset.kind === 'IMAGE' && 'transcript' in body) {
		apiProblem(
			422,
			'validation_failed',
			'Validation failed',
			'This is an image; set altText instead.',
			[{ field: 'transcript', message: 'Not applicable to an image.' }]
		);
	}
	if (asset.kind === 'AUDIO' && 'altText' in body) {
		apiProblem(
			422,
			'validation_failed',
			'Validation failed',
			'This is audio; set transcript instead.',
			[{ field: 'altText', message: 'Not applicable to audio.' }]
		);
	}

	const altText = body.altText;
	if (altText !== undefined && altText !== null && typeof altText !== 'string') {
		apiProblem(422, 'validation_failed', 'Validation failed', 'altText must be a string or null.', [
			{ field: 'altText', message: 'Must be a string or null.' }
		]);
	}
	const transcript = body.transcript;
	if (transcript !== undefined && transcript !== null && typeof transcript !== 'string') {
		apiProblem(
			422,
			'validation_failed',
			'Validation failed',
			'transcript must be a string or null.',
			[{ field: 'transcript', message: 'Must be a string or null.' }]
		);
	}

	return {
		altText:
			asset.kind === 'IMAGE'
				? altText === undefined
					? asset.altText
					: (altText as string | null)
				: asset.altText,
		transcript:
			asset.kind === 'AUDIO'
				? transcript === undefined
					? asset.transcript
					: (transcript as string | null)
				: asset.transcript
	};
}
