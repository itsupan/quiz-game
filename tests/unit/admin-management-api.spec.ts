import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { listAuditLogs, recordAudit } from '$lib/features/admin/audit.server';
import { createProvisionedUser, listUsers } from '$lib/features/admin/users/users.server';
import type { AuthUser } from '$lib/server/auth/types';
import { createTestDatabase, type TestDatabase } from '$lib/server/db/test-harness';
import { quizzes, users } from '$lib/server/db/schema';
import { GET as getAuditLogs } from '../../src/routes/api/v1/admin/audit-logs/+server';
import { GET as getOverview } from '../../src/routes/api/v1/admin/overview/+server';
import { GET as getUsers, POST as createUser } from '../../src/routes/api/v1/admin/users/+server';
import { PATCH as updateUser } from '../../src/routes/api/v1/admin/users/[userId]/+server';

let db: TestDatabase;
let close: () => void;
let admin: AuthUser;

function event(request: Request, extras: Record<string, unknown> = {}) {
	return {
		locals: { db, user: admin },
		request,
		url: new URL(request.url),
		...extras
	} as never;
}

beforeEach(async () => {
	const harness = createTestDatabase();
	db = harness.db;
	close = harness.close;

	const [created] = await db
		.insert(users)
		.values({ email: 'admin@example.com', displayName: 'Admin', role: 'ADMIN' })
		.returning();
	admin = {
		id: created.id,
		publicId: created.publicId,
		email: created.email,
		displayName: created.displayName,
		avatarUrl: created.avatarUrl,
		role: created.role,
		status: created.status
	};
});

afterEach(() => close());

describe('admin users API', () => {
	it('lists users by level and searches by public id', async () => {
		const first = await createProvisionedUser(db, {
			email: 'n4@example.com',
			displayName: 'N4 Learner',
			jlptLevel: 'N4'
		});
		await createProvisionedUser(db, {
			email: 'n3@example.com',
			displayName: 'N3 Learner',
			jlptLevel: 'N3'
		});
		expect(first.ok).toBe(true);
		if (!first.ok) return;

		const byLevel = await listUsers(db, { level: 'N4' });
		expect(byLevel.items.map((user) => user.email)).toEqual(['n4@example.com']);

		const request = new Request(
			`https://quiz.example/api/v1/admin/users?search=${first.value.publicId}&level=N4`
		);
		const response = await getUsers(event(request));
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			data: [{ id: first.value.publicId, jlptLevel: 'N4', role: 'USER' }],
			page: { total: 1 }
		});
	});

	it('pre-provisions and updates a learner without creating a password', async () => {
		const createRequest = new Request('https://quiz.example/api/v1/admin/users', {
			method: 'POST',
			headers: { 'content-type': 'application/json', origin: 'https://quiz.example' },
			body: JSON.stringify({
				email: 'New.Learner@example.com',
				displayName: 'New Learner',
				jlptLevel: 'N5'
			})
		});
		const createdResponse = await createUser(event(createRequest));
		const createdBody = (await createdResponse.json()) as { data: { id: string } };

		expect(createdResponse.status).toBe(201);
		expect(createdBody.data.id).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);

		const patchRequest = new Request(
			`https://quiz.example/api/v1/admin/users/${createdBody.data.id}`,
			{
				method: 'PATCH',
				headers: { 'content-type': 'application/json', origin: 'https://quiz.example' },
				body: JSON.stringify({ jlptLevel: 'N4', status: 'SUSPENDED' })
			}
		);
		const updatedResponse = await updateUser(
			event(patchRequest, { params: { userId: createdBody.data.id } })
		);
		expect(updatedResponse.status).toBe(200);
		await expect(updatedResponse.json()).resolves.toMatchObject({
			data: {
				email: 'new.learner@example.com',
				jlptLevel: 'N4',
				status: 'SUSPENDED'
			}
		});

		const allUsers = await db.select().from(users);
		expect(allUsers.find((user) => user.publicId === createdBody.data.id)?.passwordHash).toBeNull();
	});

	it('rejects an invalid level and a duplicate email', async () => {
		const invalidRequest = new Request('https://quiz.example/api/v1/admin/users', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				email: 'learner@example.com',
				displayName: 'Learner',
				jlptLevel: 'N6'
			})
		});
		const invalidResponse = await createUser(event(invalidRequest));
		expect(invalidResponse.status).toBe(422);

		await createProvisionedUser(db, {
			email: 'learner@example.com',
			displayName: 'Learner',
			jlptLevel: null
		});
		const duplicateRequest = new Request('https://quiz.example/api/v1/admin/users', {
			method: 'POST',
			headers: { 'content-type': 'application/json' },
			body: JSON.stringify({
				email: 'LEARNER@example.com',
				displayName: 'Other Learner'
			})
		});
		const duplicateResponse = await createUser(event(duplicateRequest));
		expect(duplicateResponse.status).toBe(409);
	});
});

describe('admin overview and audit APIs', () => {
	it('returns UI-ready totals, health, and labelled recent activity', async () => {
		await createProvisionedUser(db, {
			email: 'learner@example.com',
			displayName: 'Learner',
			jlptLevel: 'N3'
		});
		const [quiz] = await db
			.insert(quizzes)
			.values({
				title: 'Published quiz',
				mode: 'JLPT_PRACTICE',
				level: 'N3',
				status: 'PUBLISHED'
			})
			.returning();
		await recordAudit(db, {
			actorUserId: admin.id,
			action: 'QUIZ_PUBLISHED',
			entityType: 'quiz',
			entityId: quiz.id,
			after: { status: 'PUBLISHED' }
		});

		const request = new Request('https://quiz.example/api/v1/admin/overview');
		const response = await getOverview(event(request));

		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			data: {
				students: { total: 1 },
				quizzes: { active: 1 },
				recentActivity: [
					{
						action: 'QUIZ_PUBLISHED',
						actor: { displayName: 'Admin' },
						entity: { type: 'quiz', label: 'Published quiz' }
					}
				],
				health: { status: 'OPERATIONAL', database: 'CONNECTED' }
			}
		});
	});

	it('paginates and filters audit records with before/after details', async () => {
		const learner = await createProvisionedUser(db, {
			email: 'learner@example.com',
			displayName: 'Learner',
			jlptLevel: 'N3'
		});
		expect(learner.ok).toBe(true);
		if (!learner.ok) return;

		await recordAudit(db, {
			actorUserId: admin.id,
			action: 'USER_STATUS_CHANGED',
			entityType: 'user',
			entityId: learner.value.id,
			before: { status: 'ACTIVE' },
			after: { status: 'SUSPENDED' }
		});

		const listed = await listAuditLogs(db, { action: 'USER_STATUS_CHANGED' });
		expect(listed.items[0]).toMatchObject({
			entityLabel: 'Learner',
			actorName: 'Admin',
			before: { status: 'ACTIVE' },
			after: { status: 'SUSPENDED' }
		});

		const request = new Request(
			'https://quiz.example/api/v1/admin/audit-logs?action=USER_STATUS_CHANGED&limit=1'
		);
		const response = await getAuditLogs(event(request));
		expect(response.status).toBe(200);
		await expect(response.json()).resolves.toMatchObject({
			data: [{ entity: { type: 'user', label: 'Learner' } }],
			page: { size: 1, total: 1, totalPages: 1 }
		});
	});
});
