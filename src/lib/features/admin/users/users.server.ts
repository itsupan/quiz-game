import { and, count, desc, eq, like, or, sql } from 'drizzle-orm';
import type { Database } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import type { JlptLevel, User, UserRole, UserStatus } from '$lib/server/db/schema';
import type { WriteResult } from '$lib/domain/write-result';

export type UserFilters = {
	search?: string;
	level?: JlptLevel;
	role?: UserRole;
	status?: UserStatus;
	page?: number;
	limit?: number;
};

export type ProvisionedUserInput = {
	email: string;
	displayName: string;
	jlptLevel: JlptLevel | null;
};

export const PAGE_SIZE = 25;

export async function listUsers(db: Database, filters: UserFilters = {}) {
	const page = Math.max(1, filters.page ?? 1);
	const limit = filters.limit ?? PAGE_SIZE;
	const searchPattern = filters.search ? `%${filters.search}%` : null;
	const where = and(
		searchPattern
			? or(
					like(users.displayName, searchPattern),
					like(users.email, searchPattern),
					like(users.publicId, searchPattern)
				)
			: undefined,
		filters.level ? eq(users.jlptLevel, filters.level) : undefined,
		filters.role ? eq(users.role, filters.role) : undefined,
		filters.status ? eq(users.status, filters.status) : undefined
	);

	const items = await db
		.select({
			id: users.id,
			publicId: users.publicId,
			email: users.email,
			displayName: users.displayName,
			jlptLevel: users.jlptLevel,
			role: users.role,
			status: users.status,
			createdAt: users.createdAt,
			lastLoginAt: users.lastLoginAt
		})
		.from(users)
		.where(where)
		.orderBy(desc(users.createdAt))
		.limit(limit)
		.offset((page - 1) * limit);

	const [{ total }] = await db.select({ total: count() }).from(users).where(where);

	return { items, total, page, pageCount: Math.max(1, Math.ceil(total / limit)) };
}

export async function getUser(db: Database, publicId: string) {
	const [user] = await db.select().from(users).where(eq(users.publicId, publicId));
	return user || null;
}

export async function updateUserRole(db: Database, userId: number, role: UserRole) {
	await db.update(users).set({ role }).where(eq(users.id, userId));
}

export async function updateUserStatus(db: Database, userId: number, status: UserStatus) {
	await db.update(users).set({ status }).where(eq(users.id, userId));
}

export async function updateUser(
	db: Database,
	userId: number,
	changes: Partial<Pick<User, 'displayName' | 'jlptLevel' | 'role' | 'status'>>
) {
	await db.update(users).set(changes).where(eq(users.id, userId));
}

/**
 * Pre-provisions a learner without inventing a temporary password. The account is
 * adopted only after Google verifies the same email address.
 */
export async function createProvisionedUser(
	db: Database,
	input: ProvisionedUserInput
): Promise<WriteResult<{ id: number; publicId: string }>> {
	const [existing] = await db
		.select({ id: users.id })
		.from(users)
		.where(sql`lower(${users.email}) = ${input.email}`)
		.limit(1);

	if (existing) {
		return { ok: false, message: 'A user with that email address already exists.' };
	}

	let created: { id: number; publicId: string };
	try {
		[created] = await db
			.insert(users)
			.values({
				email: input.email,
				displayName: input.displayName,
				jlptLevel: input.jlptLevel,
				role: 'USER',
				status: 'ACTIVE'
			})
			.returning({ id: users.id, publicId: users.publicId });
	} catch (cause) {
		if (cause instanceof Error && /UNIQUE constraint failed: users\.email/i.test(cause.message)) {
			return { ok: false, message: 'A user with that email address already exists.' };
		}
		throw cause;
	}

	return { ok: true, value: created };
}

export async function countAdmins(db: Database) {
	const [{ count: adminCount }] = await db
		.select({ count: count() })
		.from(users)
		.where(eq(users.role, 'ADMIN'));
	return adminCount;
}
