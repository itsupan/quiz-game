import {
	getMediaAssetById,
	updateMediaDescription,
	uploadMedia,
	type MediaBucket
} from '$lib/features/media/media.server';
import type { Database } from '$lib/server/db';
import type { MediaKind } from '$lib/domain/enums';

export type ResolvedQuestionMedia = { imageMediaId: number | null; audioMediaId: number | null };

async function resolveSlot(
	db: Database,
	bucket: MediaBucket,
	actorUserId: number | null,
	kind: MediaKind,
	file: File | null,
	description: string | null,
	remove: boolean,
	currentId: number | null
): Promise<{ ok: true; id: number | null } | { ok: false; message: string }> {
	if (file && file.size > 0) {
		const uploaded = await uploadMedia(db, bucket, actorUserId, file, {
			altText: kind === 'IMAGE' ? description : null,
			transcript: kind === 'AUDIO' ? description : null
		});

		return uploaded.ok ? { ok: true, id: uploaded.value.id } : uploaded;
	}

	if (remove) {
		return { ok: true, id: null };
	}

	// No new file and nothing to remove: keep the existing attachment, but let editing the
	// description field alone (without re-uploading) update the asset in place — otherwise
	// fixing a typo in alt text would force a pointless re-upload of the same image.
	if (currentId !== null) {
		const asset = await getMediaAssetById(db, currentId);
		if (
			asset &&
			description !== null &&
			description !== (kind === 'IMAGE' ? asset.altText : asset.transcript)
		) {
			await updateMediaDescription(db, currentId, {
				altText: kind === 'IMAGE' ? description : asset.altText,
				transcript: kind === 'AUDIO' ? description : asset.transcript
			});
		}
	}

	return { ok: true, id: currentId };
}

/**
 * Resolves the question form's image/audio fields into final media ids, uploading any new
 * file straight to R2 as part of the same submission. This is deliberately the only way
 * the interactive dashboard attaches media to a question — there is no "pick an existing
 * file" list here, because an admin authoring a question already has the file in hand and
 * a second trip through the Media Library just to find its id again is friction with no
 * payoff. (CSV import is the one place an id is still typed by hand, because a spreadsheet
 * cannot carry a file at all.)
 */
export async function resolveQuestionMedia(
	db: Database,
	bucket: MediaBucket,
	actorUserId: number | null,
	data: FormData,
	current: ResolvedQuestionMedia
): Promise<
	{ ok: true; value: ResolvedQuestionMedia } | { ok: false; errors: Record<string, string> }
> {
	const imageFile = data.get('imageFile');
	const audioFile = data.get('audioFile');
	const imageAltText = String(data.get('imageAltText') ?? '').trim() || null;
	const audioTranscript = String(data.get('audioTranscript') ?? '').trim() || null;
	const removeImage = data.get('removeImage') === 'on';
	const removeAudio = data.get('removeAudio') === 'on';

	const image = await resolveSlot(
		db,
		bucket,
		actorUserId,
		'IMAGE',
		imageFile instanceof File ? imageFile : null,
		imageAltText,
		removeImage,
		current.imageMediaId
	);
	const audio = await resolveSlot(
		db,
		bucket,
		actorUserId,
		'AUDIO',
		audioFile instanceof File ? audioFile : null,
		audioTranscript,
		removeAudio,
		current.audioMediaId
	);

	const errors: Record<string, string> = {};
	if (!image.ok) errors.imageFile = image.message;
	if (!audio.ok) errors.audioFile = audio.message;

	if (Object.keys(errors).length > 0) {
		return { ok: false, errors };
	}

	return {
		ok: true,
		value: {
			imageMediaId: (image as { ok: true; id: number | null }).id,
			audioMediaId: (audio as { ok: true; id: number | null }).id
		}
	};
}
