import type { AuthUser } from '$lib/server/auth/types';

type ValidationIssue = { field: string; message: string };

export class ApiProblem extends Error {
	constructor(
		readonly status: number,
		readonly code: string,
		readonly title: string,
		detail: string,
		readonly errors?: ValidationIssue[]
	) {
		super(detail);
		this.name = 'ApiProblem';
	}
}

export function apiProblem(
	status: number,
	code: string,
	title: string,
	detail: string,
	errors?: ValidationIssue[]
): never {
	throw new ApiProblem(status, code, title, detail, errors);
}

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

export function assertSameOrigin(request: Request, url: URL): void {
	const origin = request.headers.get('origin');
	if (!origin) return;

	let requestOrigin: string;
	try {
		requestOrigin = new URL(origin).origin;
	} catch {
		apiProblem(403, 'cross_origin_request', 'Forbidden', 'The request origin is invalid.');
	}

	if (requestOrigin !== url.origin) {
		apiProblem(403, 'cross_origin_request', 'Forbidden', 'Cross-origin mutations are not allowed.');
	}
}

export async function readJsonObject(request: Request): Promise<Record<string, unknown>> {
	const contentType = request.headers.get('content-type')?.split(';', 1)[0].trim().toLowerCase();
	if (contentType !== 'application/json') {
		apiProblem(
			415,
			'unsupported_media_type',
			'Unsupported media type',
			'Requests with a body must use application/json.'
		);
	}

	let value: unknown;
	try {
		value = await request.json();
	} catch {
		apiProblem(400, 'invalid_json', 'Invalid JSON', 'The request body is not valid JSON.');
	}

	if (typeof value !== 'object' || value === null || Array.isArray(value)) {
		apiProblem(
			422,
			'validation_failed',
			'Validation failed',
			'The request body must be a JSON object.'
		);
	}

	return value as Record<string, unknown>;
}

export function parsePublicId(value: string, field: string): string {
	if (!/^[0-9A-HJKMNP-TV-Z]{26}$/.test(value)) {
		apiProblem(
			400,
			'invalid_identifier',
			'Invalid identifier',
			`${field} must be a 26-character ULID.`
		);
	}

	return value;
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

export function assertKnownQueryParams(params: URLSearchParams, allowed: readonly string[]): void {
	const unknown = [...params.keys()].find((key) => !allowed.includes(key));
	if (unknown) {
		apiProblem(
			400,
			'unknown_query_parameter',
			'Unknown query parameter',
			`The ${unknown} query parameter is not supported.`
		);
	}
}

export function parseEnumQuery<const Values extends readonly string[]>(
	value: string | null,
	values: Values,
	field: string
): Values[number] | undefined {
	if (value === null) return undefined;
	if (!(values as readonly string[]).includes(value)) {
		apiProblem(
			400,
			'invalid_query_parameter',
			'Invalid query parameter',
			`${field} has an unsupported value.`
		);
	}

	return value as Values[number];
}

export function parseLimit(value: string | null): number {
	if (value === null) return 20;
	if (!/^[1-9][0-9]*$/.test(value)) {
		apiProblem(
			400,
			'invalid_query_parameter',
			'Invalid query parameter',
			'limit must be an integer from 1 to 50.'
		);
	}

	const limit = Number(value);
	if (limit > 50) {
		apiProblem(
			400,
			'invalid_query_parameter',
			'Invalid query parameter',
			'limit must be an integer from 1 to 50.'
		);
	}

	return limit;
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

function problemResponse(problem: ApiProblem, requestId: string, request: Request): Response {
	return new Response(
		JSON.stringify({
			type: `urn:quiz-game:problem:${problem.code}`,
			title: problem.title,
			status: problem.status,
			detail: problem.message,
			instance: new URL(request.url).pathname,
			code: problem.code,
			requestId,
			...(problem.errors ? { errors: problem.errors } : {})
		}),
		{
			status: problem.status,
			headers: {
				'cache-control': 'no-store',
				'content-type': 'application/problem+json',
				'x-request-id': requestId
			}
		}
	);
}

export async function apiEndpoint(
	request: Request,
	handler: () => Response | Promise<Response>
): Promise<Response> {
	const requestId = request.headers.get('cf-ray') ?? crypto.randomUUID();

	try {
		const response = await handler();
		response.headers.set('cache-control', response.headers.get('cache-control') ?? 'no-store');
		response.headers.set('x-request-id', requestId);
		return response;
	} catch (cause) {
		if (cause instanceof ApiProblem) {
			return problemResponse(cause, requestId, request);
		}

		console.error('[quiz-api] unexpected error', { requestId, cause });
		return problemResponse(
			new ApiProblem(
				500,
				'internal_error',
				'Internal server error',
				'An unexpected error occurred.'
			),
			requestId,
			request
		);
	}
}
