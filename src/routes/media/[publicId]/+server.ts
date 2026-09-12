import { error } from '@sveltejs/kit';

import { getAssetByPublicId } from '$lib/features/admin/media/media.server';
import type { RequestHandler } from './$types';

/**
 * Serves an uploaded file from R2.
 *
 * Public, because a learner taking a listening exam has to be able to load the audio,
 * but addressed by a 26-character unguessable id rather than anything enumerable. The
 * bucket itself stays private and no bucket URL is ever persisted or exposed — every
 * byte goes through this route.
 *
 * The object key is content-addressed and never rewritten, so the response is
 * immutable and can be cached for a year. That matters more than it sounds: an N3
 * listening section is a handful of multi-megabyte files fetched by every candidate.
 */
export const GET: RequestHandler = async ({ locals, params, platform, request, setHeaders }) => {
	const asset = await getAssetByPublicId(locals.db, params.publicId);

	if (!asset) {
		error(404, 'Not found');
	}

	const bucket = platform?.env?.MEDIA;

	if (!bucket) {
		error(500, 'The R2 binding `MEDIA` is unavailable.');
	}

	const wantsRange = request.headers.has('range');

	// `onlyIf` lets the browser skip the body entirely on a repeat visit; `range` is what
	// makes a listening clip seekable. Safari and iOS will not play an <audio> element at
	// all unless the server answers a range request with a 206, so without this the
	// multi-megabyte JLPT audio this route exists to serve simply does not play.
	const object = await bucket.get(asset.r2Key, {
		onlyIf: request.headers,
		range: wantsRange ? request.headers : undefined
	});

	if (!object) {
		// The row exists but the bytes do not: a delete that only half happened.
		error(404, 'Not found');
	}

	setHeaders({
		'content-type': asset.mimeType,
		'cache-control': 'public, max-age=31536000, immutable',
		// Without this a browser will not attempt a range request in the first place.
		'accept-ranges': 'bytes',
		etag: object.httpEtag
	});

	if (!('body' in object) || !object.body) {
		// A precondition matched, so R2 returned metadata only.
		return new Response(null, { status: 304 });
	}

	if (wantsRange && object.range) {
		const start = 'offset' in object.range ? (object.range.offset ?? 0) : 0;
		const length =
			'length' in object.range && object.range.length !== undefined
				? object.range.length
				: object.size - start;
		const end = start + length - 1;

		return new Response(object.body, {
			status: 206,
			headers: {
				'content-length': String(length),
				'content-range': `bytes ${start}-${end}/${object.size}`
			}
		});
	}

	return new Response(object.body, {
		headers: { 'content-length': String(object.size) }
	});
};
