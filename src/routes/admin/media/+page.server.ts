import { error, fail } from '@sveltejs/kit';
import { eq } from 'drizzle-orm';

import { recordAudit } from '$lib/features/admin/audit.server';
import {
	deleteMedia,
	listMedia,
	updateMediaDescription,
	uploadMedia
} from '$lib/features/admin/media.server';
import { mediaAssets } from '$lib/server/db/schema';
import type { Actions, PageServerLoad } from './$types';

/** The R2 binding, or a clear failure. Missing bindings are silent in named envs. */
function bucket(platform: App.Platform | undefined) {
	const media = platform?.env?.MEDIA;

	if (!media) {
		error(
			500,
			'The R2 binding `MEDIA` is unavailable. Check the r2_buckets entry in wrangler.jsonc — bindings are not inherited by named environments.'
		);
	}

	return media;
}

const optional = (data: FormData, field: string) => {
	const value = String(data.get(field) ?? '').trim();

	return value === '' ? null : value;
};

export const load: PageServerLoad = async ({ locals, url }) => {
	return await listMedia(locals.db, Number(url.searchParams.get('page')) || 1);
};

export const actions: Actions = {
	upload: async ({ locals, platform, request }) => {
		const data = await request.formData();
		const file = data.get('file');

		if (!(file instanceof File)) {
			return fail(400, { message: 'Choose a file to upload.' });
		}

		const uploaded = await uploadMedia(locals.db, bucket(platform), locals.user?.id ?? null, file, {
			altText: optional(data, 'altText'),
			transcript: optional(data, 'transcript')
		});

		if (!uploaded.ok) {
			return fail(400, { message: uploaded.message });
		}

		return {
			ok: true,
			message: `Uploaded ${uploaded.value.originalFilename ?? uploaded.value.r2Key}.`
		};
	},

	/**
	 * Alt text and transcripts are edited here rather than on the question, because they
	 * describe the file and are reused everywhere it is attached. Describing an asset
	 * once unblocks publication for every question using it.
	 */
	describe: async ({ locals, request }) => {
		const data = await request.formData();
		const [asset] = await locals.db
			.select()
			.from(mediaAssets)
			.where(eq(mediaAssets.id, Number(data.get('assetId'))));

		if (!asset) {
			return fail(404, { message: 'That file no longer exists.' });
		}

		await updateMediaDescription(locals.db, asset.id, {
			altText: asset.kind === 'IMAGE' ? optional(data, 'altText') : asset.altText,
			transcript: asset.kind === 'AUDIO' ? optional(data, 'transcript') : asset.transcript
		});

		return { ok: true, message: 'Description saved.' };
	},

	/** The one genuine delete in the dashboard. Everything else is archived. */
	delete: async ({ locals, platform, request }) => {
		const data = await request.formData();
		const [asset] = await locals.db
			.select()
			.from(mediaAssets)
			.where(eq(mediaAssets.id, Number(data.get('assetId'))));

		if (!asset) {
			return fail(404, { message: 'That file no longer exists.' });
		}

		const removed = await deleteMedia(locals.db, bucket(platform), asset);

		if (!removed.ok) {
			return fail(409, { message: removed.message });
		}

		await recordAudit(locals.db, {
			actorUserId: locals.user?.id ?? null,
			action: 'MEDIA_DELETED',
			entityType: 'media_asset',
			entityId: asset.id,
			before: { r2Key: asset.r2Key, originalFilename: asset.originalFilename, kind: asset.kind }
		});

		return { ok: true, message: 'File deleted.' };
	}
};
