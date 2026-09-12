import { describe, expect, it } from 'vitest';

import { safeReturnTo } from '$lib/server/auth/flow';

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

	it.each([
		['/\t/evil.test/phish', 'a tab'],
		['/\n/evil.test/phish', 'a newline'],
		['/\r/evil.test/phish', 'a carriage return'],
		['/\u0000/evil.test/phish', 'a null byte'],
		['/\u007f/evil.test/phish', 'a delete character']
	])('refuses %j, smuggling an origin past a prefix check with %s', (value) => {
		// REGRESSION. The URL parser STRIPS tab, CR and LF rather than rejecting them, so
		// `/<TAB>/evil.test/phish` starts with a single slash, contains no "//" — and a
		// browser resolves it to https://evil.test/phish. It reaches the victim after a
		// genuine, successful Google sign-in, which is the most convincing possible moment
		// to be redirected somewhere else.
		expect(safeReturnTo(value)).toBe('/');
	});

	it('is not fooled by anything that leaves this origin, however it is spelled', () => {
		// The origin check is the one that actually holds: it does not depend on knowing
		// which trick was used.
		for (const value of [
			'/\t\t//evil.test',
			'/\u0009/\u0009/evil.test',
			'/..//evil.test',
			'/\\/evil.test'
		]) {
			const result = safeReturnTo(value);

			expect(new URL(result, 'https://quizgame.ecoapsara.com').origin).toBe(
				'https://quizgame.ecoapsara.com'
			);
		}
	});

	it('normalises what it returns, rather than echoing the input', () => {
		expect(safeReturnTo('/admin/../admin/quizzes')).toBe('/admin/quizzes');
	});

	it.each([null, undefined, ''])('falls back to the homepage for %j', (value) => {
		expect(safeReturnTo(value)).toBe('/');
	});
});
