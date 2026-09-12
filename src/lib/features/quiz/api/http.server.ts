import type { AuthUser } from '$lib/server/auth/types';
import { apiProblem } from '$lib/server/http/problem';

export {
	ApiProblem,
	apiEndpoint,
	apiProblem,
	assertKnownQueryParams,
	assertSameOrigin,
	parseEnumQuery,
	parseLimit,
	parsePublicId,
	readJsonObject
} from '$lib/server/http/problem';

export function requireLearner(user: AuthUser | null): AuthUser {
	if (!user) {
		apiProblem(
			401,
			'authentication_required',
			'Authentication required',
			'Sign in to use the quiz API.'
		);
	}

	if (user.status !== 'ACTIVE' || user.role !== 'USER') {
		apiProblem(
			403,
			'learner_access_required',
			'Forbidden',
			'An active learner account is required.'
		);
	}

	return user;
}

export function parseQuestionNumber(value: string): number {
	if (!/^[1-9][0-9]{0,4}$/.test(value)) {
		apiProblem(
			400,
			'invalid_question_number',
			'Invalid question number',
			'questionNumber must be a positive integer.'
		);
	}

	return Number(value);
}

export function parseIdempotencyKey(request: Request): string {
	const value = request.headers.get('idempotency-key')?.trim() ?? '';
	if (value.length < 8 || value.length > 128 || /[^\x21-\x7e]/.test(value)) {
		apiProblem(
			400,
			'invalid_idempotency_key',
			'Invalid Idempotency-Key',
			'Idempotency-Key must contain 8 to 128 visible ASCII characters.'
		);
	}

	return value;
}

export function parseAnswerBody(body: Record<string, unknown>): number | null {
	const keys = Object.keys(body);
	if (keys.length !== 1 || keys[0] !== 'selectedOptionNumber') {
		apiProblem(
			422,
			'validation_failed',
			'Validation failed',
			'The body must contain only selectedOptionNumber.',
			[{ field: 'selectedOptionNumber', message: 'Required; use null to clear the answer.' }]
		);
	}

	const value = body.selectedOptionNumber;
	if (value === null) return null;
	if (!Number.isInteger(value) || (value as number) < 1 || (value as number) > 100) {
		apiProblem(
			422,
			'validation_failed',
			'Validation failed',
			'selectedOptionNumber must be a positive integer or null.',
			[{ field: 'selectedOptionNumber', message: 'Must be a positive integer or null.' }]
		);
	}

	return value as number;
}
