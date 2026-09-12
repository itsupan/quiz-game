import { asc } from 'drizzle-orm';

import type { Database } from '$lib/server/db';
import { mediaAssets } from '$lib/server/db/schema';
import type { MediaChoice } from './QuestionForm.svelte';

/**
 * The media pickers on the question form.
 *
 * A description-less asset is labelled as such, so an administrator can see before
 * attaching it that publishing will be blocked until it has alt text or a transcript.
 */
export async function listMediaChoices(db: Database): Promise<MediaChoice[]> {
	const assets = await db
		.select({
			id: mediaAssets.id,
			kind: mediaAssets.kind,
			originalFilename: mediaAssets.originalFilename,
			r2Key: mediaAssets.r2Key,
			altText: mediaAssets.altText,
			transcript: mediaAssets.transcript
		})
		.from(mediaAssets)
		.orderBy(asc(mediaAssets.originalFilename));

	return assets.map((asset) => {
		const described = asset.kind === 'IMAGE' ? asset.altText : asset.transcript;
		const name = asset.originalFilename ?? asset.r2Key;

		return {
			id: asset.id,
			kind: asset.kind,
			label: described?.trim() ? name : `${name} — not yet described`
		};
	});
}
