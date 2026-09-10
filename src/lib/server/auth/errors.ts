/**
 * A sign-in failure with a message it is safe to show the person signing in.
 *
 * Everything the auth modules reject on purpose — an unverified Google address, a replayed
 * code, a token that fails verification, an account already linked to a different Google
 * identity — throws this. The callback route turns it into a 400 carrying the message.
 *
 * Anything else that escapes is by definition unexpected, and becomes a logged 502 with a
 * generic message, so an internal failure never explains itself to a stranger.
 */
export class SignInError extends Error {
	constructor(message: string) {
		super(message);
		this.name = 'SignInError';
	}
}
