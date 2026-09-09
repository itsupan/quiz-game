import { count, desc, eq, or } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import { mediaAssets, questionGroups, questions } from '$lib/server/db/schema';
import type { MediaAsset } from '$lib/server/db/schema';
import { describeUpload } from './media';
import { isForeignKeyFailure, type WriteResult } from './questions.server';

/** Everything R2 needs from the platform, so callers pass one object rather than four. */
export type MediaBucket = R2Bucket;

export const PAGE_SIZE = 24;

export async function listMedia(db: Database, page = 1) {
	const items = await db
		.select()
		.from(mediaAssets)
		.orderBy(desc(mediaAssets.createdAt))
		.limit(PAGE_SIZE)
		.offset((Math.max(1, page) - 1) * PAGE_SIZE);

	const [{ total }] = await db.select({ total: count() }).from(mediaAssets);

	return {
		items,
		total,
		page: Math.max(1, page),
		pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE))
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

	await bucket.put(upload.r2Key, file.stream(), {
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
