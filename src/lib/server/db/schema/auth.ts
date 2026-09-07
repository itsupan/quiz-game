import { check, index, integer, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';

import { checkIn, createdAt, publicId, updatedAt } from './columns';
import { OAUTH_PROVIDERS, USER_ROLES, USER_STATUS } from './enums';

/**
 * A person, created on their first successful Google sign-in.
 *
 * `email` is unique so a returning user resolves to one record, but it is not the
 * identity we match on — see `oauth_accounts`.
 */
export const users = sqliteTable(
	'users',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		publicId: publicId(),
		email: text('email').notNull().unique(),
		displayName: text('display_name').notNull(),
		avatarUrl: text('avatar_url'),
		role: text('role', { enum: USER_ROLES }).notNull().default('USER'),
		status: text('status', { enum: USER_STATUS }).notNull().default('ACTIVE'),
		lastLoginAt: integer('last_login_at', { mode: 'timestamp' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(table) => [
		check('users_role_check', checkIn(table.role, USER_ROLES)),
		check('users_status_check', checkIn(table.status, USER_STATUS)),
		// The admin user list pages by creation date and filters by role and status.
		index('users_created_at_idx').on(table.createdAt),
		index('users_role_idx').on(table.role),
		index('users_status_idx').on(table.status)
		// No index on display_name: SQLite's LIKE is case-insensitive by default, so it
		// will not use a plain index for a prefix match (EXPLAIN reports SCAN, not
		// SEARCH). Admin name search scans, which is fine at user-table scale; an index
		// here would be write cost for nothing unless the column is COLLATE NOCASE.
	]
);

/**
 * The link between a user and their identity at an OAuth provider.
 *
 * Google's `sub` is the stable identifier and an email address is not — someone can
 * change theirs — so the provider identity lives here rather than on `users`. Keeping
 * it separate also means adding a second provider later is a row, not a migration.
 */
export const oauthAccounts = sqliteTable(
	'oauth_accounts',
	{
		id: integer('id').primaryKey({ autoIncrement: true }),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'restrict' }),
		provider: text('provider', { enum: OAUTH_PROVIDERS }).notNull(),
		providerAccountId: text('provider_account_id').notNull(),
		createdAt: createdAt()
	},
	(table) => [
		check('oauth_accounts_provider_check', checkIn(table.provider, OAUTH_PROVIDERS)),
		uniqueIndex('oauth_accounts_provider_account_idx').on(table.provider, table.providerAccountId),
		index('oauth_accounts_user_id_idx').on(table.userId)
	]
);

/**
 * A signed-in session.
 *
 * `id` holds the SHA-256 hash of the session cookie token, never the token itself, so a
 * leaked database dump cannot be replayed as a set of live sessions. Signing out
 * deletes the row, which is what makes invalidation real server-side rather than just
 * clearing a cookie.
 */
export const sessions = sqliteTable(
	'sessions',
	{
		id: text('id').primaryKey(),
		userId: integer('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		expiresAt: integer('expires_at', { mode: 'timestamp' }).notNull(),
		createdAt: createdAt()
	},
	(table) => [
		index('sessions_user_id_idx').on(table.userId),
		// Drives the sweep that clears expired sessions.
		index('sessions_expires_at_idx').on(table.expiresAt)
	]
);
