import { describe, expect, it } from 'vitest';

import { safeReturnTo } from './flow';

describe('safeReturnTo', () => {
	it.each(['/admin', '/admin/quizzes?status=DRAFT', '/quiz/01ABC#top', '/'])(
		'keeps the same-site path %j',
		(path) => {
			expect(safeReturnTo(path)).toBe(path);
		}
	);

	it.each([
		['https://evil.test/phish', 'an absolute URL'],
		['//evil.test/phish', 'a protocol-relative URL'],
		['/\\evil.test', 'a backslash some parsers read as a slash'],
		['javascript:alert(1)', 'a script URL'],
		['admin', 'a path with no leading slash']
	])('refuses %j — %s', (value) => {
		// An open redirect turns the sign-in link into a convincing way to bounce someone
		// to a phishing page that looks like it came from here.
		expect(safeReturnTo(value)).toBe('/');
	});

	it('refuses a value carrying a newline, which would inject a header', () => {
		expect(safeReturnTo('/admin\r\nSet-Cookie: session=stolen')).toBe('/');
	});

	it.each([null, undefined, ''])('falls back to the homepage for %j', (value) => {
		expect(safeReturnTo(value)).toBe('/');
	});
});
