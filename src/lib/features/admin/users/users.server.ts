import { count, desc, eq, like, or } from 'drizzle-orm';
import type { Database } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import type { UserRole, UserStatus } from '$lib/server/db/schema/enums';

export type UserFilters = {
	search?: string;
	page?: number;
};

export const PAGE_SIZE = 25;

export async function listUsers(db: Database, filters: UserFilters = {}) {
	const page = Math.max(1, filters.page ?? 1);

	let where;
	if (filters.search) {
		const searchPattern = `%${filters.search}%`;
		where = or(like(users.displayName, searchPattern), like(users.email, searchPattern));
	}

	const items = await db
		.select({
			id: users.id,
			publicId: users.publicId,
			email: users.email,
			displayName: users.displayName,
			role: users.role,
			status: users.status,
			createdAt: users.createdAt,
			lastLoginAt: users.lastLoginAt
		})
		.from(users)
		.where(where)
		.orderBy(desc(users.createdAt))
		.limit(PAGE_SIZE)
		.offset((page - 1) * PAGE_SIZE);

	const [{ total }] = await db.select({ total: count() }).from(users).where(where);

	return { items, total, page, pageCount: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
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

export async function countAdmins(db: Database) {
	const [{ count: adminCount }] = await db
		.select({ count: count() })
		.from(users)
		.where(eq(users.role, 'ADMIN'));
	return adminCount;
}
