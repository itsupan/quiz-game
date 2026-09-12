import { eq, sql } from 'drizzle-orm';
import type { Database } from '$lib/server/db';
import { users } from '$lib/server/db/schema';
import { SignInError } from './errors';
import {
	hashPassword,
	passwordNeedsRehash,
	validatePasswordStrength,
	verifyPassword
} from './password';
import type { AuthUser } from './types';

const SELECTED = {
	id: users.id,
	publicId: users.publicId,
	email: users.email,
	displayName: users.displayName,
	avatarUrl: users.avatarUrl,
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

export async function registerUser(db: Database, input: RegisterInput): Promise<AuthUser> {
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
		.where(sql`lower(${users.email}) = ${email}`)
		.limit(1);

	if (existing) {
		throw new SignInError('An account with this email already exists. Please log in instead.');
	}

	const passwordHash = await hashPassword(password);
	const [created] = await db
		.insert(users)
		.values({
			email,
			displayName,
			passwordHash,
			// This address has not been verified. Admin bootstrap is restricted to the
			// verified Google flow; trusting a public signup field would let anybody claim
			// an allowlisted administrator address.
			role: 'USER',
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
			avatarUrl: users.avatarUrl,
			passwordHash: users.passwordHash,
			role: users.role,
			status: users.status
		})
		.from(users)
		.where(sql`lower(${users.email}) = ${email}`)
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

	await db
		.update(users)
		.set({
			lastLoginAt: new Date(),
			...(passwordNeedsRehash(found.passwordHash)
				? { passwordHash: await hashPassword(password) }
				: {})
		})
		.where(eq(users.id, found.id));

	return {
		id: found.id,
		publicId: found.publicId,
		email: found.email,
		displayName: found.displayName,
		avatarUrl: found.avatarUrl,
		role: found.role,
		status: found.status
	};
}
