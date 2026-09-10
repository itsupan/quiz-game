import { eq } from 'drizzle-orm';
import type { Database } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { SignInError } from './errors';
import { hashPassword, validatePasswordStrength, verifyPassword } from './password';
import type { AuthUser } from './types';
import { isBootstrapAdmin } from './user';

const SELECTED = {
	id: users.id,
	publicId: users.publicId,
	email: users.email,
	displayName: users.displayName,
	role: users.role,
	status: users.status
} as const;

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type RegisterInput = {
	email: string;
	password: string;
	displayName: string;
};

export type LoginInput = {
	email: string;
	password: string;
};

export async function registerUser(
	db: Database,
	input: RegisterInput,
	bootstrapEmails?: string
): Promise<AuthUser> {
	const email = input.email?.trim().toLowerCase();
	const displayName = input.displayName?.trim();
	const password = input.password;

	if (!email || !EMAIL_REGEX.test(email)) {
		throw new SignInError('Please provide a valid email address.');
	}

	if (!displayName || displayName.length < 1) {
		throw new SignInError('Please provide your name.');
	}

	const passwordError = validatePasswordStrength(password);
	if (passwordError) {
		throw new SignInError(passwordError);
	}

	const [existing] = await db
		.select({ id: users.id })
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	if (existing) {
		throw new SignInError('An account with this email already exists. Please log in instead.');
	}

	const passwordHash = await hashPassword(password);
	const shouldBootstrap = isBootstrapAdmin(email, bootstrapEmails);

	const [created] = await db
		.insert(users)
		.values({
			email,
			displayName,
			passwordHash,
			role: shouldBootstrap ? 'ADMIN' : 'USER',
			status: 'ACTIVE',
			lastLoginAt: new Date()
		})
		.returning(SELECTED);

	return created;
}

export async function loginUser(db: Database, input: LoginInput): Promise<AuthUser> {
	const email = input.email?.trim().toLowerCase();
	const password = input.password;

	if (!email || !password) {
		throw new SignInError('Invalid email or password.');
	}

	const [found] = await db
		.select({
			id: users.id,
			publicId: users.publicId,
			email: users.email,
			displayName: users.displayName,
			passwordHash: users.passwordHash,
			role: users.role,
			status: users.status
		})
		.from(users)
		.where(eq(users.email, email))
		.limit(1);

	if (!found) {
		throw new SignInError('Invalid email or password.');
	}

	if (!found.passwordHash) {
		throw new SignInError(
			'This account was created with Google sign-in. Please continue with Google.'
		);
	}

	const valid = await verifyPassword(password, found.passwordHash);
	if (!valid) {
		throw new SignInError('Invalid email or password.');
	}

	if (found.status !== 'ACTIVE') {
		throw new SignInError('This account has been suspended.');
	}

	await db.update(users).set({ lastLoginAt: new Date() }).where(eq(users.id, found.id));

	return {
		id: found.id,
		publicId: found.publicId,
		email: found.email,
		displayName: found.displayName,
		role: found.role,
		status: found.status
	};
}
