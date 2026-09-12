import { error } from '@sveltejs/kit';
import { count, desc, eq, or } from 'drizzle-orm';

import type { MediaKind } from '$lib/domain/enums';
import type { Database } from '$lib/server/db';
import { isForeignKeyFailure } from '$lib/server/db/errors';
import { mediaAssets, questionGroups, questions, users } from '$lib/server/db/schema';
import type { MediaAsset } from '$lib/server/db/schema';
import { describeUpload } from './media';
import type { WriteResult } from '$lib/domain/write-result';

/** Everything R2 needs from the platform, so callers pass one object rather than four. */
export type MediaBucket = R2Bucket;

/** The R2 binding, or a clear failure. Missing bindings are silent in named envs. */
export function requireMediaBucket(platform: App.Platform | undefined): MediaBucket {
	const media = platform?.env?.MEDIA;

	if (!media) {
		error(
			500,
			'The R2 binding `MEDIA` is unavailable. Check the r2_buckets entry in wrangler.jsonc — bindings are not inherited by named environments.'
		);
	}

	return media;
}

export const PAGE_SIZE = 24;

export type MediaFilters = {
	page?: number;
	kind?: MediaKind;
	/** Defaults to `PAGE_SIZE`. The admin dashboard never overrides this; the JSON API does. */
	limit?: number;
};

export async function listMedia(db: Database, filters: MediaFilters = {}) {
	const page = Math.max(1, filters.page ?? 1);
	const limit = filters.limit ?? PAGE_SIZE;
	const where = filters.kind ? eq(mediaAssets.kind, filters.kind) : undefined;

	const items = await db
		.select()
		.from(mediaAssets)
		.where(where)
		.orderBy(desc(mediaAssets.createdAt))
		.limit(limit)
		.offset((page - 1) * limit);

	const [{ total }] = await db.select({ total: count() }).from(mediaAssets).where(where);

	return {
		items,
		total,
		page,
		pageCount: Math.max(1, Math.ceil(total / limit))
	};
}

/**
 * Stores the bytes in R2 and the metadata in D1.
 *
 * R2 first: a bucket object with no row is invisible clutter, but a row pointing at
 * bytes that were never written is a broken image on a learner's exam. If the D1 insert
 * fails, the orphaned object is deleted on the way out.
 */
export async function uploadMedia(
	db: Database,
	bucket: MediaBucket,
	actorUserId: number | null,
	file: File,
	description: { altText: string | null; transcript: string | null }
): Promise<WriteResult<MediaAsset>> {
	const checked = describeUpload(file);

	if (!checked.ok) {
		return checked;
	}

	const upload = checked.value;

	// `file` directly, not `file.stream()`: a `File` is also a `Blob`, with a known byte
	// length R2 can use up front. The raw stream has none under Miniflare's dev runtime,
	// which then refuses the write with "must have a known length" — a real Worker never
	// hits this, but there's no reason to feed it an unsized stream either way.
	await bucket.put(upload.r2Key, file, {
		httpMetadata: { contentType: upload.mimeType }
	});

	try {
		const [created] = await db
			.insert(mediaAssets)
			.values({
				kind: upload.kind,
				r2Key: upload.r2Key,
				mimeType: upload.mimeType,
				byteSize: upload.byteSize,
				originalFilename: upload.originalFilename,
				// Alt text belongs to images and transcripts to audio; storing the other
				// way round would satisfy the publish check without helping anyone.
				altText: upload.kind === 'IMAGE' ? description.altText : null,
				transcript: upload.kind === 'AUDIO' ? description.transcript : null,
				uploadedBy: actorUserId
			})
			.returning();

		return { ok: true, value: created };
	} catch (cause) {
		await bucket.delete(upload.r2Key);

		throw cause;
	}
}

export async function updateMediaDescription(
	db: Database,
	assetId: number,
	description: { altText: string | null; transcript: string | null }
): Promise<void> {
	await db
		.update(mediaAssets)
		.set({ altText: description.altText, transcript: description.transcript })
		.where(eq(mediaAssets.id, assetId));
}

export async function getMediaAssetById(db: Database, assetId: number) {
	const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.id, assetId));

	return asset ?? null;
}

/**
 * Permanently removes an asset. The one genuine delete in the dashboard — everything
 * else is archived, because attempts reference it.
 *
 * D1 first, R2 second. `questions` and `question_groups` reference media with
 * ON DELETE RESTRICT, so a row still in use refuses to go and the bytes stay put. The
 * reverse order would delete the bytes, hit the constraint, and leave a row pointing at
 * nothing.
 */
export async function deleteMedia(
	db: Database,
	bucket: MediaBucket,
	asset: Pick<MediaAsset, 'id' | 'r2Key'>
): Promise<WriteResult<void>> {
	const [{ usedByQuestions }] = await db
		.select({ usedByQuestions: count() })
		.from(questions)
		.where(or(eq(questions.imageMediaId, asset.id), eq(questions.audioMediaId, asset.id)));

	const [{ usedByGroups }] = await db
		.select({ usedByGroups: count() })
		.from(questionGroups)
		.where(
			or(eq(questionGroups.imageMediaId, asset.id), eq(questionGroups.audioMediaId, asset.id))
		);

	const inUse = usedByQuestions + usedByGroups;

	if (inUse > 0) {
		return {
			ok: false,
			message: `This file is used by ${inUse} question${inUse === 1 ? '' : 's'} or passage${inUse === 1 ? '' : 's'}. Detach it there first.`
		};
	}

	try {
		await db.delete(mediaAssets).where(eq(mediaAssets.id, asset.id));
	} catch (cause) {
		if (isForeignKeyFailure(cause)) {
			return { ok: false, message: 'This file is still referenced and cannot be deleted.' };
		}

		throw cause;
	}

	await bucket.delete(asset.r2Key);

	return { ok: true, value: undefined };
}

/** Looks an asset up for the public serving route. */
export async function getAssetByPublicId(db: Database, publicId: string) {
	const [asset] = await db.select().from(mediaAssets).where(eq(mediaAssets.publicId, publicId));

	return asset ?? null;
}

/** The prefix `updateAvatar` writes and reads back to tell "one of ours" from a Google URL. */
const AVATAR_PATH_PREFIX = '/media/';

/**
 * A learner's self-uploaded profile photo.
 *
 * Reuses the exact same storage `uploadMedia` gives question images — an avatar is just
 * an `IMAGE` asset nobody attaches to a question. Restricted to image MIME types here,
 * ahead of `uploadMedia`, so an audio file never reaches R2 only to be rejected after.
 *
 * The previous avatar, if this account had uploaded one before, is deleted once the new
 * one is live — `deleteMedia`'s own in-use check is a no-op here since an avatar is never
 * attached to a question, so this never refuses.
 */
export async function updateAvatar(
	db: Database,
	bucket: MediaBucket,
	user: { id: number; avatarUrl: string | null },
	file: File
): Promise<WriteResult<MediaAsset>> {
	if (!file.type.startsWith('image/')) {
		return { ok: false, message: 'Please upload an image file (PNG, JPEG or WebP).' };
	}

	const uploaded = await uploadMedia(db, bucket, user.id, file, {
		altText: 'Profile photo',
		transcript: null
	});

	if (!uploaded.ok) {
		return uploaded;
	}

	await db
		.update(users)
		.set({ avatarUrl: `${AVATAR_PATH_PREFIX}${uploaded.value.publicId}` })
		.where(eq(users.id, user.id));

	if (user.avatarUrl?.startsWith(AVATAR_PATH_PREFIX)) {
		const oldPublicId = user.avatarUrl.slice(AVATAR_PATH_PREFIX.length);
		const old = await getAssetByPublicId(db, oldPublicId);

		if (old) {
			await deleteMedia(db, bucket, old);
		}
	}

	return uploaded;
}
