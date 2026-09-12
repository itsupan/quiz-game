import { error } from '@sveltejs/kit';

import { getAssetByPublicId } from '$lib/features/media/media.server';
import type { RequestHandler } from './$types';

/**
 * `bucket.get()` accepts a live `Headers` object for `onlyIf`/`range`, and it works
 * against a real deployed Worker. Under `vite dev`, though, that call crosses an RPC
 * boundary into a sandboxed runtime that serializes every argument with `devalue`,
 * which throws on anything that is not a plain object — a `Headers` instance included.
 * Converting to plain `R2Conditional`/`R2Range` objects up front sidesteps that boundary
 * entirely, in dev and in production alike.
 */
function toR2Conditional(headers: Headers): R2Conditional {
	const ifModifiedSince = headers.get('if-modified-since');
	const ifUnmodifiedSince = headers.get('if-unmodified-since');

	return {
		etagMatches: headers.get('if-match') ?? undefined,
		etagDoesNotMatch: headers.get('if-none-match') ?? undefined,
		uploadedAfter: ifModifiedSince ? new Date(ifModifiedSince) : undefined,
		uploadedBefore: ifUnmodifiedSince ? new Date(ifUnmodifiedSince) : undefined
	};
}

/** Only the two forms an `<audio>` element's own range requests ever take. */
function toR2Range(headers: Headers): R2Range | undefined {
	const match = /^bytes=(\d*)-(\d*)$/.exec(headers.get('range') ?? '');
	if (!match) return undefined;

	const [, startText, endText] = match;

	if (startText === '') {
		const suffix = Number(endText);
		return Number.isFinite(suffix) ? { suffix } : undefined;
	}

	const offset = Number(startText);
	if (!Number.isFinite(offset)) return undefined;
	if (endText === '') return { offset };

	const end = Number(endText);
	return Number.isFinite(end) ? { offset, length: end - offset + 1 } : { offset };
}

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
		onlyIf: toR2Conditional(request.headers),
		range: wantsRange ? toR2Range(request.headers) : undefined
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
