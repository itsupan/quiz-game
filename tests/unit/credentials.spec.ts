import { beforeEach, describe, expect, it } from 'vitest';
import { createTestDatabase, type TestDatabase } from '$lib/server/db/test-harness';
import { users } from '$lib/server/db/schema';
import { eq } from 'drizzle-orm';
import { loginUser, registerUser } from '$lib/server/auth/credentials';

let db: TestDatabase;

beforeEach(() => {
	db = createTestDatabase().db;
});

describe('credentials authentication', () => {
	describe('registerUser', () => {
		it('registers a new learner user', async () => {
			const user = await registerUser(db, {
				email: 'newuser@example.com',
				password: 'securePassword123!',
				displayName: 'New Learner'
			});

			expect(user.id).toBeDefined();
			expect(user.email).toBe('newuser@example.com');
			expect(user.displayName).toBe('New Learner');
			expect(user.role).toBe('USER');
			expect(user.status).toBe('ACTIVE');

			const [stored] = await db.select().from(users).where(eq(users.id, user.id));
			expect(stored.passwordHash).toMatch(/^pbkdf2:sha256:/);
		});

		it('never grants admin from an unverified signup email', async () => {
			const user = await registerUser(db, {
				email: 'admin@example.com',
				password: 'securePassword123!',
				displayName: 'Admin User'
			});

			expect(user.role).toBe('USER');
		});

		it('rejects invalid email', async () => {
			await expect(
				registerUser(db, {
					email: 'invalid-email',
					password: 'securePassword123!',
					displayName: 'User'
				})
			).rejects.toThrow('Please provide a valid email address.');
		});

		it('rejects empty name', async () => {
			await expect(
				registerUser(db, {
					email: 'valid@example.com',
					password: 'securePassword123!',
					displayName: '   '
				})
			).rejects.toThrow('Please provide your name.');
		});

		it('rejects weak password', async () => {
			await expect(
				registerUser(db, {
					email: 'valid@example.com',
					password: 'short',
					displayName: 'User'
				})
			).rejects.toThrow('Password must be at least 8 characters long.');
		});

		it('rejects duplicate email', async () => {
			await registerUser(db, {
				email: 'dup@example.com',
				password: 'securePassword123!',
				displayName: 'User 1'
			});

			await expect(
				registerUser(db, {
					email: 'dup@example.com',
					password: 'securePassword123!',
					displayName: 'User 2'
				})
			).rejects.toThrow('An account with this email already exists.');
		});

		it('rejects a differently-cased version of an existing email', async () => {
			await db.insert(users).values({
				email: 'Existing@Example.COM',
				displayName: 'Existing user'
			});

			await expect(
				registerUser(db, {
					email: 'existing@example.com',
					password: 'securePassword123!',
					displayName: 'Duplicate user'
				})
			).rejects.toThrow('An account with this email already exists.');
		});
	});

	describe('loginUser', () => {
		beforeEach(async () => {
			await registerUser(db, {
				email: 'learner@example.com',
				password: 'securePassword123!',
				displayName: 'Learner'
			});
		});

		it('logs in with correct credentials', async () => {
			const user = await loginUser(db, {
				email: 'learner@example.com',
				password: 'securePassword123!'
			});

			expect(user.email).toBe('learner@example.com');
			expect(user.displayName).toBe('Learner');
		});

		it('upgrades a legacy password hash after a successful login', async () => {
			const legacyHash =
				'pbkdf2:sha256:100000:00000000000000000000000000000000:4b58a5b66d5b9b627f460bed3f6656429e89952d7578c869f0cdb43ace16d391';
			await db
				.update(users)
				.set({ passwordHash: legacyHash })
				.where(eq(users.email, 'learner@example.com'));

			await loginUser(db, {
				email: 'learner@example.com',
				password: 'securePassword123!'
			});

			const [updated] = await db
				.select({ passwordHash: users.passwordHash })
				.from(users)
				.where(eq(users.email, 'learner@example.com'));

			expect(updated.passwordHash).toMatch(/^pbkdf2:sha256:600000:/);
			expect(updated.passwordHash).not.toBe(legacyHash);
		});

		it('is case-insensitive with email', async () => {
			const user = await loginUser(db, {
				email: 'LEARNER@example.com',
				password: 'securePassword123!'
			});

			expect(user.email).toBe('learner@example.com');
		});

		it('rejects wrong password', async () => {
			await expect(
				loginUser(db, {
					email: 'learner@example.com',
					password: 'wrongPassword!'
				})
			).rejects.toThrow('Invalid email or password.');
		});

		it('rejects non-existent email', async () => {
			await expect(
				loginUser(db, {
					email: 'nobody@example.com',
					password: 'securePassword123!'
				})
			).rejects.toThrow('Invalid email or password.');
		});

		it('tells Google-only users to continue with Google', async () => {
			// Insert a user with no password (like a Google user)
			await db.insert(users).values({
				email: 'googleuser@example.com',
				displayName: 'Google User',
				passwordHash: null,
				role: 'USER',
				status: 'ACTIVE'
			});

			await expect(
				loginUser(db, {
					email: 'googleuser@example.com',
					password: 'anyPassword123!'
				})
			).rejects.toThrow(
				'This account was created with Google sign-in. Please continue with Google.'
			);
		});

		it('rejects suspended accounts', async () => {
			await db
				.update(users)
				.set({ status: 'SUSPENDED' })
				.where(eq(users.email, 'learner@example.com'));

			await expect(
				loginUser(db, {
					email: 'learner@example.com',
					password: 'securePassword123!'
				})
			).rejects.toThrow('This account has been suspended.');
		});
	});
});
