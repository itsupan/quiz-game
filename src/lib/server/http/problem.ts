/**
 * Generic RFC 9457 (`application/problem+json`) HTTP boundary shared by every JSON API in
 * this app. Originally lived only in the learner quiz API; extracted here so the admin API
 * reuses the exact same envelope, status-code mapping and correlation-id behavior instead
 * of re-implementing it.
 */

export type ValidationIssue = { field: string; message: string };

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

/** Rejects any body key not in `allowed` — a JSON API must not silently ignore a typo. */
export function assertKnownFields(body: Record<string, unknown>, allowed: readonly string[]): void {
	const unknown = Object.keys(body).filter((key) => !allowed.includes(key));
	if (unknown.length > 0) {
		apiProblem(
			422,
			'validation_failed',
			'Validation failed',
			`Unknown field${unknown.length === 1 ? '' : 's'}: ${unknown.join(', ')}.`,
			unknown.map((field) => ({ field, message: 'Unknown field.' }))
		);
	}
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

/**
 * Rejects a query parameter repeated more than once. `URLSearchParams` silently keeps
 * every occurrence, so without this a `?status=DRAFT&status=PUBLISHED` would resolve to
 * whichever value a particular reader happens to pick, which is exactly the kind of
 * ambiguity a filter used to gate content visibility must not have.
 */
export function assertNoDuplicateParams(params: URLSearchParams, names: readonly string[]): void {
	const duplicated = names.find((name) => params.getAll(name).length > 1);
	if (duplicated) {
		apiProblem(
			400,
			'duplicate_query_parameter',
			'Duplicate query parameter',
			`The ${duplicated} query parameter must not be repeated.`
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

export function parseLimit(value: string | null, max = 50, fallback = 20): number {
	if (value === null) return fallback;
	if (!/^[1-9][0-9]*$/.test(value)) {
		apiProblem(
			400,
			'invalid_query_parameter',
			'Invalid query parameter',
			`limit must be an integer from 1 to ${max}.`
		);
	}

	const limit = Number(value);
	if (limit > max) {
		apiProblem(
			400,
			'invalid_query_parameter',
			'Invalid query parameter',
			`limit must be an integer from 1 to ${max}.`
		);
	}

	return limit;
}

export function parsePageNumber(value: string | null): number {
	if (value === null) return 1;
	if (!/^[1-9][0-9]*$/.test(value)) {
		apiProblem(
			400,
			'invalid_query_parameter',
			'Invalid query parameter',
			'page must be a positive integer.'
		);
	}

	return Number(value);
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

		console.error('[api] unexpected error', { requestId, cause });
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
