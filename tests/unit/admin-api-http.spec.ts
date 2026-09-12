import { describe, expect, it } from 'vitest';

import {
	apiEndpoint,
	assertKnownFields,
	assertNoDuplicateParams,
	parsePageNumber,
	requireAdmin
} from '$lib/features/admin/api/http.server';
import type { AuthUser } from '$lib/server/auth/types';

const admin: AuthUser = {
	id: 1,
	publicId: '01JSEEDACCTADMN00000000000',
	email: 'admin@example.com',
	displayName: 'Admin',
	avatarUrl: null,
	role: 'ADMIN',
	status: 'ACTIVE'
};

const learner: AuthUser = {
	id: 2,
	publicId: '01JSEEDACCTSTDNT0000000000',
	email: 'learner@example.com',
	displayName: 'Learner',
	avatarUrl: null,
	role: 'USER',
	status: 'ACTIVE'
};

describe('admin API HTTP boundary', () => {
	it('accepts an active administrator', () => {
		expect(requireAdmin(admin)).toBe(admin);
	});

	it('returns a 401 problem for anonymous requests', async () => {
		const request = new Request('https://quiz.example/api/v1/admin/quizzes');
		const response = await apiEndpoint(request, () => {
			requireAdmin(null);
			return new Response();
		});

		expect(response.status).toBe(401);
		expect(response.headers.get('content-type')).toBe('application/problem+json');
		await expect(response.json()).resolves.toMatchObject({
			code: 'authentication_required',
			status: 401
		});
	});

	it('returns a 403 problem for a learner', async () => {
		const request = new Request('https://quiz.example/api/v1/admin/quizzes');
		const response = await apiEndpoint(request, () => {
			requireAdmin(learner);
			return new Response();
		});

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toMatchObject({ code: 'admin_access_required' });
	});

	it('returns a 403 problem for a suspended administrator object', async () => {
		const request = new Request('https://quiz.example/api/v1/admin/quizzes');
		const response = await apiEndpoint(request, () => {
			requireAdmin({ ...admin, status: 'SUSPENDED' });
			return new Response();
		});

		expect(response.status).toBe(403);
		await expect(response.json()).resolves.toMatchObject({ code: 'admin_access_required' });
	});

	it('rejects an unknown body field', async () => {
		const request = new Request('https://quiz.example/api/v1/admin/quizzes', { method: 'POST' });
		const response = await apiEndpoint(request, () => {
			assertKnownFields({ title: 'x', bogus: 1 }, ['title']);
			return new Response();
		});

		expect(response.status).toBe(422);
		await expect(response.json()).resolves.toMatchObject({
			code: 'validation_failed',
			errors: [{ field: 'bogus' }]
		});
	});

	it('rejects a duplicated query parameter', async () => {
		const params = new URLSearchParams('status=DRAFT&status=PUBLISHED');
		const request = new Request(`https://quiz.example/api/v1/admin/quizzes?${params}`);
		const response = await apiEndpoint(request, () => {
			assertNoDuplicateParams(params, ['status']);
			return new Response();
		});

		expect(response.status).toBe(400);
		await expect(response.json()).resolves.toMatchObject({ code: 'duplicate_query_parameter' });
	});

	it('parses a page number, defaulting to 1', () => {
		expect(parsePageNumber(null)).toBe(1);
		expect(parsePageNumber('3')).toBe(3);
	});

	it('rejects a malformed page number', async () => {
		const request = new Request('https://quiz.example/api/v1/admin/quizzes?page=0');
		const response = await apiEndpoint(request, () => {
			parsePageNumber('0');
			return new Response();
		});

		expect(response.status).toBe(400);
	});
});
