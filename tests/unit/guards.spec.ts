import { describe, expect, it } from 'vitest';

import { assertAdmin } from '$lib/server/auth/guards';
import type { AuthUser } from '$lib/server/auth/user';

const user = (overrides: Partial<AuthUser> = {}): AuthUser => ({
	id: 1,
	publicId: '01JSEEDACCTADMN00000000000',
	email: 'admin@example.com',
	displayName: '管理者テスト',
	avatarUrl: null,
	role: 'ADMIN',
	status: 'ACTIVE',
	...overrides
});

/** SvelteKit's `error()` throws an object carrying the status it was given. */
function statusOf(run: () => void): number {
	try {
		run();
	} catch (thrown) {
		return (thrown as { status: number }).status;
	}

	throw new Error('expected assertAdmin to throw, but it returned');
}

describe('assertAdmin', () => {
	it('rejects a signed-out visitor as unauthenticated, not forbidden', () => {
		// 401 tells the caller signing in might help; 403 says it would not.
		expect(statusOf(() => assertAdmin(null))).toBe(401);
	});

	it('rejects a signed-in learner', () => {
		expect(statusOf(() => assertAdmin(user({ role: 'USER' })))).toBe(403);
	});

	it('rejects a suspended administrator', () => {
		// Suspension has to bite here: the role column still says ADMIN.
		expect(statusOf(() => assertAdmin(user({ status: 'SUSPENDED' })))).toBe(403);
	});

	it('admits an active administrator', () => {
		expect(() => assertAdmin(user())).not.toThrow();
	});
});
