import { newPublicId } from '$lib/server/db/ids';
import type { MediaKind } from '$lib/server/db/schema/enums';

/**
 * What an uploaded file is allowed to be, and what it becomes in R2.
 *
 * Pure and dependency-free so every rule below is unit-tested without a bucket.
 */

/**
 * MIME type -> kind and canonical extension.
 *
 * An allowlist, not a blocklist. Notably absent: `image/svg+xml`. An SVG can carry
 * script, and these files are served from the app's own origin, so allowing one would
 * hand any administrator a stored-XSS primitive against every learner.
 */
const ALLOWED = {
	'image/png': { kind: 'IMAGE', extension: 'png' },
	'image/jpeg': { kind: 'IMAGE', extension: 'jpg' },
	'image/webp': { kind: 'IMAGE', extension: 'webp' },
	'audio/mpeg': { kind: 'AUDIO', extension: 'mp3' },
	'audio/mp4': { kind: 'AUDIO', extension: 'm4a' },
	'audio/ogg': { kind: 'AUDIO', extension: 'ogg' }
} as const satisfies Record<string, { kind: MediaKind; extension: string }>;

export const ALLOWED_MIME_TYPES = Object.keys(ALLOWED) as (keyof typeof ALLOWED)[];

/** A JLPT listening section runs to several minutes, so audio gets far more room. */
export const MAX_BYTES = {
	IMAGE: 10 * 1024 * 1024,
	AUDIO: 50 * 1024 * 1024
} as const satisfies Record<MediaKind, number>;

export type UploadDescription = {
	kind: MediaKind;
	mimeType: string;
	extension: string;
	/** Derived from a fresh ULID. Never from the uploaded filename. */
	r2Key: string;
	originalFilename: string | null;
	byteSize: number;
};

export type UploadCheck = { ok: true; value: UploadDescription } | { ok: false; message: string };

const megabytes = (bytes: number) => Math.round(bytes / (1024 * 1024));

export function describeUpload(file: File): UploadCheck {
	const allowed = ALLOWED[file.type as keyof typeof ALLOWED];

	if (!allowed) {
		return {
			ok: false,
			message:
				'That file type is not accepted. Upload PNG, JPEG or WebP images, or MP3, M4A or OGG audio.'
		};
	}

	if (file.size === 0) {
		return { ok: false, message: 'That file is empty.' };
	}

	const cap = MAX_BYTES[allowed.kind];

	if (file.size > cap) {
		return {
			ok: false,
			message: `That file is too large. The limit for ${allowed.kind.toLowerCase()} is ${megabytes(cap)} MB.`
		};
	}

	return {
		ok: true,
		value: {
			kind: allowed.kind,
			mimeType: file.type,
			extension: allowed.extension,
			// The filename is attacker-controlled text. Building the key from it would let
			// an upload traverse out of the prefix or overwrite an existing object, so the
			// key is a fresh unguessable id and the extension comes from the MIME type.
			r2Key: `${newPublicId()}.${allowed.extension}`,
			originalFilename: file.name === '' ? null : file.name.slice(0, 255),
			byteSize: file.size
		}
	};
}
