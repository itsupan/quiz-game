import type { AuthUser } from '$lib/server/auth/types';
import { apiProblem } from '$lib/server/http/problem';

export {
	ApiProblem,
	apiEndpoint,
	apiProblem,
	assertKnownFields,
	assertKnownQueryParams,
	assertNoDuplicateParams,
	assertSameOrigin,
	parseEnumQuery,
	parseLimit,
	parsePageNumber,
	parsePublicId,
	readJsonObject
} from '$lib/server/http/problem';

/**
 * The authorization gate for every `/api/v1/admin/**` request.
 *
 * The `/admin` hook in `hooks.server.ts` does not cover this path prefix, so each route
 * calls this explicitly — the same shape `requireLearner` uses for the learner API, and
 * the same rule `assertAdmin` enforces for the dashboard, expressed as a problem response
 * instead of a SvelteKit `error()`.
 *
 * A suspended administrator never reaches this function with a non-null user:
 * `resolveUser` (`$lib/server/auth/user.ts`) invalidates the session and returns null the
 * moment it sees `status !== 'ACTIVE'`, so that case is observably a 401, identical to an
 * anonymous request and to how `/admin` itself already behaves. The `status` check below
 * is defensive — it mirrors `assertAdmin` — not a path this API can actually reach.
 */
export function requireAdmin(user: AuthUser | null): AuthUser {
	if (!user) {
		apiProblem(
			401,
			'authentication_required',
			'Authentication required',
			'Sign in to use the admin API.'
		);
	}

	if (user.role !== 'ADMIN' || user.status !== 'ACTIVE') {
		apiProblem(
			403,
			'admin_access_required',
			'Forbidden',
			'An active administrator account is required.'
		);
	}

	return user;
}
