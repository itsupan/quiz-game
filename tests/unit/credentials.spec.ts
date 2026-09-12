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

		it('promotes to ADMIN if on bootstrap list', async () => {
			const user = await registerUser(
				db,
				{
					email: 'admin@example.com',
					password: 'securePassword123!',
					displayName: 'Admin User'
				},
				'admin@example.com, other@example.com'
			);

			expect(user.role).toBe('ADMIN');
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
