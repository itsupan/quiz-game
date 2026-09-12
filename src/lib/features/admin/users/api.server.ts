import { JLPT_LEVELS, USER_ROLES, USER_STATUS } from '$lib/domain/enums';
import type { JlptLevel, UserRole, UserStatus } from '$lib/domain/enums';
import { apiProblem } from '$lib/features/admin/api/http.server';
import type { ValidationIssue } from '$lib/server/http/problem';
import type { ProvisionedUserInput } from './users.server';

export const USER_CREATE_FIELDS = ['email', 'displayName', 'jlptLevel'] as const;
export const USER_PATCH_FIELDS = ['displayName', 'jlptLevel', 'role', 'status'] as const;

export type UserPatch = {
	displayName?: string;
	jlptLevel?: JlptLevel | null;
	role?: UserRole;
	status?: UserStatus;
};

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function validationFailed(errors: ValidationIssue[]): never {
	apiProblem(
		422,
		'validation_failed',
		'Validation failed',
		errors.length === 1 ? errors[0].message : 'The request body is invalid.',
		errors
	);
}

function readDisplayName(
	body: Record<string, unknown>,
	errors: ValidationIssue[],
	required: boolean
): string | undefined {
	if (!('displayName' in body)) {
		if (required) errors.push({ field: 'displayName', message: 'displayName is required.' });
		return undefined;
	}

	const value = body.displayName;
	if (typeof value !== 'string' || value.trim() === '' || value.trim().length > 100) {
		errors.push({
			field: 'displayName',
			message: 'displayName must be between 1 and 100 characters.'
		});
		return undefined;
	}

	return value.trim();
}

function readJlptLevel(
	body: Record<string, unknown>,
	errors: ValidationIssue[]
): JlptLevel | null | undefined {
	if (!('jlptLevel' in body)) return undefined;
	const value = body.jlptLevel;
	if (value === null || value === '') return null;
	if (typeof value !== 'string' || !JLPT_LEVELS.includes(value as JlptLevel)) {
		errors.push({
			field: 'jlptLevel',
			message: `jlptLevel must be one of: ${JLPT_LEVELS.join(', ')}.`
		});
		return undefined;
	}
	return value as JlptLevel;
}

function readEnum<const Values extends readonly string[]>(
	body: Record<string, unknown>,
	field: string,
	values: Values,
	errors: ValidationIssue[]
): Values[number] | undefined {
	if (!(field in body)) return undefined;
	const value = body[field];
	if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
		errors.push({ field, message: `${field} must be one of: ${values.join(', ')}.` });
		return undefined;
	}
	return value as Values[number];
}

export function parseProvisionedUserBody(body: Record<string, unknown>): ProvisionedUserInput {
	const errors: ValidationIssue[] = [];
	const displayName = readDisplayName(body, errors, true);
	const jlptLevel = readJlptLevel(body, errors);
	const rawEmail = body.email;
	let email: string | undefined;

	if (
		typeof rawEmail !== 'string' ||
		rawEmail.trim().length > 254 ||
		!EMAIL_PATTERN.test(rawEmail.trim())
	) {
		errors.push({ field: 'email', message: 'email must be a valid email address.' });
	} else {
		email = rawEmail.trim().toLowerCase();
	}

	if (errors.length > 0) validationFailed(errors);

	return {
		email: email as string,
		displayName: displayName as string,
		jlptLevel: jlptLevel ?? null
	};
}

export function parseUserPatchBody(body: Record<string, unknown>): UserPatch {
	const errors: ValidationIssue[] = [];
	const patch: UserPatch = {
		displayName: readDisplayName(body, errors, false),
		jlptLevel: readJlptLevel(body, errors),
		role: readEnum(body, 'role', USER_ROLES, errors),
		status: readEnum(body, 'status', USER_STATUS, errors)
	};

	if (errors.length > 0) validationFailed(errors);

	const supplied = Object.fromEntries(
		Object.entries(patch).filter(([, value]) => value !== undefined)
	) as UserPatch;
	if (Object.keys(supplied).length === 0) {
		validationFailed([{ field: 'body', message: 'Provide at least one user field to update.' }]);
	}

	return supplied;
}

export function toUserDto(user: {
	publicId: string;
	email: string;
	displayName: string;
	jlptLevel: JlptLevel | null;
	role: UserRole;
	status: UserStatus;
	lastLoginAt: Date | null;
	createdAt: Date;
	updatedAt?: Date;
}) {
	return {
		id: user.publicId,
		email: user.email,
		displayName: user.displayName,
		jlptLevel: user.jlptLevel,
		role: user.role,
		status: user.status,
		lastLoginAt: user.lastLoginAt?.toISOString() ?? null,
		createdAt: user.createdAt.toISOString(),
		...(user.updatedAt ? { updatedAt: user.updatedAt.toISOString() } : {})
	};
}
