import { describe, expect, it } from 'vitest';

import { MAX_BYTES, describeUpload } from '$lib/features/admin/media/media';

/** A stand-in for the File a multipart form yields, with only what the code reads. */
const file = (name: string, type: string, size = 1024) => ({ name, type, size }) as unknown as File;

describe('describeUpload', () => {
	it.each([
		['image/png', 'IMAGE', 'png'],
		['image/jpeg', 'IMAGE', 'jpg'],
		['image/webp', 'IMAGE', 'webp'],
		['audio/mpeg', 'AUDIO', 'mp3'],
		['audio/mp4', 'AUDIO', 'm4a'],
		['audio/ogg', 'AUDIO', 'ogg']
	])('accepts %s as %s with the .%s extension', (type, kind, extension) => {
		const result = describeUpload(file('clip', type));

		expect(result).toMatchObject({ ok: true, value: { kind, extension } });
	});

	it.each(['application/pdf', 'text/html', 'image/svg+xml', 'video/mp4', ''])(
		'rejects %s',
		(type) => {
			// image/svg+xml is refused on purpose: an SVG is a script host, and these files
			// are served from the same origin as the app.
			const result = describeUpload(file('payload', type));

			expect(result.ok ? null : result.message).toMatch(/file type/i);
		}
	);

	it('rejects an empty file', () => {
		const result = describeUpload(file('empty.png', 'image/png', 0));

		expect(result.ok ? null : result.message).toMatch(/empty/i);
	});

	it('rejects an image over the size cap', () => {
		const result = describeUpload(file('huge.png', 'image/png', MAX_BYTES.IMAGE + 1));

		expect(result.ok ? null : result.message).toMatch(/too large/i);
	});

	it('allows audio far larger than the image cap, since a listening clip runs minutes', () => {
		expect(MAX_BYTES.AUDIO).toBeGreaterThan(MAX_BYTES.IMAGE);
		expect(describeUpload(file('n3.mp3', 'audio/mpeg', MAX_BYTES.IMAGE + 1)).ok).toBe(true);
	});

	it('derives the extension from the MIME type, never from the filename', () => {
		// A filename is caller-controlled text, and a double extension is the classic way
		// to get one thing stored under the name of another.
		const result = describeUpload(file('sound.mp3.html', 'image/png'));

		expect(result.ok && result.value.extension).toBe('png');
	});

	it.each(['../../etc/passwd', 'a/b/c.png', 'spaced name.png', ''])(
		'builds a key from a fresh id, ignoring the filename "%s"',
		(name) => {
			const result = describeUpload(file(name, 'image/png'));

			// 26 Crockford characters, a dot, then the extension. Nothing of the filename
			// reaches the key, so no upload can traverse out of the bucket prefix or
			// overwrite an object that is already there.
			expect(result.ok && result.value.r2Key).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}\.png$/);
		}
	);

	it('gives two uploads of the same file different keys', () => {
		const first = describeUpload(file('same.png', 'image/png'));
		const second = describeUpload(file('same.png', 'image/png'));

		expect(first.ok && second.ok && first.value.r2Key).not.toBe(second.ok && second.value.r2Key);
	});

	it('keeps the original filename for display', () => {
		const result = describeUpload(file('聴解問題-1.mp3', 'audio/mpeg'));

		expect(result.ok && result.value.originalFilename).toBe('聴解問題-1.mp3');
	});
});
