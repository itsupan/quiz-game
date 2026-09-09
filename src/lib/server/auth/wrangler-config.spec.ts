import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

/**
 * Strips comments from JSONC without touching comment-like text inside strings.
 *
 * wrangler.jsonc is heavily commented and no JSONC parser is installed. If this ever
 * gets it wrong, `JSON.parse` below throws and the test fails loudly rather than
 * quietly asserting against a mangled object.
 */
function stripJsonComments(source: string): string {
	let output = '';
	let inString = false;
	let inLine = false;
	let inBlock = false;

	for (let i = 0; i < source.length; i++) {
		const char = source[i];
		const next = source[i + 1];

		if (inLine) {
			if (char === '\n') {
				inLine = false;
				output += char;
			}
			continue;
		}

		if (inBlock) {
			if (char === '*' && next === '/') {
				inBlock = false;
				i++;
			}
			continue;
		}

		if (inString) {
			output += char;
			if (char === '\\') {
				output += next;
				i++;
			} else if (char === '"') {
				inString = false;
			}
			continue;
		}

		if (char === '"') {
			inString = true;
			output += char;
		} else if (char === '/' && next === '/') {
			inLine = true;
			i++;
		} else if (char === '/' && next === '*') {
			inBlock = true;
			i++;
		} else {
			output += char;
		}
	}

	return output;
}

type WranglerEnv = {
	vars?: Record<string, unknown>;
	r2_buckets?: { binding: string; bucket_name: string }[];
	d1_databases?: { binding: string }[];
};

type WranglerConfig = WranglerEnv & { env: Record<string, WranglerEnv> };

const config: WranglerConfig = JSON.parse(
	stripJsonComments(readFileSync('wrangler.jsonc', 'utf8'))
);

const DEPLOYED = ['staging', 'production'] as const;

describe('wrangler.jsonc', () => {
	it.each(DEPLOYED)('leaves the dev identity stub disabled in %s', (name) => {
		// The admin dashboard has no real sign-in yet, so ALLOW_DEV_AUTH is the ONLY
		// thing keeping /admin shut on a deployed worker. Named environments do not
		// inherit vars, so absence here is the whole mechanism — see
		// src/lib/server/auth/user.ts. Adding it to either block opens the dashboard to
		// the public internet.
		expect(config.env[name].vars?.ALLOW_DEV_AUTH).toBeUndefined();
	});

	it('enables the dev identity stub for local development', () => {
		// If this ever goes missing, every admin route 401s locally and the E2E suite
		// fails in a way that looks like a routing bug.
		expect(config.vars?.ALLOW_DEV_AUTH).toBeDefined();
	});

	it.each(['top level', ...DEPLOYED])('binds the MEDIA bucket in %s', (name) => {
		// Bindings are not inherited either, so a bucket added only at the top level is
		// silently missing in deploys and every media upload fails there.
		const env = name === 'top level' ? config : config.env[name];
		const bindings = (env.r2_buckets ?? []).map((bucket) => bucket.binding);

		expect(bindings).toContain('MEDIA');
	});

	it('gives every environment its own bucket', () => {
		const names = [config, ...DEPLOYED.map((name) => config.env[name])].map(
			(env) => env.r2_buckets?.[0]?.bucket_name
		);

		expect(new Set(names).size).toBe(names.length);
	});
});
